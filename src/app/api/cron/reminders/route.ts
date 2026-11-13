import { NextRequest, NextResponse } from "next/server"
import { getAdminDb, initFirebaseAdmin } from "@/lib/firebaseAdmin"

initFirebaseAdmin()

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const db = getAdminDb()
  const now = new Date()
  const usersSnap = await db.collection("users").get()
  const batch = db.batch()

  for (const uDoc of usersSnap.docs) {
    const profile: any = uDoc.data()
    if (!profile.reminderEnabled || !profile.reminderTime) continue

    const tz = profile.timezone ?? "UTC"
    const date = now.toLocaleString("en-US", { timeZone: tz }).split(",")[0]

    const local = now.toLocaleString("en-US", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    })
    const parts = local.split(/[^\d]/).filter(Boolean).map(Number)
    const [lh, lm] = parts
    const [rh, rm] = profile.reminderTime.split(":").map(Number)
    if (lh !== rh || lm !== rm) continue

    const wSnap = await db
      .collection("workouts")
      .where("userId", "==", uDoc.id)
      .where("date", "==", date)
      .get()
    const goals = profile.goals ?? {}
    let allDone = true
    for (const [ex, g] of Object.entries(goals)) {
      if (!(g as any).enabled) continue
      const w = wSnap.docs.find((d) => (d.data() as any).exerciseId === ex)
      if (!(w && (w.data() as any).completed)) { allDone = false; break }
    }
    if (allDone) continue

    batch.set(db.collection("reminderLogs").doc(), {
      userId: uDoc.id,
      date,
      sentAt: Date.now(),
    })
  }

  await batch.commit()
  return NextResponse.json({ ok: true })
}
