import type { ExerciseConfig } from "@/types"
import { baseExercise } from "./base"

export const jumpingjacks: ExerciseConfig = baseExercise({
  id: "jumpingjacks",
  name: "Jumping Jacks",
  icon: "⭐",
  trackedLandmarks: [11, 12, 15, 16, 27, 28],
  requiredLandmarks: [11, 12, 15, 16],
  cameraAngle: "front",
  mirrorFrontCamera: true,
  // The measured angle is the shoulder -> wrist angle against vertical:
  // arms DOWN at the sides ~= 0deg, arms fully UP ~= 180deg.
  // The thresholds must be ordered so the 60..150deg band is a HYSTERESIS
  // band (the phase is kept while the arms are mid-travel). With the old
  // 150/60 order there was no dead band, so a partial raise to 140deg
  // re-armed the counter and a second raise was counted as another rep.
  downThreshold: 60,
  upThreshold: 150,
  repCompletedOn: "down-to-up",
  setupText: "Jump your feet out while raising your arms, then return.",
  phonePlacement: "Front view, phone at chest height, ~2 meters away.",
  distance: "About 2 meters (6 ft) from the phone.",
})
