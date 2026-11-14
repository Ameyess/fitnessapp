"use client"

import * as React from "react"
import { mapPoint, rotatedSize, type Rotation } from "@/lib/camera/rotation"

type Landmark = { x: number; y: number; z: number; visibility: number }

const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso
  [23, 24], // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
]

const JOINT_NAMES: Record<number, string> = {
  11: "left shoulder",
  12: "right shoulder",
  13: "left elbow",
  14: "right elbow",
  15: "left wrist",
  16: "right wrist",
  23: "left hip",
  24: "right hip",
  25: "left knee",
  26: "right knee",
  27: "left ankle",
  28: "right ankle",
}

interface PoseCanvasProps {
  landmarks: Landmark[] | null
  /** The source media element - used to map normalized landmarks
   *  onto the visible area. */
  video?: HTMLVideoElement | HTMLImageElement | null
  mirror?: boolean
  highlightJoints?: number[]
  /** Must match the object-fit and rotation of the source element. */
  fit?: "cover" | "contain"
  /** Clockwise rotation applied to the source element. */
  rotation?: Rotation
}

/**
 * Draws the skeleton on a canvas layered over the video.
 *
 * MediaPipe returns landmarks normalized to the *video frame*. This applies
 * the same rotation, mirror and object-fit geometry as the <video>, so the
 * markers land exactly on the body even when part of the frame is cropped.
 */
export function PoseCanvas({
  landmarks,
  video,
  mirror = false,
  highlightJoints = [],
  fit = "cover",
  rotation = 0,
}: PoseCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    if (!cw || !ch) return

    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr)
      canvas.height = Math.round(ch * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cw, ch)
    if (!landmarks || landmarks.length === 0) return

    // --- video -> canvas mapping (must match the <video> CSS transform) ---
    const sourceWidth = (video as any)?.videoWidth || (video as any)?.naturalWidth || 0
    const sourceHeight = (video as any)?.videoHeight || (video as any)?.naturalHeight || 0
    const rotatedSource = rotatedSize(rotation, sourceWidth, sourceHeight)
    let scale = 1
    let renderedWidth = cw
    let renderedHeight = ch
    let offsetX = 0
    let offsetY = 0
    if (rotatedSource.width > 0 && rotatedSource.height > 0) {
      if (fit === "contain") {
        // Letterbox: the whole rotated video is visible, nothing is cropped.
        scale = Math.min(cw / rotatedSource.width, ch / rotatedSource.height)
      } else {
        // object-cover: fill the screen, crop the overflow.
        scale = Math.max(cw / rotatedSource.width, ch / rotatedSource.height)
      }
      renderedWidth = rotatedSource.width * scale
      renderedHeight = rotatedSource.height * scale
      offsetX = (cw - renderedWidth) / 2
      offsetY = (ch - renderedHeight) / 2
    }

    const mapLandmark = (lm: Landmark) => {
      const point = mapPoint(lm.x, lm.y, rotation, mirror)
      return {
        x: point.x * renderedWidth + offsetX,
        y: point.y * renderedHeight + offsetY,
      }
    }

    // --- connections ---
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    for (const [a, b] of POSE_CONNECTIONS) {
      const lmA = landmarks[a]
      const lmB = landmarks[b]
      if (!lmA || !lmB) continue
      if ((lmA.visibility ?? 0) < 0.4 || (lmB.visibility ?? 0) < 0.4) continue
      const pointA = mapLandmark(lmA)
      const pointB = mapLandmark(lmB)
      ctx.beginPath()
      ctx.moveTo(pointA.x, pointA.y)
      ctx.lineTo(pointB.x, pointB.y)
      ctx.strokeStyle = "rgba(88, 204, 2, 0.95)"
      ctx.lineWidth = 8
      ctx.stroke()
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // --- joints ---
    landmarks.forEach((lm, i) => {
      if ((lm.visibility ?? 0) < 0.4) return
      const isHot = highlightJoints.includes(i)
      const point = mapLandmark(lm)
      const x = point.x
      const y = point.y
      const r = isHot ? 9 : 6

      ctx.beginPath()
      ctx.arc(x, y, r + 3, 0, Math.PI * 2)
      ctx.fillStyle = isHot
        ? "rgba(255, 150, 0, 0.35)"
        : "rgba(88, 204, 2, 0.3)"
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = isHot ? "#ff9600" : "#58cc02"
      ctx.fill()
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 2.5
      ctx.stroke()
    })
  }, [landmarks, video, mirror, highlightJoints, fit, rotation])

  return (
    <canvas
      ref={canvasRef}
      data-testid="pose-canvas"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}

export { JOINT_NAMES }
