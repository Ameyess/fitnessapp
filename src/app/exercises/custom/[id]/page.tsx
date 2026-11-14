"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  Hash,
  Minus,
  Plus,
  Target,
} from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useProfileLoader } from "@/hooks/useProfile"
import { saveWorkout, todayKey } from "@/lib/db"
import { findCustomExercise, getCustomTarget } from "@/lib/plan"
import { getExercise } from "@/lib/exercises"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import { useProfileStore, writeCache } from "@/store/profile"

interface StreakResponse {
  ok?: boolean
  streak?: number
  longest?: number
  longestStreak?: number
  allCompleted?: boolean
}

export default function CustomExercisePage() {
  const params = useParams()
  const id = (params as any).id as string
  const { user } = useAuth()
  const { profile, loading, error } = useProfileLoader()
  const { add } = useToast()
  const [manualMode, setManualMode] = React.useState(false)
  const [value, setValue] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)
  const [savedCompleted, setSavedCompleted] = React.useState(false)

  const entry = findCustomExercise(profile, id)
  const target = entry ? getCustomTarget(entry) : 0

  React.useEffect(() => {
    if (!entry) return
    setValue(String(getCustomTarget(entry)))
    setManualMode(!entry.trackedExerciseId)
    setSaveError(null)
    setSaved(false)
    setSavedCompleted(false)
    // Deliberately keyed on the entry id: the form must reset when the
    // exercise changes, but not when the profile is patched (e.g. after a
    // log is saved) - that would wipe what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id])

  const tracker = entry?.trackedExerciseId ? getExercise(entry.trackedExerciseId) : undefined

  const saveManualLog = async () => {
    if (!user || !profile || !entry) return
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setSaveError("Enter a valid amount.")
      return
    }

    const amount = Math.floor(parsed)
    const completed = amount >= target
    const date = todayKey(profile.timezone)
    const now = Date.now()
    const reps = entry.type === "rep" ? amount : 0
    const seconds = entry.type === "timed" ? amount : 0
    const goalReps = entry.type === "rep" ? target : 0
    const goalSeconds = entry.type === "timed" ? target : 0

    setSaving(true)
    setSaveError(null)
    try {
      const saved = await saveWorkout({
        userId: user.uid,
        date,
        exerciseId: entry.id,
        reps,
        seconds,
        goalReps,
        goalSeconds,
        completed,
        createdAt: now,
        updatedAt: now,
      })

      const response = await fetch("/api/streak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          date,
          exerciseId: entry.id,
          completed,
        }),
      })
      if (!response.ok) throw new Error("Could not update your streak.")
      const result = (await response.json()) as StreakResponse

      const state = useProfileStore.getState()
      const nextWorkouts = { ...state.workouts, [entry.id]: saved }
      const nextProfile = state.profile
        ? {
            ...state.profile,
            streak: result.streak ?? state.profile.streak,
            longestStreak:
              result.longestStreak ?? result.longest ?? state.profile.longestStreak,
          }
        : null
      state.setWorkouts(nextWorkouts)
      if (nextProfile) {
        state.patchProfile({
          streak: nextProfile.streak,
          longestStreak: nextProfile.longestStreak,
        })
        writeCache(user.uid, { profile: nextProfile, workouts: nextWorkouts })
      }

      setSaved(true)
      setSavedCompleted(completed)
      add({
        type: "success",
        title: completed ? "Goal complete!" : "Workout logged",
        description: completed
          ? "Your daily progress is up to date."
          : "Keep going to reach today's target.",
      })
    } catch (err: any) {
      const message = err?.message ?? "Could not log this workout. Please try again."
      setSaveError(message)
      add({ type: "error", title: "Workout not saved", description: message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div
        data-testid="custom-entry-page"
        className="flex min-h-[calc(100vh-60px)] items-center justify-center"
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-transparent"
          style={{ borderTopColor: "var(--c-primary)" }}
        />
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div
        data-testid="custom-entry-page"
        className="mx-auto flex min-h-[calc(100vh-60px)] max-w-lg flex-col items-center justify-center px-6 text-center"
      >
        <h1 className="mb-2 text-xl font-black" style={{ color: "var(--c-text)" }}>
          Could not load this exercise
        </h1>
        <p className="mb-6 text-sm" style={{ color: "var(--c-muted)" }}>
          {error}
        </p>
        <Link href="/plan">
          <Button variant="primary">Back to my plan</Button>
        </Link>
      </div>
    )
  }

  if (!entry) {
    return (
      <div
        data-testid="custom-entry-page"
        className="mx-auto flex min-h-[calc(100vh-60px)] max-w-lg flex-col items-center justify-center px-6 text-center"
      >
        <div className="mb-4 text-5xl">🔎</div>
        <h1 className="mb-2 text-xl font-black" style={{ color: "var(--c-text)" }}>
          Exercise not found
        </h1>
        <p className="mb-6 max-w-xs text-sm" style={{ color: "var(--c-muted)" }}>
          This custom exercise may have been removed from your plan.
        </p>
        <Link href="/plan">
          <Button variant="primary">Back to my plan</Button>
        </Link>
      </div>
    )
  }

  const unit = entry.type === "rep" ? "reps" : "seconds"
  const parsedValue = Number(value)
  const safeValue = Number.isFinite(parsedValue) ? Math.max(0, Math.floor(parsedValue)) : 0

  return (
    <div data-testid="custom-entry-page" className="min-h-[calc(100vh-60px)] pb-12">
      <main className="mx-auto max-w-lg px-4 py-5">
        <Link
          href="/plan"
          className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-extrabold"
          style={{ color: "var(--c-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          My plan
        </Link>

        {saved ? (
          <motion.section
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl border-2 p-6 text-center"
            style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-primary)" }}
          >
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--c-primary-soft)", color: "var(--c-primary-dark)" }}
            >
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h1 className="text-2xl font-black" style={{ color: "var(--c-text)" }}>
              {savedCompleted ? "Goal complete!" : "Workout logged"}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold" style={{ color: "var(--c-muted)" }}>
              {savedCompleted
                ? `${entry.name} is done for today. Your streak progress has been updated.`
                : `${entry.name} was saved. You can log another set whenever you like.`}
            </p>
            <Link href="/" className="mt-6 block">
              <Button variant="primary" block>
                Back to Home
              </Button>
            </Link>
          </motion.section>
        ) : (
          <>
            <motion.header
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 rounded-3xl border-2 p-5"
              style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
                  style={{ backgroundColor: "var(--c-surface-2)" }}
                >
                  {entry.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-black" style={{ color: "var(--c-text)" }}>
                      {entry.name}
                    </h1>
                    {!entry.enabled && (
                      <span className="badge" style={{ color: "var(--c-muted)" }}>
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-extrabold" style={{ color: "var(--c-primary-dark)" }}>
                    {target} {unit} today
                  </p>
                </div>
              </div>
            </motion.header>

            {entry.trackedExerciseId && tracker && !manualMode && (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border-2 p-5"
                style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
              >
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "var(--c-primary-soft)", color: "var(--c-primary-dark)" }}
                >
                  <Camera className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-black" style={{ color: "var(--c-text)" }}>
                  Count it with your camera
                </h2>
                <p className="mt-1 text-sm font-semibold" style={{ color: "var(--c-muted)" }}>
                  This exercise uses the {tracker.name.toLowerCase()} camera tracker. Your result
                  will be saved to this custom goal.
                </p>
                <Link
                  data-testid="custom-start-camera"
                  href={`/exercises/${entry.trackedExerciseId}/live?log=${entry.id}`}
                  className="mt-5 block"
                >
                  <Button variant="primary" block>
                    <Camera className="h-4 w-4" />
                    Start camera workout
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  block
                  onClick={() => setManualMode(true)}
                  className="mt-3"
                >
                  Log manually instead
                </Button>
              </motion.section>
            )}

            {(!entry.trackedExerciseId || manualMode) && (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border-2 p-5"
                style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: "var(--c-surface-2)", color: "var(--c-primary-dark)" }}
                  >
                    {entry.type === "rep" ? <Hash className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-black" style={{ color: "var(--c-text)" }}>
                      Log manually
                    </h2>
                    <p className="text-xs font-bold" style={{ color: "var(--c-muted)" }}>
                      Target: {target} {unit}
                    </p>
                  </div>
                </div>

                <label className="label" htmlFor="manual-log-input">
                  How many {unit}?
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setValue(String(Math.max(0, safeValue - 1)))}
                    aria-label={`Remove one ${entry.type === "rep" ? "rep" : "second"}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 active:scale-90"
                    style={{ backgroundColor: "var(--c-surface-2)", borderColor: "var(--c-border)", color: "var(--c-muted)" }}
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <input
                    id="manual-log-input"
                    data-testid="manual-log-input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={value}
                    onChange={(event) => {
                      setValue(event.target.value)
                      setSaveError(null)
                    }}
                    onBlur={() => setValue(String(safeValue))}
                    className="input h-12 min-w-0 flex-1 text-center text-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setValue(String(safeValue + 1))}
                    aria-label={`Add one ${entry.type === "rep" ? "rep" : "second"}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 active:scale-90"
                    style={{ backgroundColor: "var(--c-surface-2)", borderColor: "var(--c-border)", color: "var(--c-muted)" }}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                {saveError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-xl px-3 py-2 text-sm font-bold"
                    style={{ color: "var(--c-danger)", backgroundColor: "var(--c-danger-soft)" }}
                  >
                    {saveError}
                  </p>
                )}

                <Button
                  data-testid="manual-log-save"
                  variant="primary"
                  block
                  onClick={() => void saveManualLog()}
                  disabled={saving}
                  className="mt-5"
                >
                  <Target className="h-4 w-4" />
                  {saving ? "Saving…" : "Log it"}
                </Button>

                {entry.trackedExerciseId && (
                  <button
                    type="button"
                    onClick={() => setManualMode(false)}
                    className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-extrabold"
                    style={{ color: "var(--c-muted)" }}
                  >
                    Use the camera tracker instead
                  </button>
                )}
              </motion.section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
