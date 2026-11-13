import type { ExerciseConfig } from "@/types"
import { baseExercise } from "./base"

export const crunches: ExerciseConfig = baseExercise({
  id: "crunches",
  name: "Crunches",
  trackedLandmarks: [11, 12, 23, 24, 25, 26],
  cameraAngle: "side",
  downThreshold: 150,
  upThreshold: 100,
  repCompletedOn: "up-to-down",
  setupText: "Crunch your shoulders up, then lower back down.",
  phonePlacement: "Side view, phone at floor level, ~1 meter away.",
  distance: "About 1 meter (3 ft) from the phone.",
})
