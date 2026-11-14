import type { ExerciseConfig } from "@/types"
import { baseExercise } from "./base"

export const crunches: ExerciseConfig = baseExercise({
  id: "crunches",
  name: "Crunches",
  icon: "🤸",
  trackedLandmarks: [11, 12, 23, 24, 25, 26],
  requiredLandmarks: [11, 12, 23, 24],
  cameraAngle: "side",
  // Torso elevation off the floor: ~0deg lying, ~40deg crunched up.
  angleSource: "torsoElevation",
  angleDirection: "increasing",
  downThreshold: 16,
  upThreshold: 32,
  repCompletedOn: "up-to-down",
  setupText: "Crunch your shoulders up, then lower back down.",
  phonePlacement: "Side view, phone at floor level, ~1 meter away.",
  distance: "About 1 meter (3 ft) from the phone.",
})
