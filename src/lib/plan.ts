import type { CustomExercise } from "@/types"

export function getCustomTarget(entry: CustomExercise): number {
  const target = entry.type === "rep" ? entry.reps ?? 0 : entry.seconds ?? 0
  return Math.max(0, target)
}

export function getCustomTargetLabel(entry: CustomExercise): string {
  const unit = entry.type === "rep" ? "reps" : "sec"
  return `${getCustomTarget(entry)} ${unit}`
}

export function getEnabledCustomExercises(
  profile: { customPlan?: CustomExercise[] } | null | undefined
): CustomExercise[] {
  return (profile?.customPlan ?? []).filter((entry) => entry.enabled)
}

export function findCustomExercise(
  profile: { customPlan?: CustomExercise[] } | null | undefined,
  id: string
): CustomExercise | undefined {
  return (profile?.customPlan ?? []).find((entry) => entry.id === id)
}
