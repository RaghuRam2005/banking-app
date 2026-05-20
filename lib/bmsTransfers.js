/**
 * bmsTransfers.js
 * ─────────────────────────────────────────────────────────────
 * BMS Interbank Network integration.
 * Uses the Firebase SDK (v9 modular) ONLY for hub operations.
 * All private DB operations use the REST API (firebaseRest.js).
 *
 * Implements the three required hub functions:
 *   1. initiateInterbankTransfer  — send money to another bank
 *   2. startIncomingListener      — receive money from other banks
 *   3. startStatusListener        — track status of sent transfers
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  runTransaction as hubRunTransaction,
} from "firebase/firestore";
import { hubDb } from "./firebaseHub";
import {
  getDoc as restGet,
  updateDoc as restUpdate,
  createDoc as restCreate,
  queryDocs as restQuery,
  deductBalance,
  creditBalance,
} from "./firebaseRest";

const BANK_ID = process.env.NEXT_PUBLIC_BANK_ID;

// ── 1. Send an interbank transfer ────────────────────────────

/**
 * initiateInterbankTransfer
 *
 * Phase 1: REST — deduct sender balance + write pending local transaction
 * Phase 2: SDK  — write to hub interbank_transfers collection
 *
 * @param {object} params
 * @param {string} params.fromAccountId   — Firestore doc ID in private accounts
 * @param {string} params.toAccountId     — Account NUMBER entered by user (not doc ID)
 * @param {string} params.toBankId        — Destination bank's BANK_ID
 * @param {number} params.amountPaise     — Amount in paise (integer)
 * @param {string} params.mode            — "imps" | "neft"
 * @returns {string} transferId
 */
export const initiateInterbankTransfer = async ({
  fromAccountId,
  toAccountId,
  toBankId,
  amountPaise,
  mode = "imps",
}) => {
  // Generate a stable transfer ID — used in BOTH private DB and hub
  const transferId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // ── Phase 1: REST — deduct balance + write pending local record ──
  await deductBalance(fromAccountId, amountPaise);

  await restCreate("transactions", {
    transactionId: transferId,
    direction:     "debit",
    fromAccountId,
    toAccountId,
    fromBankId:    BANK_ID,
    toBankId,
    amount:        amountPaise,
    currency:      "INR",
    status:        "pending",
    mode,
    type:          "interbank",
  });

  // ── Phase 2: SDK — write to shared hub ───────────────────────────
  try {
    await setDoc(doc(hubDb, "interbank_transfers", transferId), {
      transferId,
      fromBankId:    BANK_ID,
      toBankId,
      fromAccountId,
      toAccountId,   // account NUMBER the user typed
      amount:        amountPaise,
      currency:      "INR",
      mode,
      status:        "pending",
      createdAt:     serverTimestamp(),
      completedAt:   null,
      failureReason: null,
    });
  } catch (hubErr) {
    console.error("[HUB WRITE] Failed:", hubErr.message);
    // Mark local record as failed — credit back will be handled manually / via support
    await restUpdate("transactions", transferId, {
      status:        "failed",
      failureReason: "Hub write failed: " + hubErr.message,
    });
    throw new Error("Transfer failed. Contact support.");
  }

  return transferId;
};

// ── 2. Listen for incoming transfers ─────────────────────────

/**
 * startIncomingListener
 *
 * Watches hub for transfers addressed to this bank.
 * Uses ONE where() clause to avoid composite index requirement.
 * Status filtering is done in JavaScript.
 *
 * @param {function} onSuccess — called with transfer object on successful credit
 * @param {function} onError   — called with (transfer, error) on failure
 * @returns {function}         — unsubscribe function (call on logout)
 */
export const startIncomingListener = (onSuccess, onError) => {
  console.log("[LISTENER] Starting incoming listener for bankId:", BANK_ID);

  // ONE where clause only — no composite index required
  const q = query(
    collection(hubDb, "interbank_transfers"),
    where("toBankId", "==", BANK_ID)
  );

  return onSnapshot(q, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type !== "added" && change.type !== "modified") continue;

      const transfer = { id: change.doc.id, ...change.doc.data() };

      // Filter status in JS — no composite index needed
      if (transfer.status !== "pending") continue;

      console.log("[LISTENER] Processing incoming transfer:", transfer.transferId);

      await _processIncoming(transfer).catch((err) => {
        console.error("[LISTENER] Failed to process:", err.message);
        onError?.(transfer, err);
      });

      onSuccess?.(transfer);
    }
  }, (err) => {
    console.error("[LISTENER] onSnapshot error:", err.code, err.message);
  });
};

