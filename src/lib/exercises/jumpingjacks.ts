import type { ExerciseConfig } from "@/types"
import { baseExercise } from "./base"

export const jumpingjacks: ExerciseConfig = baseExercise({
  id: "jumpingjacks",
  name: "Jumping Jacks",
  trackedLandmarks: [11, 12, 15, 16, 27, 28],
  cameraAngle: "front",
  mirrorFrontCamera: true,
  downThreshold: 150,
  upThreshold: 60,
  repCompletedOn: "down-to-up",
  setupText: "Jump your feet out while raising your arms, then return.",
  phonePlacement: "Front view, phone at chest height, ~2 meters away.",
  distance: "About 2 meters (6 ft) from the phone.",
})
