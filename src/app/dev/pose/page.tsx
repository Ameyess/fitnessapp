"use client"

/**
 * Diagnostic route: runs the REAL Pose Landmarker over a still photo and
 * renders the REAL <PoseCanvas> overlay on top of it.
 *
 * This exercises the exact detection + coordinate-mapping code path used by
 * the live workout screen, but deterministically (no camera required).
 */
import * as React from "react"
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision"
import { PoseCanvas } from "@/components/camera/PoseCanvas"

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"

export default function PoseTestPage() {
  const [landmarks, setLandmarks] = React.useState<any[] | null>(null)
  const [status, setStatus] = React.useState("loading")
  const [error, setError] = React.useState<string | null>(null)
  const imgRef = React.useRef<HTMLImageElement>(null)

  React.useEffect(() => {
    let cancelled = false
    let lm: PoseLandmarker | null = null
    const run = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        const make = (delegate: "GPU" | "CPU") => ({
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: "IMAGE" as const,
          numPoses: 1,
        })
        try {
          lm = await PoseLandmarker.createFromOptions(vision, make("GPU"))
        } catch {
          lm = await PoseLandmarker.createFromOptions(vision, make("CPU"))
        }
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = "/pose-test.jpg"
        await new Promise<void>((res, rej) => {
          img.onload = () => res()
          img.onerror = () => rej(new Error("image load failed"))
        })
        if (cancelled) return
        const result = lm.detect(img)
        const found = result.landmarks?.[0] ?? null
        if (!found) {
          setStatus("no-pose")
          return
        }
        setLandmarks(found)
        setStatus("done")
        // Expose for Playwright assertions
        ;(window as any).__poseLandmarks = found
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "failed")
          setStatus("error")
        }
      }
    }
    run()
    return () => {
      cancelled = true
      try { lm?.close() } catch {}
    }
  }, [])

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-2 text-lg font-black">Pose overlay diagnostic</h1>
      <p className="mb-3 text-xs font-bold text-slate-500" data-testid="status">
        status: {status}
      </p>

      <div
        className="relative w-full overflow-hidden rounded-2xl bg-black"
        style={{ aspectRatio: "3 / 4" }}
        data-testid="stage"
      >
        <img
          ref={imgRef}
          src="/pose-test.jpg"
          alt="pose test"
          className="h-full w-full object-cover"
        />
        {landmarks && <PoseCanvas landmarks={landmarks} video={imgRef.current} />}
      </div>

      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-bold">Landmark data</summary>
        <pre className="mt-2 max-h-64 overflow-auto text-[10px]">
          {landmarks
            ? landmarks
                .map(
                  (l: any, i: number) =>
                    `${i}: x=${l.x.toFixed(3)} y=${l.y.toFixed(3)} v=${(l.visibility ?? 0).toFixed(2)}`
                )
                .join("\n")
            : "none"}
        </pre>
      </details>
    </div>
  )
}
