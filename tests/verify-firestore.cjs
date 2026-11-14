/* eslint-disable no-console */
/**
 * Verifies that a signed-in user's profile is actually persisted in
 * Firestore (the original brief flagged "0 documents in the users
 * collection" as an open problem).
 */
const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..")

function loadEnv() {
  const env = {}
  for (const line of fs
    .readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "")
  }
  return env
}

;(async () => {
  const env = loadEnv()
  const sa = JSON.parse(
    Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")
  )
  const { initializeApp, cert } = require("firebase-admin/app")
  const { getFirestore } = require("firebase-admin/firestore")
  initializeApp({ credential: cert(sa) })
  const db = getFirestore()

  const uid = process.argv[2]
  if (!uid) {
    console.log("usage: node tests/verify-firestore.cjs <uid>")
    process.exit(2)
  }

  const usersSnap = await db.collection("users").get()
  console.log(`users collection size: ${usersSnap.size}`)

  const doc = await db.collection("users").doc(uid).get()
  if (!doc.exists) {
    console.log(`FAIL: no profile document for uid ${uid}`)
    process.exit(1)
  }
  const data = doc.data()
  console.log("profile document:", JSON.stringify(data, null, 2))

  const required = [
    "streak",
    "longestStreak",
    "timezone",
    "goals",
    "customPlan",
    "createdAt",
  ]
  const missing = required.filter((k) => data[k] === undefined)
  if (missing.length) {
    console.log(`FAIL: missing fields: ${missing.join(", ")}`)
    process.exit(1)
  }
  if (!Array.isArray(data.customPlan)) {
    console.log(`FAIL: customPlan is not an array: ${JSON.stringify(data.customPlan)}`)
    process.exit(1)
  }
  console.log(
    `PASS: profile persisted with all required fields (customPlan entries: ${data.customPlan.length})`
  )
})().catch((e) => {
  console.error("ERROR:", e)
  process.exit(2)
})
