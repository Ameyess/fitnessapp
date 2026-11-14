"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Check,
  Clock3,
  Hash,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useProfileLoader } from "@/hooks/useProfile"
import { saveCustomPlan, setUserProfile } from "@/lib/db"
import { getCustomTarget, getCustomTargetLabel } from "@/lib/plan"
import { ALL_EXERCISES, type CustomExercise, type ExerciseId } from "@/types"
import { getExercise } from "@/lib/exercises"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import { useProfileStore, writeCache } from "@/store/profile"

const CUSTOM_ICONS = [
  "🏋️",
  "💪",
  "🏃",
  "🚶",
  "🧘",
  "🏊",
  "🚴",
  "🤸",
  "🪢",
  "🤾",
  "⛹️",
  "🌟",
]

interface CustomFormState {
  name: string
  icon: string
  type: CustomExercise["type"]
  target: string
  trackedExerciseId: ExerciseId | ""
}

const EMPTY_CUSTOM_FORM: CustomFormState = {
  name: "",
  icon: CUSTOM_ICONS[0],
  type: "rep",
  target: "10",
  trackedExerciseId: "",
}

function createCustomExerciseId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `custom-${crypto.randomUUID()}`
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function PlanPage() {
  const { user } = useAuth()
  const { profile, workouts, loading, error } = useProfileLoader()
  const { add } = useToast()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<CustomFormState>({ ...EMPTY_CUSTOM_FORM })
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [builtinTargets, setBuiltinTargets] = React.useState<
    Partial<Record<ExerciseId, string>>
  >({})

  React.useEffect(() => {
    if (!profile) return
    const next: Partial<Record<ExerciseId, string>> = {}
    ALL_EXERCISES.forEach((exId) => {
      const config = getExercise(exId)
      const goal = profile.goals?.[exId]
      const target =
        config?.type === "rep"
          ? goal?.reps ?? 10
          : goal?.seconds ?? config?.targetSeconds ?? 30
      next[exId] = String(target)
    })
    setBuiltinTargets(next)
    // Deliberately keyed on `profile.goals` and not on `profile`: an
    // unrelated profile change (e.g. the streak ticking up) must not
    // overwrite a target the user is currently editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.goals])

  if (loading) {
    return (
      <div
        data-testid="plan-page"
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
        data-testid="plan-page"
        className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center px-6 text-center"
      >
        <h2 className="mb-2 text-xl font-black" style={{ color: "var(--c-text)" }}>
          Could not load your plan
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
      <div
        data-testid="plan-page"
        className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center px-6 text-center"
      >
        <div className="mb-4 text-5xl">📋</div>
        <h2 className="mb-2 text-xl font-black" style={{ color: "var(--c-text)" }}>
          Your plan is waiting
        </h2>
        <p className="mb-6 max-w-xs text-sm" style={{ color: "var(--c-muted)" }}>
          Finish onboarding first, then you can build your daily goals here.
        </p>
        <Link href="/onboarding">
          <Button variant="primary">Start onboarding</Button>
        </Link>
      </div>
    )
  }

  const customPlan = profile.customPlan ?? []
  const completedToday = new Set(
    Object.values(workouts)
      .filter((workout: any) => workout?.completed)
      .map((workout: any) => workout.exerciseId)
  )

  const saveGoals = async (goals: typeof profile.goals, showSuccess = false) => {
    if (!user) return false
    const previousGoals = useProfileStore.getState().profile?.goals ?? profile.goals
    useProfileStore.getState().patchProfile({ goals })
    try {
      await setUserProfile(user.uid, { goals })
      const state = useProfileStore.getState()
      if (state.profile) {
        writeCache(user.uid, { profile: state.profile, workouts: state.workouts })
      }
      if (showSuccess) {
        add({ type: "success", title: "Plan updated", description: "Your daily goals were saved." })
      }
      return true
    } catch (err: any) {
      useProfileStore.getState().patchProfile({ goals: previousGoals })
      add({
        type: "error",
        title: "Could not save your plan",
        description: err?.message ?? "Please try again.",
      })
      return false
    }
  }

  const saveBuiltinTarget = async (exId: ExerciseId) => {
    const config = getExercise(exId)
    if (!config || !user) return
    const parsed = Number(builtinTargets[exId])
    const target = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1
    setBuiltinTargets((current) => ({ ...current, [exId]: String(target) }))

    const currentGoals = useProfileStore.getState().profile?.goals ?? profile.goals
    const currentGoal = currentGoals[exId]
    const enabled = currentGoal?.enabled ?? true
    const nextGoal =
      config.type === "rep"
        ? { reps: target, enabled }
        : { seconds: target, enabled }
    const goals = { ...currentGoals, [exId]: nextGoal }
    await saveGoals(goals)
  }

  const toggleBuiltin = async (exId: ExerciseId) => {
    const config = getExercise(exId)
    if (!config || !user) return
    const currentGoals = useProfileStore.getState().profile?.goals ?? profile.goals
    const currentGoal = currentGoals[exId]
    const enabled = !(currentGoal?.enabled ?? true)
    const nextGoal =
      config.type === "rep"
        ? { reps: currentGoal?.reps ?? 10, enabled }
        : { seconds: currentGoal?.seconds ?? config.targetSeconds ?? 30, enabled }
    const goals = { ...currentGoals, [exId]: nextGoal }
    await saveGoals(goals, true)
  }

  const persistCustomPlan = async (
    nextPlan: CustomExercise[],
    successTitle: string
  ): Promise<boolean> => {
    if (!user) return false
    const previousPlan = useProfileStore.getState().profile?.customPlan ?? profile.customPlan ?? []
    useProfileStore.getState().patchProfile({ customPlan: nextPlan })
    try {
      await saveCustomPlan(user.uid, nextPlan)
      const state = useProfileStore.getState()
      if (state.profile) {
        writeCache(user.uid, { profile: state.profile, workouts: state.workouts })
      }
      add({ type: "success", title: successTitle })
      return true
    } catch (err: any) {
      useProfileStore.getState().patchProfile({ customPlan: previousPlan })
      add({
        type: "error",
        title: "Could not save your plan",
        description: err?.message ?? "Please try again.",
      })
      return false
    }
  }

  const resetForm = () => {
    setForm({ ...EMPTY_CUSTOM_FORM })
    setFormError(null)
    setEditingId(null)
    setFormOpen(false)
  }

  const openAddForm = () => {
    setForm({ ...EMPTY_CUSTOM_FORM })
    setFormError(null)
    setEditingId(null)
    setFormOpen(true)
  }

  const openEditForm = (entry: CustomExercise) => {
    setForm({
      name: entry.name,
      icon: entry.icon,
      type: entry.type,
      target: String(getCustomTarget(entry)),
      trackedExerciseId: entry.trackedExerciseId ?? "",
    })
    setFormError(null)
    setEditingId(entry.id)
    setFormOpen(true)
    setDeleteId(null)
  }

  const saveCustomExercise = async () => {
    if (!user) return
    const name = form.name.trim()
    const parsedTarget = Number(form.target)
    const target = Number.isFinite(parsedTarget) ? Math.floor(parsedTarget) : 0

    if (!name) {
      setFormError("Give your exercise a name.")
      return
    }
    if (name.length > 40) {
      setFormError("Exercise names can be up to 40 characters.")
      return
    }
    if (target < 1) {
      setFormError("Your target must be at least 1.")
      return
    }

    const currentPlan = useProfileStore.getState().profile?.customPlan ?? customPlan
    const existing = editingId
      ? currentPlan.find((entry) => entry.id === editingId)
      : undefined
    const entry: CustomExercise = {
      id: existing?.id ?? createCustomExerciseId(),
      name,
      icon: form.icon,
      type: form.type,
      enabled: existing?.enabled ?? true,
      ...(form.type === "rep" ? { reps: target } : { seconds: target }),
      ...(form.trackedExerciseId ? { trackedExerciseId: form.trackedExerciseId } : {}),
    }
    const nextPlan = existing
      ? currentPlan.map((item) => (item.id === existing.id ? entry : item))
      : [...currentPlan, entry]

    setSaving(true)
    const saved = await persistCustomPlan(
      nextPlan,
      existing ? "Exercise updated" : "Exercise added"
    )
    setSaving(false)
    if (saved) resetForm()
  }

  const toggleCustom = async (entry: CustomExercise) => {
    const currentPlan = useProfileStore.getState().profile?.customPlan ?? customPlan
    const nextPlan = currentPlan.map((item) =>
      item.id === entry.id ? { ...item, enabled: !item.enabled } : item
    )
    await persistCustomPlan(nextPlan, "Plan updated")
  }

  const deleteCustom = async (entry: CustomExercise) => {
    const currentPlan = useProfileStore.getState().profile?.customPlan ?? customPlan
    const nextPlan = currentPlan.filter((item) => item.id !== entry.id)
    const saved = await persistCustomPlan(nextPlan, "Exercise deleted")
    if (saved) setDeleteId(null)
  }

  return (
    <div data-testid="plan-page" className="min-h-[calc(100vh-60px)] pb-12">
      <main className="mx-auto max-w-3xl px-4 py-5">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <div className="mb-2 flex items-center gap-2">
            <ListChecks className="h-6 w-6" style={{ color: "var(--c-primary-text)" }} />
            <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--c-text)" }}>
              My plan
            </h1>
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--c-muted)" }}>
            Choose what you do each day, set your targets, and make the plan your own.
          </p>
        </motion.header>

        <section className="mb-7">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black" style={{ color: "var(--c-text)" }}>
                Built-in exercises
              </h2>
              <p className="text-xs font-semibold" style={{ color: "var(--c-muted)" }}>
                Toggle exercises on or off and adjust their daily targets.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {ALL_EXERCISES.map((exId, index) => {
              const config = getExercise(exId)
              if (!config) return null
              const goal = profile.goals?.[exId]
              const enabled = goal?.enabled ?? true
              const target =
                config.type === "rep"
                  ? goal?.reps ?? 10
                  : goal?.seconds ?? config.targetSeconds ?? 30
              const unit = config.type === "rep" ? "reps" : "sec"

              return (
                <motion.div
                  key={exId}
                  data-testid={`builtin-item-${exId}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-2 rounded-2xl border-2 p-3"
                  style={{
                    backgroundColor: enabled ? "var(--c-surface)" : "var(--c-surface-2)",
                    borderColor: "var(--c-border)",
                  }}
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: "var(--c-surface-2)" }}
                  >
                    {config.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-extrabold"
                      style={{ color: enabled ? "var(--c-text)" : "var(--c-muted)" }}
                    >
                      {config.name}
                    </p>
                    <p className="text-[11px] font-bold" style={{ color: "var(--c-faint)" }}>
                      {completedToday.has(exId) ? "Done today" : `${unit} per day`}
                    </p>
                  </div>
                  <label className="sr-only" htmlFor={`builtin-target-${exId}`}>
                    {config.name} daily target
                  </label>
                  <input
                    id={`builtin-target-${exId}`}
                    data-testid={`builtin-target-${exId}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={builtinTargets[exId] ?? String(target)}
                    onChange={(event) =>
                      setBuiltinTargets((current) => ({
                        ...current,
                        [exId]: event.target.value,
                      }))
                    }
                    onBlur={() => void saveBuiltinTarget(exId)}
                    className="input h-11 w-16 shrink-0 px-1 text-center text-base"
                    style={{ color: "var(--c-text)" }}
                  />
                  <button
                    data-testid={`builtin-toggle-${exId}`}
                    type="button"
                    onClick={() => void toggleBuiltin(exId)}
                    aria-label={`${enabled ? "Disable" : "Enable"} ${config.name}`}
                    aria-pressed={enabled}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl active:scale-90"
                    style={{
                      backgroundColor: enabled ? "var(--c-primary)" : "var(--c-surface-2)",
                      border: `2px solid ${enabled ? "var(--c-primary)" : "var(--c-border)"}`,
                      color: enabled ? "var(--c-text)" : "var(--c-faint)",
                    }}
                  >
                    {enabled && <Check className="h-5 w-5" strokeWidth={3} />}
                  </button>
                </motion.div>
              )
            })}
          </div>
        </section>

        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black" style={{ color: "var(--c-text)" }}>
                Your custom exercises
              </h2>
              <p className="text-xs font-semibold" style={{ color: "var(--c-muted)" }}>
                Add any movement you want and track it with your camera or manually.
              </p>
            </div>
            <Button
              data-testid="custom-add-open"
              variant="primary"
              size="sm"
              onClick={openAddForm}
              className="shrink-0 px-3"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {customPlan.length === 0 ? (
            <div
              className="rounded-2xl border-2 border-dashed px-5 py-8 text-center"
              style={{ borderColor: "var(--c-border)", backgroundColor: "var(--c-surface)" }}
            >
              <div className="mb-3 text-4xl">✨</div>
              <h3 className="text-base font-black" style={{ color: "var(--c-text)" }}>
                Make this plan yours
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm font-semibold" style={{ color: "var(--c-muted)" }}>
                No custom exercises yet. Add one like jumping rope, stretching, or a walk.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={openAddForm}
                className="mt-4"
              >
                <Plus className="h-4 w-4" />
                Add your first exercise
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {customPlan.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  data-testid={`custom-item-${entry.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-2xl border-2 p-3"
                  style={{
                    backgroundColor: entry.enabled ? "var(--c-surface)" : "var(--c-surface-2)",
                    borderColor: "var(--c-border)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ backgroundColor: "var(--c-surface-2)" }}
                    >
                      {entry.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/exercises/custom/${entry.id}`}
                        className="flex min-h-11 items-center truncate text-sm font-extrabold"
                        style={{ color: entry.enabled ? "var(--c-text)" : "var(--c-muted)" }}
                      >
                        {entry.name}
                      </Link>
                      <p className="text-[11px] font-bold" style={{ color: "var(--c-faint)" }}>
                        {getCustomTargetLabel(entry)}
                        {entry.trackedExerciseId ? " · camera" : " · manual"}
                        {completedToday.has(entry.id) ? " · done today" : ""}
                      </p>
                    </div>
                    <button
                      data-testid={`custom-toggle-${entry.id}`}
                      type="button"
                      onClick={() => void toggleCustom(entry)}
                      aria-label={`${entry.enabled ? "Disable" : "Enable"} ${entry.name}`}
                      aria-pressed={entry.enabled}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl active:scale-90"
                      style={{
                        backgroundColor: entry.enabled ? "var(--c-primary)" : "var(--c-surface-2)",
                        border: `2px solid ${entry.enabled ? "var(--c-primary)" : "var(--c-border)"}`,
                        color: entry.enabled ? "var(--c-text)" : "var(--c-faint)",
                      }}
                    >
                      {entry.enabled && <Check className="h-5 w-5" strokeWidth={3} />}
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2" style={{ borderColor: "var(--c-border)" }}>
                    <button
                      data-testid={`custom-edit-${entry.id}`}
                      type="button"
                      onClick={() => openEditForm(entry)}
                      aria-label={`Edit ${entry.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl active:scale-90"
                      style={{ color: "var(--c-blue-text)", backgroundColor: "var(--c-surface-2)" }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      data-testid={`custom-delete-${entry.id}`}
                      type="button"
                      onClick={() => setDeleteId(entry.id)}
                      aria-label={`Delete ${entry.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl active:scale-90"
                      style={{ color: "var(--c-danger)", backgroundColor: "var(--c-danger-soft)" }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {deleteId === entry.id && (
                    <div
                      className="mt-2 rounded-xl p-3"
                      style={{ backgroundColor: "var(--c-danger-soft)" }}
                    >
                      <p className="mb-2 text-sm font-extrabold" style={{ color: "var(--c-danger)" }}>
                        Delete “{entry.name}”?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          data-testid="custom-delete-confirm"
                          onClick={() => void deleteCustom(entry)}
                          className="px-3"
                        >
                          Delete
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(null)}
                          className="px-3"
                        >
                          Keep it
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {formOpen && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border-2 p-4 sm:p-5"
            style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black" style={{ color: "var(--c-text)" }}>
                {editingId ? "Edit exercise" : "New custom exercise"}
              </h2>
              <button
                data-testid="custom-cancel"
                type="button"
                onClick={resetForm}
                aria-label="Cancel"
                className="flex h-11 w-11 items-center justify-center rounded-xl active:scale-90"
                style={{ color: "var(--c-muted)", backgroundColor: "var(--c-surface-2)" }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="label" htmlFor="custom-name">
                  Exercise name
                </label>
                <input
                  id="custom-name"
                  data-testid="custom-name-input"
                  type="text"
                  value={form.name}
                  maxLength={40}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, name: event.target.value }))
                    setFormError(null)
                  }}
                  placeholder="e.g. Jumping rope"
                  className="input"
                />
              </div>

              <div>
                <span className="label">Icon</span>
                <div className="grid grid-cols-5 gap-1 sm:grid-cols-6">
                  {CUSTOM_ICONS.map((icon) => (
                    <button
                      key={icon}
                      data-testid={`custom-icon-${icon}`}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, icon }))}
                      aria-label={`Use ${icon} icon`}
                      aria-pressed={form.icon === icon}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border-2 text-xl active:scale-90"
                      style={{
                        backgroundColor: form.icon === icon ? "var(--c-primary-soft)" : "var(--c-surface-2)",
                        borderColor: form.icon === icon ? "var(--c-primary)" : "var(--c-border)",
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="label">How do you count it?</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    data-testid="custom-type-rep"
                    type="button"
                    onClick={() => {
                      setForm((current) => ({ ...current, type: "rep" }))
                      setFormError(null)
                    }}
                    aria-pressed={form.type === "rep"}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 px-3 font-extrabold active:scale-[0.98]"
                    style={{
                      backgroundColor: form.type === "rep" ? "var(--c-primary-soft)" : "var(--c-surface-2)",
                      borderColor: form.type === "rep" ? "var(--c-primary)" : "var(--c-border)",
                      color: form.type === "rep" ? "var(--c-primary-dark)" : "var(--c-muted)",
                    }}
                  >
                    <Hash className="h-4 w-4" />
                    Reps
                  </button>
                  <button
                    data-testid="custom-type-timed"
                    type="button"
                    onClick={() => {
                      setForm((current) => ({ ...current, type: "timed" }))
                      setFormError(null)
                    }}
                    aria-pressed={form.type === "timed"}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 px-3 font-extrabold active:scale-[0.98]"
                    style={{
                      backgroundColor: form.type === "timed" ? "var(--c-primary-soft)" : "var(--c-surface-2)",
                      borderColor: form.type === "timed" ? "var(--c-primary)" : "var(--c-border)",
                      color: form.type === "timed" ? "var(--c-primary-dark)" : "var(--c-muted)",
                    }}
                  >
                    <Clock3 className="h-4 w-4" />
                    Time
                  </button>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="custom-target">
                  Daily target ({form.type === "rep" ? "reps" : "seconds"})
                </label>
                <input
                  id="custom-target"
                  data-testid="custom-target-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={form.target}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, target: event.target.value }))
                    setFormError(null)
                  }}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor="custom-tracked">
                  Track with camera <span style={{ color: "var(--c-faint)" }}>(optional)</span>
                </label>
                <select
                  id="custom-tracked"
                  data-testid="custom-tracked-select"
                  value={form.trackedExerciseId}
                  onChange={(event) => {
                    const trackedExerciseId = event.target.value as ExerciseId | ""
                    const tracked = trackedExerciseId ? getExercise(trackedExerciseId) : undefined
                    setForm((current) => ({
                      ...current,
                      trackedExerciseId,
                      ...(tracked ? { type: tracked.type } : {}),
                    }))
                    setFormError(null)
                  }}
                  className="input"
                >
                  <option value="">Log manually</option>
                  {ALL_EXERCISES.map((exId) => {
                    const config = getExercise(exId)
                    if (!config) return null
                    return (
                      <option key={exId} value={exId}>
                        {config.name} ({config.type === "rep" ? "reps" : "timed"})
                      </option>
                    )
                  })}
                </select>
                <p className="mt-1.5 text-xs font-semibold" style={{ color: "var(--c-faint)" }}>
                  Choose a similar camera movement to count automatically.
                </p>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="rounded-xl px-3 py-2 text-sm font-bold"
                  style={{ color: "var(--c-danger)", backgroundColor: "var(--c-danger-soft)" }}
                >
                  {formError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={resetForm} className="sm:min-w-28">
                  Cancel
                </Button>
                <Button
                  data-testid="custom-save"
                  variant="primary"
                  onClick={() => void saveCustomExercise()}
                  disabled={saving}
                  className="sm:min-w-32"
                >
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add exercise"}
                </Button>
              </div>
            </div>
          </motion.section>
        )}
      </main>
    </div>
  )
}
