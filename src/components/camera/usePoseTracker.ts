"use client"

import * as React from "react"
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision"

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"

export interface UsePoseTrackerReturn {
  detector: PoseLandmarker | null
  isLoading: boolean
  /** "loading" | "ready" | "error" */
  status: "loading" | "ready" | "error"
  error: string | null
}

export function usePoseTracker(): UsePoseTrackerReturn {
  const [detector, setDetector] = React.useState<PoseLandmarker | null>(null)
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    let created: PoseLandmarker | null = null

    const init = async () => {
      try {
        setStatus("loading")
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)

        const options = (delegate: "GPU" | "CPU") => ({
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate,
          },
          runningMode: "VIDEO" as const,
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        try {
          created = await PoseLandmarker.createFromOptions(vision, options("GPU"))
        } catch (gpuErr) {
          console.warn("GPU delegate unavailable, falling back to CPU", gpuErr)
          created = await PoseLandmarker.createFromOptions(vision, options("CPU"))
        }

        if (!cancelled) {
          setDetector(created)
          setStatus("ready")
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load pose model", e)
          setError(
            e instanceof Error
              ? e.message
              : "Could not load the pose tracking model. Check your connection."
          )
          setStatus("error")
        }
      }
    }

    init()
    return () => {
      cancelled = true
      try {
        created?.close()
      } catch {}
    }
  }, [])

  return { detector, isLoading: status === "loading", status, error }
}
