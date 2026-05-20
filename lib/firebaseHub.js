// firebaseHub.js — Shared BMS Network hub (same config for all banks)
// Uses Firebase SDK with onSnapshot for real-time interbank transfers
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const hubConfig = {
  apiKey:            process.env.NEXT_PUBLIC_HUB_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_HUB_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_HUB_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_HUB_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_HUB_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_HUB_APP_ID,
};

// Named "hub" to avoid collision with private app
const hubApp =
  getApps().find((a) => a.name === "hub") ??
  initializeApp(hubConfig, "hub");

export const hubDb   = getFirestore(hubApp);
export const hubAuth = getAuth(hubApp);
