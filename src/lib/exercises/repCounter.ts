import type { ExerciseConfig, RepPhase } from "@/types"
import { angleABC, elevationDeg, getLandmark, landmarksVisible } from "@/lib/mediapipe"

export interface RepCounterState {
  reps: number
  phase: RepPhase
  angle: number | null
  inFrame: boolean
  lastRepTime: number
  /** For timed exercises: when the current unbroken hold started (ms).
   *  null when not currently holding a valid position. */
  holdStart: number | null
}

export interface RepCounterInput {
  config: ExerciseConfig
  landmarks: any[] | null
  now: number
}

const COOLDOWN_MS = 350 // min time between reps to prevent double counting

export function createRepCounter(config: ExerciseConfig) {
  let state: RepCounterState = {
    reps: 0,
    phase: "resting",
    angle: null,
    inFrame: false,
    lastRepTime: -Infinity,
    holdStart: null,
  }

  // For timed exercises, track hold start
  let holdStart: number | null = null

  return {
    getState: () => state,

    update({ config, landmarks, now }: RepCounterInput): RepCounterState {
      const minConf = config.minConfidence ?? 0.5
      const required = config.requiredLandmarks ?? config.trackedLandmarks
      const visible =
        landmarks && landmarksVisible(landmarks, required, minConf)

      if (!visible) {
        state = {
          ...state,
          inFrame: false,
          angle: null,
          phase: "resting",
          holdStart: null,
        }
        holdStart = null
        return state
      }

      state = { ...state, inFrame: true }

      if (config.type === "timed") {
        // Plank: check body alignment (shoulder-hip-ankle roughly straight)
        const lm = landmarks as any[]
        const lShoulder = getLandmark(lm, 11)
        const lHip = getLandmark(lm, 23)
        const lAnkle = getLandmark(lm, 27)
        const rShoulder = getLandmark(lm, 12)
        const rHip = getLandmark(lm, 24)
        const rAnkle = getLandmark(lm, 28)

        const leftAngle = lShoulder && lHip && lAnkle ? angleABC(lShoulder, lHip, lAnkle) : 0
        const rightAngle = rShoulder && rHip && rAnkle ? angleABC(rShoulder, rHip, rAnkle) : 0
        const avgAngle = (leftAngle + rightAngle) / 2

        const aligned = avgAngle >= config.downThreshold! && avgAngle <= config.upThreshold!

        if (aligned) {
          if (!holdStart) holdStart = now
        } else {
          holdStart = null
        }
        state = {
          ...state,
          angle: avgAngle,
          phase: aligned ? "holding" : "resting",
          holdStart,
        }
        return state
      }

      // Rep exercises: compute a representative angle
      let angle: number | null = null
      const lm = landmarks as any[]

      if (config.id === "pushups") {
        // Use average of left/right elbow angle (shoulder-elbow-wrist)
        const a = angleABC(getLandmark(lm, 11)!, getLandmark(lm, 13)!, getLandmark(lm, 15)!)
        const b = angleABC(getLandmark(lm, 12)!, getLandmark(lm, 14)!, getLandmark(lm, 16)!)
        angle = (a + b) / 2
      } else if (config.id === "squats") {
        // Average knee angle (hip-knee-ankle)
        const a = angleABC(getLandmark(lm, 23)!, getLandmark(lm, 25)!, getLandmark(lm, 27)!)
        const b = angleABC(getLandmark(lm, 24)!, getLandmark(lm, 26)!, getLandmark(lm, 28)!)
        angle = (a + b) / 2
      } else if (config.angleSource === "torsoElevation") {
        // Situps / crunches: how far the torso is raised off the floor.
        // Measured relative to horizontal so it is independent of where the
        // knees are (the interior hip angle shifts with leg position).
        const ls = getLandmark(lm, 11)
        const rs = getLandmark(lm, 12)
        const lh = getLandmark(lm, 23)
        const rh = getLandmark(lm, 24)
        const e1 = ls && lh ? elevationDeg(ls, lh) : 0
        const e2 = rs && rh ? elevationDeg(rs, rh) : 0
        angle = (e1 + e2) / 2
      } else if (config.id === "situps" || config.id === "crunches") {
        // Hip angle (shoulder-hip-knee), average left/right
        const a = angleABC(getLandmark(lm, 11)!, getLandmark(lm, 23)!, getLandmark(lm, 25)!)
        const b = angleABC(getLandmark(lm, 12)!, getLandmark(lm, 24)!, getLandmark(lm, 26)!)
        angle = (a + b) / 2
      } else if (config.id === "jumpingjacks") {
        // Use wrist height relative to shoulders: arms up = small y (higher on screen)
        // We approximate via left shoulder->wrist angle vs vertical
        const lw = getLandmark(lm, 15)
        const ls = getLandmark(lm, 11)
        const rw = getLandmark(lm, 16)
        const rs = getLandmark(lm, 12)
        if (lw && ls && rw && rs) {
          const leftAngle = angleABC(ls, { x: ls.x, y: ls.y - 0.1, z: 0, visibility: 1 }, lw)
          const rightAngle = angleABC(rs, { x: rs.x, y: rs.y - 0.1, z: 0, visibility: 1 }, rw)
          angle = (leftAngle + rightAngle) / 2
        }
      }

      state = { ...state, angle }

      // Determine phase with hysteresis.
      // IMPORTANT: the *previous* phase must be captured BEFORE the state
      // is updated, otherwise the transition can never be detected and reps
      // are never counted.
      const prevPhase = state.phase
      let phase: RepPhase = prevPhase
      if (angle != null) {
        if (config.angleDirection === "decreasing") {
          // The joint FOLDS when the user lifts (situps, crunches):
          // a LARGER angle is the "down" phase.
          if (angle > config.downThreshold) phase = "down"
          else if (angle < config.upThreshold) phase = "up"
        } else {
          // The joint EXTENDS when the user lifts (pushups, squats):
          // a LARGER angle is the "up" phase.
          if (angle < config.downThreshold) phase = "down"
          else if (angle > config.upThreshold) phase = "up"
        }
        // else keep previous (hysteresis)
      }
      state = { ...state, phase }

      // Rep counting on transition
      if (state.phase !== prevPhase && prevPhase !== "resting") {
        const completed =
          (config.repCompletedOn === "down-to-up" &&
            prevPhase === "down" &&
            state.phase === "up") ||
          (config.repCompletedOn === "up-to-down" &&
            prevPhase === "up" &&
            state.phase === "down")

        if (completed && now - state.lastRepTime > COOLDOWN_MS) {
          state = { ...state, reps: state.reps + 1, lastRepTime: now }
        }
      }

      return state
    },

    reset() {
      state = {
        reps: 0,
        phase: "resting",
        angle: null,
        inFrame: false,
        lastRepTime: -Infinity,
        holdStart: null,
      }
      holdStart = null
    },

    setReps(reps: number) {
      state = { ...state, reps }
    },
  }
}
