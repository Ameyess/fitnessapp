import type { ExerciseConfig } from "@/types"
import { baseExercise } from "./base"

export const pushups: ExerciseConfig = baseExercise({
  id: "pushups",
  name: "Pushups",
  trackedLandmarks: [11, 13, 15, 23, 25, 27, 12, 14, 16, 24, 26, 28],
  cameraAngle: "side",
  downThreshold: 100,
  upThreshold: 160,
  repCompletedOn: "down-to-up",
  setupText: "Lower your chest toward the floor, then push back up to straight arms.",
  phonePlacement: "Side view, phone at floor level, ~1 meter away.",
  distance: "About 1 meter (3 ft) from the phone.",
})