/** Internal — credit the recipient and update hub status */
const _processIncoming = async (transfer) => {
  const { transferId, fromBankId, toAccountId, amount } = transfer;

  const hubRef = doc(hubDb, "interbank_transfers", transferId);

  // Step 1: find recipient account by account NUMBER (not doc ID)
  const accounts = await restQuery("accounts", [
    { field: "accountNumber", op: "EQUAL", value: toAccountId },
  ]);

  if (!accounts || accounts.length === 0) {
    await updateDoc(hubRef, {
      status:        "failed",
      failureReason: `Account ${toAccountId} not found in ${BANK_ID}`,
      completedAt:   serverTimestamp(),
    });
    return;
  }

  const recipientAccount = accounts[0];

  // Step 2: check for duplicate (transferId already in our transactions)
  const existing = await restQuery("transactions", [
    { field: "transactionId", op: "EQUAL", value: transferId },
  ]);

  if (existing && existing.length > 0) {
    console.log("[LISTENER] Duplicate detected, skipping:", transferId);
    return;
  }

  try {
    // Step 3: credit balance via REST
    await creditBalance(recipientAccount._id, amount);

    // Step 4: write local credit transaction record
    await restCreate("transactions", {
      transactionId: transferId,
      ownerId:       recipientAccount.ownerId,
      direction:     "credit",
      fromBankId,
      toBankId:      BANK_ID,
      fromAccountId: transfer.fromAccountId || transfer.fromAccount || null,
      toAccountId:   recipientAccount._id,
      amount,
      currency:      "INR",
      status:        "completed",
      mode:          transfer.mode,
      type:          "interbank",
      source:        "shared-hub",
      createdAt:     new Date().toISOString(),
    });

    // Step 5: update hub status to completed
    await updateDoc(hubRef, {
      status:      "completed",
      completedAt: serverTimestamp(),
    });

    console.log("[LISTENER] Successfully processed:", transferId);
  } catch (err) {
    console.error("[LISTENER] Credit failed:", err.message);
    await updateDoc(hubRef, {
      status:        "failed",
      failureReason: err.message,
      completedAt:   serverTimestamp(),
    });
  }
};

// ── 3. Track status of transfers we sent ─────────────────────

/**
 * startStatusListener
 *
 * Watches hub for status changes on transfers sent BY this bank.
 * Updates local transaction record when destination bank responds.
 * Uses ONE where() clause to avoid composite index requirement.
 *
 * @param {function} onStatusChange — called with updated transfer object
 * @returns {function}              — unsubscribe function (call on logout)
 */
export const startStatusListener = (onStatusChange) => {
  console.log("[STATUS LISTENER] Starting for bankId:", BANK_ID);

  const q = query(
    collection(hubDb, "interbank_transfers"),
    where("fromBankId", "==", BANK_ID)
  );

  return onSnapshot(q, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type !== "added" && change.type !== "modified") continue;

      const transfer = { id: change.doc.id, ...change.doc.data() };

      // Skip — still pending
      if (transfer.status === "pending") continue;

      const localId = transfer.transferId ?? transfer.id;

      // Update our local transaction record
      try {
        const locals = await restQuery("transactions", [
          { field: "transactionId", op: "EQUAL", value: localId },
        ]);

        if (locals && locals.length > 0) {
          const local = locals[0];
          if (local.direction === "debit") {
            await restUpdate("transactions", local._id, {
              status:        transfer.status,
              failureReason: transfer.failureReason ?? null,
            });
            onStatusChange?.(transfer);
          }
        }
      } catch (err) {
        console.error("[STATUS LISTENER] Update failed:", err.message);
      }
    }
  });
};

// ── Hub registry helpers ──────────────────────────────────────

/** Register this bank in the hub banks collection (run once on setup) */
export const registerBankInHub = async (bankName, ifscPrefix, ifscCode) => {
  await setDoc(doc(hubDb, "banks", BANK_ID), {
    bankId:     BANK_ID,
    bankName,
    ifscPrefix,
    ifscCode,
    isActive:   true,
    updatedAt:  serverTimestamp(),
  });
  console.log("[HUB] Bank registered:", BANK_ID);
};

/** Register a new account in hub's public_accounts collection */
export const registerAccountInHub = async (accountDocId, accountNumber, ifscCode) => {
  const masked = "••••" + accountNumber.slice(-4);
  await setDoc(doc(hubDb, "public_accounts", accountDocId), {
    accountId:            accountDocId,
    bankId:               BANK_ID,
    maskedAccountNumber:  masked,
    ifscCode,
    isActive:             true,
    registeredAt:         serverTimestamp(),
  });
};

/** Fetch list of all active banks from the hub (for transfer destination dropdown) */
export const fetchHubBanks = async () => {
  const q = query(collection(hubDb, "banks"), where("isActive", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
