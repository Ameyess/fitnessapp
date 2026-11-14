import type { ExerciseConfig } from "@/types"
import { baseExercise } from "./base"

export const squats: ExerciseConfig = baseExercise({
  id: "squats",
  name: "Squats",
  icon: "🦵",
  trackedLandmarks: [23, 24, 25, 26, 27, 28, 11, 12],
  requiredLandmarks: [11, 12, 23, 24, 25, 26],
  cameraAngle: "side",
  downThreshold: 110,
  upThreshold: 160,
  repCompletedOn: "down-to-up",
  setupText: "Squat down until thighs are parallel, then stand back up.",
  phonePlacement: "Side view, phone at hip level, ~1.5 meters away.",
  distance: "About 1.5 meters (5 ft) from the phone.",
})
