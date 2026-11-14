import type { ExerciseConfig } from "@/types"

export const baseExercise = (overrides: Partial<ExerciseConfig>): ExerciseConfig => ({
  id: "pushups",
  name: "Pushups",
  type: "rep",
  trackedLandmarks: [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28],
  requiredLandmarks: [11, 12, 23, 24],
  cameraAngle: "side",
  mirrorFrontCamera: true,
  downThreshold: 100,
  upThreshold: 160,
  repCompletedOn: "down-to-up",
  minConfidence: 0.5,
  setupText: "Lower your chest to the floor, then push back up.",
  phonePlacement: "Place your phone to your side, about 1 meter away, at floor level.",
  distance: "Stand about 1 meter from the phone.",
  ...overrides,
})
