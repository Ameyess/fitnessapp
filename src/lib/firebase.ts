import { initializeApp, getApps, FirebaseApp } from "firebase/app"
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  User,
} from "firebase/auth"
import { getFirestore, Firestore } from "firebase/firestore"
import { getMessaging, Messaging } from "firebase/messaging"

const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let messaging: Messaging | null = null

export function initFirebase() {
  if (getApps().length > 0) {
    app = getApps()[0]
  } else {
    const missing = required.filter((k) => !process.env[k])
    if (missing.length && typeof window === "undefined") {
      console.warn("Firebase env vars missing:", missing.join(", "))
    }
    app = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    })
  }
  auth = getAuth(app)
  db = getFirestore(app)
  if (typeof window !== "undefined") {
    messaging = getMessaging(app)
  }
  return { app, auth, db, messaging }
}

export function getFirebase() {
  if (!app) {
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      // Stubbed during build/SSR when Firebase env is not configured.
      return { app: null, auth: null, db: null, messaging: null } as any
    }
    initFirebase()
  }
  return { app, auth, db, messaging } as {
    app: FirebaseApp
    auth: Auth
    db: Firestore
    messaging: Messaging
  }
}

// Lazy singletons (safe to import in server and client modules)
export function getAuthSingleton(): Auth {
  if (!auth) initFirebase()
  return auth!
}

export function getDbSingleton(): Firestore {
  if (!db) initFirebase()
  return db!
}

export function getMessagingSingleton(): Messaging {
  if (!messaging && typeof window !== "undefined") initFirebase()
  return messaging!
}

export { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut }
export type { User, Auth, Firestore, Messaging }
