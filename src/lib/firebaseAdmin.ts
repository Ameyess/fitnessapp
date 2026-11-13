import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

let adminInitialized = false

export function initFirebaseAdmin() {
  if (adminInitialized || getApps().length > 0) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  if (!raw) {
    console.warn("FIREBASE_SERVICE_ACCOUNT_BASE64 not set; admin init skipped")
    adminInitialized = true
    return
  }
  try {
    const serviceAccount = JSON.parse(Buffer.from(raw, "base64").toString("utf8"))
    initializeApp({ credential: cert(serviceAccount) })
    adminInitialized = true
  } catch (e) {
    console.error("Failed to init Firebase Admin", e)
    adminInitialized = true
  }
}

export function getAdminAuth() {
  initFirebaseAdmin()
  return getAuth()
}

export function getAdminDb() {
  initFirebaseAdmin()
  return getFirestore()
}
