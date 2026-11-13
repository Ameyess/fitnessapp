"use client"

import * as React from "react"
import {
  PoseLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision"

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"

export interface UsePoseTrackerReturn {
  detector: PoseLandmarker | null
  isLoading: boolean
  error: string | null
  detect: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { landmarks: any[] | null } | null
}

export function usePoseTracker(): UsePoseTrackerReturn {
  const [detector, setDetector] = React.useState<PoseLandmarker | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        setIsLoading(true)
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        )
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
        if (!cancelled) {
          setDetector(poseLandmarker)
          setIsLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load pose model")
          setIsLoading(false)
        }
      }
    }
    init()
    return () => {
      cancelled = true
      detector?.close()
    }
  }, [])

  const detect = React.useCallback(
    (video: HTMLVideoElement, timestamp: number) => {
      if (!detector) return null
      try {
        const result = detector.detectForVideo(video, timestamp)
        return {
          landmarks: result.landmarks[0] ?? null,
        }
      } catch {
        return null
      }
    },
    [detector],
  )

  return { detector, isLoading, error, detect }
}
