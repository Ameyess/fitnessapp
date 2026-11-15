import { initializeApp, getApps, cert, App } from "firebase-admin/app"
import { getFirestore, Firestore } from "firebase-admin/firestore"

/**
 * Server-side Firebase Admin bootstrap.
 *
 * IMPORTANT: this module deliberately does NOT import `firebase-admin/auth`.
 * `firebase-admin/auth` pulls in `jwks-rsa`, which `require()`s the
 * ESM-only `jose` package. On a CommonJS serverless runtime (Vercel
 * Node.js functions) that throws `ERR_REQUIRE_ESM` and takes down every
 * route that touches this module - which is exactly how the production
 * `/api/streak` endpoint started returning 500s. We only need Firestore,
 * and `firebase-admin/firestore` does not pull that chain in.
 *
 * If admin auth is ever needed, add `firebase-admin/auth` back together
 * with a `jose` version that still ships a CommonJS build (see the
 * `overrides` block in package.json).
 */

let adminApp: App | null = null

export class FirebaseAdminError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FirebaseAdminError"
  }
}

export function initFirebaseAdmin(): App {
  if (adminApp) return adminApp

  // Another module may already have initialised the default app.
  const existing = getApps()
  if (existing.length > 0) {
    adminApp = existing[0]
    return adminApp
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  if (!raw) {
    throw new FirebaseAdminError(
      "FIREBASE_SERVICE_ACCOUNT_BASE64 is not set - Firebase Admin cannot start"
    )
  }

  let serviceAccount: Record<string, unknown>
  try {
    serviceAccount = JSON.parse(Buffer.from(raw, "base64").toString("utf8"))
  } catch (e) {
    throw new FirebaseAdminError(
      `FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64-encoded JSON: ${
        e instanceof Error ? e.message : String(e)
      }`
    )
  }

  if (!serviceAccount.project_id || !serviceAccount.client_email) {
    throw new FirebaseAdminError(
      "The Firebase service account is missing project_id or client_email"
    )
  }

  try {
    adminApp = initializeApp({ credential: cert(serviceAccount as any) })
  } catch (e) {
    throw new FirebaseAdminError(
      `Failed to initialise Firebase Admin: ${
        e instanceof Error ? e.message : String(e)
      }`
    )
  }

  return adminApp
}

export function getAdminDb(): Firestore {
  initFirebaseAdmin()
  return getFirestore()
}
