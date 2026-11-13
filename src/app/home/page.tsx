"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import { createUserProfile, getUserProfile, getWorkouts, todayKey } from "@/lib/db"
import { ALL_EXERCISES, type ExerciseId, UserProfile } from "@/types"
import { getExercise } from "@/lib/exercises"
import { StreakFlame, ProgressBar } from "@/components/ui/StreakFlame"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { Play, CheckCircle2 } from "lucide-react"

export default function HomePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<Record<ExerciseId, any>>({} as any)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const existing = await getUserProfile(user.uid)
      if (!existing) {
        const created = await createUserProfile(user.uid, user.email, user.displayName)
        setProfile(created)
      } else {
        setProfile(existing)
      }
      const date = todayKey((existing?.timezone ?? tz))
      const logs = await getWorkouts(user.uid, date)
      const byExercise: Record<ExerciseId, any> = {} as any
      logs.forEach((l) => { byExercise[l.exerciseId] = l })
      setWorkouts(byExercise)
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50 px-4">
        <div className="text-slate-500">Loading your streak…</div>
      </div>
    )
  }
  if (!profile) return null

  const date = todayKey(profile.timezone)
  const allDone = Object.values(workouts).every((w) => w.completed)
  const anyDone = Object.values(workouts).some((w) => (w.reps || 0) > 0 || (w.seconds || 0) > 0)

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-50">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 safe-area-pad-top">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💪</span>
            <span className="text-xl font-black text-slate-900 tracking-tight">FitStreak</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StreakFlame count={profile.streak} longest={profile.longestStreak} size="lg" />
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4 safe-area-pad-bottom">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's streak</p>
              <div className="flex items-center gap-2 mt-1">
                <StreakFlame count={profile.streak} longest={profile.longestStreak} size="md" />
                <span className="text-sm text-slate-500">
                  {profile.streak === 0 ? "Start today!" : "Keep it going"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-flame-600">{profile.streak}</span>
              <span className="text-xs text-slate-500">day{profile.streak !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="w-5 h-5 text-flame-500">🔥</span> Today's goals
          </h3>
          <div className="grid gap-3">
            {ALL_EXERCISES.map((exId) => {
              const ex = getExercise(exId)
              const w = workouts[exId]
              const goal = profile.goals[exId]
              const enabled = goal?.enabled ?? true
              const target = ex?.type === "rep" ? (goal?.reps ?? 10) : (goal?.seconds ?? 30)
              const done = w?.completed ?? false
              const current = ex?.type === "rep" ? (w?.reps ?? 0) : (w?.seconds ?? 0)
              return (
                <ExerciseGoalCard key={exId} ex={ex} goal={target} current={current} done={done} enabled={enabled} />
              )
            })}
          </div>
          {allDone && Object.keys(workouts).length > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Nice one! Streak extended!
            </div>
          )}
          {!allDone && anyDone && (
            <p className="text-sm text-slate-500">Keep going to keep your streak alive.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-bold text-slate-900">Quick start</h3>
          <div className="grid grid-cols-2 gap-3">
            {ALL_EXERCISES.map((exId) => {
              const ex = getExercise(exId)
              return (
                <Link key={exId} href={`/exercises/${exId}`} className="block">
                  <Button variant="primary" className="w-full justify-between">
                    <span>{ex?.name}</span>
                    <Play className="w-4 h-4" />
                  </Button>
                </Link>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

interface ExerciseGoalCardProps {
  ex: any
  goal: number
  current: number
  done: boolean
  enabled: boolean
}

function ExerciseGoalCard({ ex, goal, current, done, enabled }: ExerciseGoalCardProps) {
  const pct = Math.min(100, Math.max(0, (current / goal) * 100))
  return (
    <Link href={`/exercises/${ex.id}`} className="group block">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-200 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-900">{ex.name}</span>
          {done && <span className="text-emerald-600 text-xs font-bold">✓ Done</span>}
        </div>
        <ProgressBar value={current} max={goal} color="emerald" />
        <div className="flex justify-between text-xs mt-1">
          <span className="text-slate-500">{current} / {goal}</span>
          <span className="text-slate-400">{enabled ? "active" : "paused"}</span>
        </div>
      </div>
    </Link>
  )
}
