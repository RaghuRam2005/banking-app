/**
 * firebaseRest.js
 * ─────────────────────────────────────────────────────────────
 * All private-DB operations use the Firebase REST API.
 * This keeps sensitive data (accounts, balances, loans, KYC)
 * completely separate from the hub SDK connection.
 *
 * Base URL pattern:
 *   https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{collection}/{doc}
 */

const PROJECT_ID  = process.env.NEXT_PUBLIC_PRIVATE_PROJECT_ID;
const API_KEY     = process.env.NEXT_PUBLIC_PRIVATE_API_KEY;
const BASE        = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Auth token cache ─────────────────────────────────────────
let _idToken = null;
export const setRestToken = (token) => { _idToken = token; };
export const clearRestToken = () => { _idToken = null; };

function authHeaders() {
  const h = { "Content-Type": "application/json" };
  if (_idToken) h["Authorization"] = `Bearer ${_idToken}`;
  return h;
}

// ── Low-level REST helpers ───────────────────────────────────

/** Convert a Firestore REST document into a plain JS object */
export function fromFirestore(doc) {
  if (!doc || !doc.fields) return null;
  const obj = { _id: doc.name?.split("/").pop() };
  for (const [key, val] of Object.entries(doc.fields)) {
    obj[key] = parseValue(val);
  }
  return obj;
}

function parseValue(val) {
  if (val.stringValue  !== undefined) return val.stringValue;
  if (val.integerValue  !== undefined) return Number(val.integerValue);
  if (val.doubleValue   !== undefined) return Number(val.doubleValue);
  if (val.booleanValue  !== undefined) return val.booleanValue;
  if (val.timestampValue !== undefined) return new Date(val.timestampValue);
  if (val.nullValue     !== undefined) return null;
  if (val.arrayValue    !== undefined)
    return (val.arrayValue.values ?? []).map(parseValue);
  if (val.mapValue      !== undefined)
    return fromFields(val.mapValue.fields ?? {});
  return null;
}

function fromFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) obj[k] = parseValue(v);
  return obj;
}

/** Convert a plain JS object to Firestore REST fields */
export function toFirestore(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === "_id") continue;
    fields[key] = toValue(val);
  }
  return { fields };
}

function toValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean")  return { booleanValue: val };
  if (typeof val === "number")   return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === "string")   return { stringValue: val };
  if (val instanceof Date)       return { timestampValue: val.toISOString() };
  if (Array.isArray(val))        return { arrayValue: { values: val.map(toValue) } };
  if (typeof val === "object")   return { mapValue: { fields: Object.fromEntries(Object.entries(val).map(([k,v]) => [k, toValue(v)])) } };
  return { stringValue: String(val) };
}

// ── CRUD operations ──────────────────────────────────────────

/** GET a single document */
export async function getDoc(collection, id) {
  const res = await fetch(`${BASE}/${collection}/${id}?key=${API_KEY}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  return fromFirestore(await res.json());
}

/** LIST documents in a collection (with optional pageSize) */
export async function listDocs(collection, pageSize = 100) {
  const res = await fetch(`${BASE}/${collection}?key=${API_KEY}&pageSize=${pageSize}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.documents ?? []).map(fromFirestore);
}

/** CREATE a document with auto-generated ID */
export async function createDoc(collection, data) {
  const res = await fetch(`${BASE}/${collection}?key=${API_KEY}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(toFirestore({ ...data, createdAt: new Date().toISOString() })),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  return fromFirestore(await res.json());
}

/** SET a document with a specific ID (upsert)
 *  FIX: updateMask.fieldPaths must be repeated per-field, not comma-joined */
export async function setDoc(collection, id, data) {
  const fields = toFirestore({ ...data, updatedAt: new Date().toISOString() }).fields;
  // Build repeated updateMask.fieldPaths query params (Firestore REST requirement)
  const maskParams = Object.keys(fields)
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");
  const res = await fetch(
    `${BASE}/${collection}/${id}?key=${API_KEY}&${maskParams}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Set failed: ${res.status} — ${errBody}`);
  }
  return fromFirestore(await res.json());
}

/** UPDATE specific fields on a document */
export async function updateDoc(collection, id, data) {
  return setDoc(collection, id, data);
}

/** DELETE a document */
export async function deleteDoc(collection, id) {
  const res = await fetch(`${BASE}/${collection}/${id}?key=${API_KEY}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.ok;
}

/**
 * QUERY documents — uses the Firestore REST runQuery endpoint.
 * FIX: endpoint is BASE + ":runQuery", not BASE with "/documents" stripped.
 * filters: [{ field, op, value }]  op: "EQUAL", "GREATER_THAN", etc.
 */
export async function queryDocs(collection, filters = [], orderBy = null, limit = 100) {
  const structuredQuery = {
    from: [{ collectionId: collection }],
    limit,
  };

  if (filters.length > 0) {
    const fieldFilters = filters.map(({ field, op, value }) => ({
      fieldFilter: {
        field: { fieldPath: field },
        op,
        value: toValue(value),
      },
    }));
    structuredQuery.where =
      fieldFilters.length === 1
        ? fieldFilters[0]
        : { compositeFilter: { op: "AND", filters: fieldFilters } };
  }

  if (orderBy) {
    structuredQuery.orderBy = [{ field: { fieldPath: orderBy.field }, direction: orderBy.dir ?? "DESCENDING" }];
  }

  // Correct endpoint: documents:runQuery (NOT databases/(default):runQuery)
  const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ structuredQuery }),
  });

  if (!res.ok) return [];
  const rows = await res.json();
  return rows.filter((r) => r.document).map((r) => fromFirestore(r.document));
}

// ── Domain helpers ───────────────────────────────────────────

/** Deduct balance from an account — uses REST optimistic write
 *  (production: wrap in a Cloud Function transaction for safety) */
export async function deductBalance(accountId, amountPaise) {
  const account = await getDoc("accounts", accountId);
  if (!account) throw new Error("Account not found");
  if (account.balance < amountPaise) throw new Error("Insufficient balance");
  await updateDoc("accounts", accountId, { balance: account.balance - amountPaise });
  return account.balance - amountPaise;
}

/** Credit balance to an account */
export async function creditBalance(accountId, amountPaise) {
  const account = await getDoc("accounts", accountId);
  if (!account) throw new Error("Account not found");
  await updateDoc("accounts", accountId, { balance: account.balance + amountPaise });
  return account.balance + amountPaise;
}
