import type { ExerciseConfig } from "@/types"
import { pushups } from "./pushups"
import { situps } from "./situps"
import { crunches } from "./crunches"
import { squats } from "./squats"
import { jumpingjacks } from "./jumpingjacks"
import { planks } from "./planks"

export const exerciseRegistry: Record<string, ExerciseConfig> = {
  pushups,
  situps,
  crunches,
  squats,
  jumpingjacks,
  planks,
}

export const getExercise = (id: string): ExerciseConfig | undefined =>
  exerciseRegistry[id]

export const allExercises = (): ExerciseConfig[] =>
  Object.values(exerciseRegistry)

export type { ExerciseConfig }
