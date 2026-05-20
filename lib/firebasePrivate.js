// firebasePrivate.js — Nova Bank's private Firebase project
// Uses Firebase REST API for all sensitive data operations
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const privateConfig = {
  apiKey:            process.env.NEXT_PUBLIC_PRIVATE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_PRIVATE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_PRIVATE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_PRIVATE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_PRIVATE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_PRIVATE_APP_ID,
};

// Named "private" to avoid collision with hub app
const privateApp =
  getApps().find((a) => a.name === "private") ??
  initializeApp(privateConfig, "private");

export const privateDb   = getFirestore(privateApp);
export const privateAuth = getAuth(privateApp);
