"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { setUserProfile, createUserProfile, getUserProfile } from "@/lib/db"
import { ALL_EXERCISES, type ExerciseId } from "@/types"
import { getExercise } from "@/lib/exercises"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { motion } from "framer-motion"
import { ArrowRight, Check } from "lucide-react"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function OnboardingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = React.useState(0)
  const [goals, setGoals] = React.useState<
    Record<ExerciseId, { reps?: number; seconds?: number; enabled: boolean }>
  >({
    pushups: { reps: 10, enabled: true },
    situps: { reps: 15, enabled: true },
    crunches: { reps: 15, enabled: true },
    squats: { reps: 15, enabled: true },
    jumpingjacks: { reps: 20, enabled: true },
    planks: { seconds: 30, enabled: true },
  })
  const [timezone, setTimezone] = React.useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [rampEnabled, setRampEnabled] = React.useState(true)
  const [restDays, setRestDays] = React.useState<number[]>([])
  const [saving, setSaving] = React.useState(false)

  const exId = ALL_EXERCISES[step]
  const config = getExercise(exId)
  const g = goals[exId]
  const isLast = step === ALL_EXERCISES.length - 1

  const save = async () => {
    if (!user) return
    setSaving(true)
    try {
      const existing = await getUserProfile(user.uid)
      const data: any = {
        timezone,
        rampEnabled,
        restDays,
        goals,
        soundEnabled: true,
        hapticsEnabled: true,
      }
      if (existing) await setUserProfile(user.uid, data)
      else {
        await createUserProfile(user.uid, user.email, user.displayName)
        await setUserProfile(user.uid, data)
      }
      router.replace("/")
    } catch (e) {
      console.error(e)
      setSaving(false)
    }
  }

  const toggleDay = (day: number) => {
    setRestDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const value = g.reps ?? g.seconds ?? 0
  const unit = config?.type === "rep" ? "reps" : "seconds"

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      {/* Progress bar */}
      <div className="mb-7">
        <div
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--c-surface-2)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: "var(--c-primary)" }}
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / (ALL_EXERCISES.length + 1)) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {step < ALL_EXERCISES.length ? (
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <h1 className="mb-1 text-2xl font-black tracking-tight" style={{ color: "var(--c-text)" }}>
            {config?.name}
          </h1>
          <p className="mb-6 text-sm font-semibold" style={{ color: "var(--c-muted)" }}>
            {config?.setupText}
          </p>

          <div
            className="mb-5 rounded-3xl border-2 p-5"
            style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
          >
            <label className="label">Daily goal ({unit})</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                className="input w-28 text-center text-xl"
                value={value}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0
                  const key = config?.type === "rep" ? "reps" : "seconds"
                  setGoals({ ...goals, [exId]: { ...g, [key]: v, enabled: true } })
                }}
              />
              <span className="text-sm font-extrabold" style={{ color: "var(--c-muted)" }}>
                {unit} / day
              </span>
            </div>

            <button
              onClick={() =>
                setGoals({ ...goals, [exId]: { ...g, enabled: !g.enabled } })
              }
              className="mt-5 flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-left"
              style={{
                backgroundColor: g.enabled ? "var(--c-primary-soft)" : "var(--c-surface-2)",
                borderColor: g.enabled ? "transparent" : "var(--c-border)",
              }}
            >
              <span className="text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
                Include in daily streak
              </span>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: g.enabled ? "var(--c-primary)" : "transparent",
                  border: g.enabled ? "none" : "2px solid var(--c-border)",
                  color: "#fff",
                }}
              >
                {g.enabled && <Check className="h-4 w-4" />}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button variant="primary" block onClick={() => setStep(step + 1)}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <h1 className="mb-1 text-2xl font-black tracking-tight" style={{ color: "var(--c-text)" }}>
            Almost there!
          </h1>
          <p className="mb-6 text-sm font-semibold" style={{ color: "var(--c-muted)" }}>
            A couple of preferences and you&apos;re ready.
          </p>

          <div
            className="mb-5 space-y-5 rounded-3xl border-2 p-5"
            style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
          >
            <div>
              <label className="label">Timezone</label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. America/New_York"
              />
              <p className="-mt-2 text-xs font-semibold" style={{ color: "var(--c-faint)" }}>
                Used to decide when a new day starts for your streak.
              </p>
            </div>

            <button
              onClick={() => setRampEnabled(!rampEnabled)}
              className="flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-left"
              style={{
                backgroundColor: rampEnabled ? "var(--c-primary-soft)" : "var(--c-surface-2)",
                borderColor: rampEnabled ? "transparent" : "var(--c-border)",
              }}
            >
              <span>
                <span className="block text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
                  Ramp up goals automatically
                </span>
                <span className="block text-xs font-semibold" style={{ color: "var(--c-muted)" }}>
                  +5% each week (you can pause this any time)
                </span>
              </span>
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: rampEnabled ? "var(--c-primary)" : "transparent",
                  border: rampEnabled ? "none" : "2px solid var(--c-border)",
                  color: "#fff",
                }}
              >
                {rampEnabled && <Check className="h-4 w-4" />}
              </span>
            </button>

            <div>
              <label className="label">Rest days (don&apos;t break your streak)</label>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((d, i) => (
                  <button
                    key={d}
                    onClick={() => toggleDay(i)}
                    className="aspect-square rounded-xl border-2 text-xs font-extrabold transition-colors active:scale-95"
                    style={{
                      backgroundColor: restDays.includes(i)
                        ? "var(--c-primary-soft)"
                        : "var(--c-surface-2)",
                      borderColor: restDays.includes(i)
                        ? "var(--c-primary)"
                        : "var(--c-border)",
                      color: restDays.includes(i)
                        ? "var(--c-primary-dark)"
                        : "var(--c-muted)",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs font-semibold" style={{ color: "var(--c-faint)" }}>
                Pick up to 2 days per week.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
            <Button variant="primary" block onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Start my streak"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
