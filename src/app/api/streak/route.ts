import { NextRequest, NextResponse } from "next/server"
import { getAdminDb, initFirebaseAdmin } from "@/lib/firebaseAdmin"

initFirebaseAdmin()

const STREAK_MILESTONES = [7, 30, 100]

function todayKey(timezone: string) {
  return new Date().toLocaleString("en-US", { timeZone: timezone }).split(",")[0]
}

function isRestDay(restDays: number[], dateStr: string) {
  const d = new Date(dateStr + "T00:00:00")
  return restDays.includes(d.getDay())
}

export async function POST(req: NextRequest) {
  const db = getAdminDb()
  const { uid, date, exerciseId, completed } = await req.json()
  if (!uid || !date || !exerciseId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  const userRef = db.collection("users").doc(uid)
  const userSnap = await userRef.get()
  if (!userSnap.exists) {
    return NextResponse.json({ error: "user not found" }, { status: 404 })
  }
  const profile = userSnap.data() as any

  if (isRestDay(profile.restDays ?? [], date)) {
    return NextResponse.json({ ok: true, streak: profile.streak, restDay: true })
  }

  const wSnap = await db
    .collection("workouts")
    .where("userId", "==", uid)
    .where("date", "==", date)
    .get()
  const workouts = wSnap.docs.map((d) => d.data() as any)

  const goals = profile.goals ?? {}
  const exGoals: Record<string, any> = {}
  Object.keys(goals).forEach((k) => { if (goals[k].enabled) exGoals[k] = goals[k] })

  const customPlan = Array.isArray(profile.customPlan) ? profile.customPlan : []
  customPlan.forEach((entry: any) => {
    if (entry?.enabled && entry.id) exGoals[entry.id] = entry
  })

  let allCompleted = Object.keys(exGoals).length > 0
  let anyDone = false
  for (const [ex, g] of Object.entries(exGoals)) {
    const w = workouts.find((x) => x.exerciseId === ex)
    const done = w?.completed ?? false
    if (done) anyDone = true
    else allCompleted = false
  }

  let streak = profile.streak ?? 0
  let longest = profile.longestStreak ?? 0
  const lastActive = profile.lastActiveDate

  if (allCompleted && anyDone) {
    if (lastActive !== date) {
      streak += 1
      if (streak > longest) longest = streak
    }
  } else if (lastActive && lastActive !== date) {
    streak = 0
  }

  const milestones: number[] = [...(profile.milestones ?? [])]
  STREAK_MILESTONES.forEach((m) => {
    if (streak >= m && !milestones.includes(m)) milestones.push(m)
  })

  await userRef.update({
    streak,
    longestStreak: longest,
    lastActiveDate: date,
    milestones,
    updatedAt: Date.now(),
  })

  const dsRef = db.collection("dailyStats").doc(`${uid}_${date}`)
  await dsRef.set(
    {
      uid,
      date,
      allCompleted,
      streak,
      exercises: Object.fromEntries(
        workouts.map((w) => [w.exerciseId, { reps: w.reps, seconds: w.seconds, completed: w.completed }])
      ),
      updatedAt: Date.now(),
    },
    { merge: true }
  )

  return NextResponse.json({ ok: true, streak, longest, allCompleted, milestones })
}

export async function GET(req: NextRequest) {
  const db = getAdminDb()
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get("uid")
  const date = searchParams.get("date")
  if (!uid) return NextResponse.json({ error: "missing uid" }, { status: 400 })
  let q = db.collection("workouts").where("userId", "==", uid)
  if (date) q = q.where("date", "==", date)
  const snap = await q.get()
  return NextResponse.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
}
