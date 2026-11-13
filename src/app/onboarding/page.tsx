"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { setUserProfile, createUserProfile, getUserProfile } from "@/lib/db"
import { ALL_EXERCISES, type ExerciseId } from "@/types"
import { getExercise } from "@/lib/exercises"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { ArrowRight, Clock, RefreshCw } from "lucide-react"

export default function OnboardingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = React.useState(0)
  const [goals, setGoals] = React.useState<Record<ExerciseId, { reps?: number; seconds?: number; enabled: boolean }>>({
    pushups: { reps: 10, enabled: true },
    situps: { reps: 15, enabled: true },
    crunches: { reps: 15, enabled: true },
    squats: { reps: 15, enabled: true },
    jumpingjacks: { reps: 20, enabled: true },
    planks: { seconds: 30, enabled: true },
  } as any)
  const [timezone, setTimezone] = React.useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [rampEnabled, setRampEnabled] = React.useState(true)
  const [restDays, setRestDays] = React.useState<number[]>([])
  const [saving, setSaving] = React.useState(false)

  const exId = ALL_EXERCISES[step]

  const nextStep = () => {
    if (step < ALL_EXERCISES.length - 1) setStep(step + 1)
    else save()
  }

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
      if (existing) {
        await setUserProfile(user.uid, data)
      } else {
        await createUserProfile(user.uid, user.email, user.displayName)
        await setUserProfile(user.uid, data)
      }
      router.push("/home")
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (day: number) => {
    setRestDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  if (step < ALL_EXERCISES.length) {
    const exId = ALL_EXERCISES[step]
    const config = getExercise(exId)
    const g = goals[exId]
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-50 px-4 safe-area-pad-bottom">
        <Header />
        <main className="flex-1 px-4 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Step {step + 1} of {ALL_EXERCISES.length}
              </p>
              <h2 className="text-2xl font-bold text-slate-900">{config?.name ?? exId}</h2>
              <p className="text-slate-500">{config?.setupText ?? ""}</p>
            </div>
            <span className="text-sm text-slate-400">{step + 1} / {ALL_EXERCISES.length}</span>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="label mb-3 block">Daily goal</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                className="input w-24"
                min="0"
                value={g.reps ?? g.seconds ?? 0}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0
                  setGoals({ ...goals, [exId]: { ...g, [config?.type === "rep" ? "reps" : "seconds"]: v, enabled: true } })
                }}
              />
              <span className="text-sm text-slate-500">
                {config?.type === "rep" ? "reps" : "seconds"}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                id={`enabled-${exId}`}
                type="checkbox"
                className="rounded border-slate-300 bg-slate-50 text-emerald-600 focus:ring-emerald-500"
                checked={g.enabled}
                onChange={(e) =>
                  setGoals({ ...goals, [exId]: { ...g, enabled: e.target.checked } })
                }
              />
              <label htmlFor={`enabled-${exId}`} className="text-sm text-slate-600">
                Include in daily streak
              </label>
            </div>
          </div>

          <div className="flex justify-between">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ArrowRight className="w-4 h-4 rotate-180 mr-2" /> Back
              </Button>
            )}
            <Button variant="primary" onClick={nextStep} disabled={saving}>
              {step === ALL_EXERCISES.length - 1 ? "Finish setup" : "Continue"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Preferences step
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-50 px-4 safe-area-pad-bottom">
      <Header />
      <main className="flex-1 px-4 py-6 space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">Almost there</h2>
        <p className="text-slate-500">Pick your preferences.</p>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <label className="label">Timezone</label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. America/New_York" />
          </div>
          <div>
            <label className="label mb-3 block">Ramp up goals automatically</label>
            <div className="flex items-center gap-2">
              <input
                id="ramp"
                type="checkbox"
                className="rounded border-slate-300 bg-slate-50 text-emerald-600 focus:ring-emerald-500"
                checked={rampEnabled}
                onChange={(e) => setRampEnabled(e.target.checked)}
              />
              <label htmlFor="ramp" className="text-sm text-slate-600">
                Goals increase ~5% weekly (you can adjust anytime)
              </label>
            </div>
          </div>
          <div>
            <label className="label mb-3 block">Rest days (don't break streak)</label>
            <p className="text-xs text-slate-400 mb-2">Choose up to 2 days per week</p>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, i) => (
                <button
                  key={d}
                  onClick={() => toggleDay(i)}
                  className={`aspect-square rounded-xl border text-sm font-semibold transition-colors ${
                    restDays.includes(i)
                      ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setStep(ALL_EXERCISES.length - 1)}>
            <ArrowRight className="w-4 h-4 rotate-180 mr-2" /> Back
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            Start streak
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </main>
    </div>
  )
}
