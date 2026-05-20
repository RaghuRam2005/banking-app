// hubAuth.js — Sign into BMS hub after user logs into Nova Bank
import { signInWithEmailAndPassword } from "firebase/auth";
import { hubAuth } from "../lib/firebaseHub";

const HUB_EMAIL    = process.env.NEXT_PUBLIC_HUB_BANK_EMAIL;
const HUB_PASSWORD = process.env.NEXT_PUBLIC_HUB_BANK_PASSWORD;

export const signInToHub = async () => {
  try {
    await signInWithEmailAndPassword(hubAuth, HUB_EMAIL, HUB_PASSWORD);
    console.log("[HUB AUTH] Signed in successfully");
  } catch (err) {
    // Warn but do not block — interbank transfers will fail if hub auth fails
    console.warn("[HUB AUTH] Failed:", err.message);
  }
};
