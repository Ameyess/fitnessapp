import type { ExerciseConfig } from "@/types"
import { baseExercise } from "./base"

export const planks: ExerciseConfig = baseExercise({
  id: "planks",
  name: "Plank",
  type: "timed",
  targetSeconds: 60,
  trackedLandmarks: [11, 12, 23, 24, 25, 26, 27, 28],
  cameraAngle: "side",
  downThreshold: 160,
  upThreshold: 180,
  repCompletedOn: "down-to-up",
  minConfidence: 0.4,
  setupText: "Hold a straight line from head to heels.",
  phonePlacement: "Side view, phone at hip level, ~1 meter away.",
  distance: "About 1 meter (3 ft) from the phone.",
})
