import { create } from "zustand"
import type { ExerciseId, ExerciseConfig, WorkoutLog } from "@/types"
import { getExercise } from "@/lib/exercises"

interface WorkoutState {
  exerciseId: ExerciseId | null
  config: ExerciseConfig | null
  reps: number
  seconds: number
  phase: "up" | "down" | "holding" | "resting"
  angle: number | null
  inFrame: boolean
  isActive: boolean
  isPaused: boolean
  isCompleted: boolean
  startTime: number | null
  lastRepTime: number | null
  manualReps: number
  holdStart: number | null

  setExercise: (id: ExerciseId) => void
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  complete: () => void
  setReps: (reps: number) => void
  syncReps: (reps: number) => void
  setSeconds: (seconds: number) => void
  addRep: () => void
  subtractRep: () => void
  tick: (now: number) => void
  setFrame: (inFrame: boolean, angle: number | null, phase: string) => void
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  exerciseId: null,
  config: null,
  reps: 0,
  seconds: 0,
  phase: "resting",
  angle: null,
  inFrame: false,
  isActive: false,
  isPaused: false,
  isCompleted: false,
  startTime: null,
  lastRepTime: null,
  manualReps: 0,
  holdStart: null,

  setExercise: (id) => {
    const config = getExercise(id)
    set({
      exerciseId: id,
      config: config ?? null,
      reps: 0,
      seconds: 0,
      phase: "resting",
      angle: null,
      inFrame: false,
      isActive: false,
      isPaused: false,
      isCompleted: false,
      startTime: null,
      lastRepTime: null,
      manualReps: 0,
      holdStart: null,
    })
  },

  start: () =>
    set({
      isActive: true,
      isPaused: false,
      startTime: Date.now(),
      holdStart: null,
    }),

  pause: () => set({ isPaused: true }),
  resume: () => set({ isPaused: false }),

  reset: () =>
    set({
      reps: 0,
      seconds: 0,
      phase: "resting",
      angle: null,
      inFrame: false,
      isActive: false,
      isPaused: false,
      isCompleted: false,
      startTime: null,
      lastRepTime: null,
      holdStart: null,
    }),

  complete: () => set({ isCompleted: true, isActive: false }),

  setReps: (reps) => set({ reps, manualReps: reps }),

  /** Sync the counter to the authoritative value from the rep state machine
   *  (never drifts by one like an incrementing counter would). */
  syncReps: (reps) => set({ reps }),

  /** Set the elapsed seconds (hold time for timed exercises). */
  setSeconds: (seconds) => set({ seconds }),

  addRep: () => set((s) => ({ reps: s.reps + 1, manualReps: s.reps + 1 })),

  subtractRep: () =>
    set((s) => ({ reps: Math.max(0, s.reps - 1), manualReps: Math.max(0, s.reps - 1) })),

  tick: (now) => {
    const { isActive, isPaused, startTime, config } = get()
    if (!isActive || isPaused || !startTime) return
    // For timed exercises the elapsed time is the real HOLD time, which is
    // driven by the rep counter (it knows when the position was valid).
    if (config?.type === "timed") return
    set({ seconds: Math.floor((now - startTime) / 1000) })
  },

  setFrame: (inFrame, angle, phase) =>
    set({ inFrame, angle: angle ?? null, phase: phase as any }),
}))
