"use client"

import * as React from "react"

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
   *  onto the visible (object-cover cropped) area. */
  video?: HTMLVideoElement | HTMLImageElement | null
  mirror?: boolean
  highlightJoints?: number[]
}

/**
 * Draws the skeleton on a canvas layered over the video.
 *
 * MediaPipe returns landmarks normalized to the *video frame*. The <video>
 * uses `object-cover`, so part of the frame is cropped off-screen. This
 * reproduces that crop math so the markers land exactly on the body.
 */
export function PoseCanvas({
  landmarks,
  video,
  mirror = false,
  highlightJoints = [],
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

    // --- object-cover mapping ---
    const sw = (video as any)?.videoWidth || (video as any)?.naturalWidth || 0
    const sh = (video as any)?.videoHeight || (video as any)?.naturalHeight || 0
    let scale = 1
    let rw = cw
    let rh = ch
    let ox = 0
    let oy = 0
    if (sw > 0 && sh > 0) {
      scale = Math.max(cw / sw, ch / sh)
      rw = sw * scale
      rh = sh * scale
      ox = (cw - rw) / 2
      oy = (ch - rh) / 2
    }

    const px = (lm: Landmark) => (mirror ? (1 - lm.x) * rw + ox : lm.x * rw + ox)
    const py = (lm: Landmark) => lm.y * rh + oy

    // --- connections ---
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    for (const [a, b] of POSE_CONNECTIONS) {
      const lmA = landmarks[a]
      const lmB = landmarks[b]
      if (!lmA || !lmB) continue
      if ((lmA.visibility ?? 0) < 0.4 || (lmB.visibility ?? 0) < 0.4) continue
      ctx.beginPath()
      ctx.moveTo(px(lmA), py(lmA))
      ctx.lineTo(px(lmB), py(lmB))
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
      const x = px(lm)
      const y = py(lm)
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
  }, [landmarks, video, mirror, highlightJoints])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}

export { JOINT_NAMES }
