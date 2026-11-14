import type { ExerciseConfig } from "@/types"
import { baseExercise } from "./base"

export const situps: ExerciseConfig = baseExercise({
  id: "situps",
  name: "Situps",
  trackedLandmarks: [11, 12, 23, 24, 25, 26],
  requiredLandmarks: [11, 12, 23, 24],
  cameraAngle: "side",
  downThreshold: 150,
  upThreshold: 80,
  repCompletedOn: "up-to-down",
  setupText: "Lie back down, then sit all the way up.",
  phonePlacement: "Side view, phone at floor level, ~1 meter away.",
  distance: "About 1 meter (3 ft) from the phone.",
})
