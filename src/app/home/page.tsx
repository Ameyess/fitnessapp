"use client"

import * as React from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { useProfileLoader } from "@/hooks/useProfile"
import { ALL_EXERCISES, type ExerciseId } from "@/types"
import { getExercise } from "@/lib/exercises"
import { ProgressBar, ProgressRing } from "@/components/ui/StreakFlame"
import { Button } from "@/components/ui/Button"
import { motion } from "framer-motion"
import { Play, CheckCircle2, ChevronRight, Dumbbell } from "lucide-react"

export default function HomePage() {
  const { user } = useAuth()
  const { profile, workouts, loading, error } = useProfileLoader()

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-transparent"
          style={{ borderTopColor: "var(--c-primary)" }}
        />
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 text-center">
        <h2 className="mb-2 text-xl font-black" style={{ color: "var(--c-text)" }}>
          Could not load your profile
        </h2>
        <p className="mb-6 max-w-xs text-sm" style={{ color: "var(--c-muted)" }}>
          {error}
        </p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 text-5xl">🎯</div>
        <h2 className="mb-2 text-xl font-black" style={{ color: "var(--c-text)" }}>
          Let&apos;s set up your goals
        </h2>
        <p className="mb-6 max-w-xs text-sm" style={{ color: "var(--c-muted)" }}>
          Pick a daily goal for each exercise to start your streak.
        </p>
        <Link href="/onboarding">
          <Button variant="primary">Start onboarding</Button>
        </Link>
      </div>
    )
  }

  const goals = ALL_EXERCISES.map((exId) => {
    const ex = getExercise(exId)
    const goal = profile.goals[exId]
    const enabled = goal?.enabled ?? true
    const target = ex?.type === "rep" ? (goal?.reps ?? 10) : (goal?.seconds ?? 30)
    const w = workouts[exId]
    const current = ex?.type === "rep" ? (w?.reps ?? 0) : (w?.seconds ?? 0)
    return { exId, ex, enabled, target, current, done: !!w?.completed }
  })

  const activeGoals = goals.filter((g) => g.enabled)
  const doneGoals = activeGoals.filter((g) => g.done)
  const allDone = activeGoals.length > 0 && doneGoals.length === activeGoals.length
  const totalReps = goals.reduce(
    (sum, g) => sum + (g.ex?.type === "rep" ? g.current : 0),
    0
  )

  return (
    <div className="min-h-[calc(100vh-56px)] pb-10">
      <main className="mx-auto max-w-3xl px-4 py-5">
        {/* Streak hero */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 overflow-hidden rounded-3xl border-2"
          style={{
            backgroundColor: "var(--c-surface)",
            borderColor: "var(--c-border)",
          }}
        >
          <div className="flex items-center gap-4 p-5">
            <ProgressRing value={doneGoals.length} max={activeGoals.length || 1} size={92} color="flame">
              <span className="text-2xl leading-none">🔥</span>
              <span
                className="text-2xl font-black tabular-nums leading-none"
                style={{ color: "var(--c-text)" }}
              >
                {profile.streak}
              </span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black leading-tight" style={{ color: "var(--c-text)" }}>
                {profile.streak === 0 ? "Start your streak today!" : "Keep it going!"}
              </h1>
              <p className="text-sm font-bold" style={{ color: "var(--c-muted)" }}>
                {profile.streak} day{profile.streak === 1 ? "" : "s"} in a row · best{" "}
                {profile.longestStreak}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="chip">
                  {doneGoals.length}/{activeGoals.length} goals
                </span>
                <span className="chip">{totalReps} reps today</span>
              </div>
            </div>
          </div>

          {allDone && (
            <div
              className="flex items-center justify-center gap-2 border-t-2 px-4 py-3 text-sm font-extrabold"
              style={{
                backgroundColor: "var(--c-primary-soft)",
                borderColor: "transparent",
                color: "var(--c-primary-dark)",
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> Streak extended! Nice one!
            </div>
          )}
        </motion.section>

        {/* Today's goals */}
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-black" style={{ color: "var(--c-text)" }}>
            Today&apos;s goals
          </h2>
          <div className="space-y-2.5">
            {goals.map((g, i) => (
              <motion.div
                key={g.exId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link href={`/exercises/${g.exId}`}>
                  <div
                    className="flex items-center gap-3 rounded-2xl border-2 p-3.5 transition-colors active:scale-[0.99]"
                    style={{
                      backgroundColor: g.done ? "var(--c-primary-soft)" : "var(--c-surface)",
                      borderColor: g.done ? "transparent" : "var(--c-border)",
                    }}
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{
                        backgroundColor: g.done ? "var(--c-primary)" : "var(--c-surface-2)",
                      }}
                    >
                      {g.done ? "✓" : "🏋️"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
                          {g.ex?.name}
                        </span>
                        <span
                          className="shrink-0 text-xs font-extrabold tabular-nums"
                          style={{ color: g.done ? "var(--c-primary-dark)" : "var(--c-muted)" }}
                        >
                          {g.current}/{g.target}
                        </span>
                      </div>
                      <ProgressBar
                        value={g.current}
                        max={g.target}
                        color={g.done ? "primary" : "flame"}
                      />
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--c-faint)" }} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Quick start */}
        <section>
          <h2 className="mb-3 text-lg font-black" style={{ color: "var(--c-text)" }}>
            Quick start
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {ALL_EXERCISES.map((exId) => {
              const ex = getExercise(exId)
              const done = goals.find((g) => g.exId === exId)?.done
              return (
                <Link key={exId} href={`/exercises/${exId}`}>
                  <div
                    className="flex items-center justify-between rounded-2xl border-2 px-4 py-3 transition-transform active:scale-95"
                    style={{
                      backgroundColor: done ? "var(--c-primary-soft)" : "var(--c-surface)",
                      borderColor: done ? "transparent" : "var(--c-border)",
                    }}
                  >
                    <span className="truncate text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
                      {ex?.name}
                    </span>
                    <Play className="h-4 w-4 shrink-0" style={{ color: "var(--c-primary)" }} />
                  </div>
                </Link>
              )
            })}
          </div>

          <Link href="/history" className="mt-3 block">
            <div
              className="flex items-center justify-between rounded-2xl border-2 px-4 py-3 transition-transform active:scale-95"
              style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
            >
              <span className="flex items-center gap-2 text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
                <Dumbbell className="h-4 w-4" style={{ color: "var(--c-blue)" }} />
                View your progress
              </span>
              <ChevronRight className="h-5 w-5" style={{ color: "var(--c-faint)" }} />
            </div>
          </Link>
        </section>
      </main>
    </div>
  )
}
