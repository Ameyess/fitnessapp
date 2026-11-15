import { NextRequest, NextResponse } from "next/server"
import { getAdminDb } from "@/lib/firebaseAdmin"

const STREAK_MILESTONES = [7, 30, 100]

/**
 * The app stores "day keys" as `M/D/YYYY` (the output of
 * `toLocaleString("en-US").split(",")[0]`), so every date helper here
 * parses that format explicitly. Passing it to `new Date()` would produce
 * an Invalid Date and silently disable the rest-day check.
 */
function parseDay(dateStr: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dateStr ?? "").trim())
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])))
  return Number.isNaN(d.getTime()) ? null : d
}

function dayOfWeek(dateStr: string): number {
  const d = parseDay(dateStr)
  return d ? d.getUTCDay() : -1
}

function isRestDay(restDays: number[], dateStr: string): boolean {
  const dow = dayOfWeek(dateStr)
  return dow >= 0 && restDays.includes(dow)
}

/**
 * How many NON-rest days the user skipped between two days.
 *
 * `0` means the two days are consecutive in the streak chain, so the
 * streak should continue. Anything higher means the chain was broken and
 * the streak restarts at 1.
 */
function missedActiveDays(from: string, to: string, restDays: number[]): number {
  const a = parseDay(from)
  const b = parseDay(to)
  if (!a || !b) return 0
  if (a.getTime() >= b.getTime()) return 0

  let missed = 0
  const cur = new Date(a.getTime())
  cur.setUTCDate(cur.getUTCDate() + 1)
  while (cur.getTime() < b.getTime()) {
    if (!restDays.includes(cur.getUTCDay())) missed += 1
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return missed
}

function getAdminDbOr503() {
  try {
    return { db: getAdminDb(), error: null as null | NextResponse }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("Firebase Admin unavailable:", message)
    return {
      db: null,
      error: NextResponse.json(
        { ok: false, error: "streak service unavailable" },
        { status: 503 }
      ),
    }
  }
}

export async function POST(req: NextRequest) {
  const { db, error: initError } = getAdminDbOr503()
  if (initError) return initError
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "streak service unavailable" },
      { status: 503 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 })
  }

  const { uid, date, exerciseId, completed } = body ?? {}
  if (!uid || !date || !exerciseId) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 })
  }

  try {
    const userRef = db.collection("users").doc(uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 })
    }
    const profile = userSnap.data() as any
    const restDays: number[] = Array.isArray(profile.restDays) ? profile.restDays : []

    if (isRestDay(restDays, date)) {
      return NextResponse.json({
        ok: true,
        streak: profile.streak ?? 0,
        longest: profile.longestStreak ?? 0,
        allCompleted: false,
        restDay: true,
      })
    }

    const wSnap = await db
      .collection("workouts")
      .where("userId", "==", uid)
      .where("date", "==", date)
      .get()
    const workouts = wSnap.docs.map((d) => d.data() as any)

    const goals = profile.goals ?? {}
    const exGoals: Record<string, any> = {}
    Object.keys(goals).forEach((k) => {
      if (goals[k]?.enabled) exGoals[k] = goals[k]
    })

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

    // Has today already been counted? The daily-stats document records the
    // outcome of the previous call, so a second call on the same day must
    // not increment the streak again.
    const dsRef = db.collection("dailyStats").doc(`${uid}_${date}`)
    const dsSnap = await dsRef.get()
    const dayStats = dsSnap.exists ? (dsSnap.data() as any) : null
    const alreadyCountedToday = dayStats?.allCompleted === true

    let streak = profile.streak ?? 0
    let longest = profile.longestStreak ?? 0
    const lastCompleted: string | null = profile.lastCompletedDate ?? null
    const lastActive: string | null = profile.lastActiveDate ?? null

    if (allCompleted && anyDone && !alreadyCountedToday) {
      // `lastCompletedDate` is the day the streak was last extended.
      // Legacy profiles only have `lastActiveDate`, which is a good enough
      // approximation for the first completed day after the upgrade.
      const ref = lastCompleted ?? lastActive
      const missed = ref && ref !== date ? missedActiveDays(ref, date, restDays) : 0
      // A missed day breaks the chain: the streak restarts at 1.
      streak = missed === 0 ? (streak > 0 ? streak + 1 : 1) : 1
      if (streak > longest) longest = streak
    }

    // An incomplete day does NOT break the streak. The user can still
    // finish their goals later the same day; the chain is broken lazily
    // the next time a day IS completed.

    const milestones: number[] = [...(profile.milestones ?? [])]
    STREAK_MILESTONES.forEach((m) => {
      if (streak >= m && !milestones.includes(m)) milestones.push(m)
    })

    const update: Record<string, unknown> = {
      streak,
      longestStreak: longest,
      lastActiveDate: date,
      milestones,
      updatedAt: Date.now(),
    }
    if (allCompleted && anyDone) update.lastCompletedDate = date

    await userRef.update(update)

    await dsRef.set(
      {
        uid,
        date,
        allCompleted,
        streak,
        exercises: Object.fromEntries(
          workouts.map((w) => [
            w.exerciseId,
            { reps: w.reps, seconds: w.seconds, completed: w.completed },
          ])
        ),
        updatedAt: Date.now(),
      },
      { merge: true }
    )

    return NextResponse.json({
      ok: true,
      streak,
      longest,
      allCompleted,
      restDay: false,
      milestones,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("streak update failed:", message)
    return NextResponse.json(
      { ok: false, error: "streak update failed" },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const { db, error: initError } = getAdminDbOr503()
  if (initError) return initError
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "streak service unavailable" },
      { status: 503 }
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const uid = searchParams.get("uid")
    const date = searchParams.get("date")
    if (!uid) {
      return NextResponse.json({ ok: false, error: "missing uid" }, { status: 400 })
    }
    let q = db.collection("workouts").where("userId", "==", uid)
    if (date) q = q.where("date", "==", date)
    const snap = await q.get()
    return NextResponse.json(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("streak read failed:", message)
    return NextResponse.json(
      { ok: false, error: "streak read failed" },
      { status: 500 }
    )
  }
}
