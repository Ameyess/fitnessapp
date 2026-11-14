import type { ExerciseConfig } from "@/types"
import { baseExercise } from "./base"

export const situps: ExerciseConfig = baseExercise({
  id: "situps",
  name: "Situps",
  icon: "🧘",
  trackedLandmarks: [11, 12, 23, 24, 25, 26],
  requiredLandmarks: [11, 12, 23, 24],
  cameraAngle: "side",
  // Torso elevation off the floor: ~0deg lying, ~80deg fully sat up.
  angleSource: "torsoElevation",
  angleDirection: "increasing",
  downThreshold: 22,
  upThreshold: 58,
  repCompletedOn: "up-to-down",
  setupText: "Lie back down, then sit all the way up.",
  phonePlacement: "Side view, phone at floor level, ~1 meter away.",
  distance: "About 1 meter (3 ft) from the phone.",
})
