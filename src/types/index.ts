export type ExerciseId =
  | "pushups"
  | "situps"
  | "crunches"
  | "squats"
  | "jumpingjacks"
  | "planks"

export type RepPhase = "up" | "down" | "holding" | "resting"

export interface ExerciseConfig {
  id: ExerciseId
  name: string
  type: "rep" | "timed"
  /** All landmarks the exercise cares about (used for drawing / angle maths) */
  trackedLandmarks: number[]
  /** The small set that MUST be visible for the pose to count as "in frame".
   *  Kept tight so a slightly cropped foot doesn't block the whole workout. */
  requiredLandmarks: number[]
  cameraAngle: "front" | "side"
  mirrorFrontCamera: boolean
  downThreshold: number
  upThreshold: number
  repCompletedOn: "up-to-down" | "down-to-up"
  targetSeconds?: number
  setupText: string
  phonePlacement: string
  distance: string
  minConfidence: number
}

export interface RepEvent {
  reps: number
  phase: RepPhase
  angle: number
  timestamp: number
}

export interface WorkoutLog {
  id: string
  userId: string
  date: string // YYYY-MM-DD in user timezone
  exerciseId: ExerciseId
  reps: number
  seconds: number
  goalReps: number
  goalSeconds: number
  completed: boolean
  createdAt: number
  updatedAt: number
}

export interface DailyStats {
  date: string
  userId: string
  exercises: Record<
    ExerciseId,
    { reps: number; seconds: number; goalReps: number; goalSeconds: number; completed: boolean }
  >
  allCompleted: boolean
  streakDay: boolean
}

export interface UserProfile {
  uid: string
  email?: string | null
  displayName?: string | null
  photoURL?: string | null
  username?: string
  timezone: string
  locale: string
  goals: Record<ExerciseId, { reps?: number; seconds?: number; enabled: boolean }>
  rampEnabled: boolean
  restDays: number[] // 0=Sun .. 6=Sat
  streak: number
  longestStreak: number
  lastActiveDate?: string
  milestones: number[] // e.g. [7, 30]
  soundEnabled: boolean
  hapticsEnabled: boolean
  darkMode: boolean
  pushToken?: string
  reminderTime?: string // HH:mm local
  reminderEnabled: boolean
  createdAt: number
  updatedAt: number
}

export interface Friend {
  id: string
  userId: string
  friendId: string
  status: "pending" | "accepted" | "declined"
  createdAt: number
}

export interface LeaderboardEntry {
  uid: string
  displayName: string
  photoURL?: string | null
  streak: number
  weeklyReps: number
}

export interface Milestone {
  days: number
  label: string
}

export const STREAK_MILESTONES: Milestone[] = [
  { days: 7, label: "Week Warrior" },
  { days: 30, label: "Month Master" },
  { days: 100, label: "Century Club" },
]

export const ALL_EXERCISES: ExerciseId[] = [
  "pushups",
  "situps",
  "crunches",
  "squats",
  "jumpingjacks",
  "planks",
]
