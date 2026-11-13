"use client"

import * as React from "react"

type Landmark = { x: number; y: number; z: number; visibility: number }

const POSE_CONNECTIONS: [number, number][] = [
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 12], // shoulders
  [11, 23], [12, 24], // torso
  [23, 24], // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
]

interface PoseCanvasProps {
  landmarks: Landmark[] | null
  width: number
  height: number
  mirror?: boolean
  highlightJoints?: number[]
}

export function PoseCanvas({
  landmarks,
  width,
  height,
  mirror = false,
  highlightJoints = [],
}: PoseCanvasProps) {
  React.useEffect(() => {
    const canvas = document.getElementById("pose-canvas") as HTMLCanvasElement | null
    if (!canvas || !landmarks) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)

    const scaleX = width
    const scaleY = height
    const getX = (lm: Landmark) => (mirror ? (1 - lm.x) * scaleX : lm.x * scaleX)
    const getY = (lm: Landmark) => lm.y * scaleY

    // Draw connections
    ctx.strokeStyle = "#22c55e"
    ctx.lineWidth = 4
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    for (const [a, b] of POSE_CONNECTIONS) {
      const lmA = landmarks[a]
      const lmB = landmarks[b]
      if (!lmA || !lmB) continue
      if (lmA.visibility < 0.4 || lmB.visibility < 0.4) continue
      ctx.beginPath()
      ctx.moveTo(getX(lmA), getY(lmA))
      ctx.lineTo(getX(lmB), getY(lmB))
      ctx.stroke()
    }

    // Draw joints
    landmarks.forEach((lm, i) => {
      if (lm.visibility < 0.4) return
      const isHighlight = highlightJoints.includes(i)
      ctx.beginPath()
      ctx.arc(getX(lm), getY(lm), isHighlight ? 7 : 5, 0, Math.PI * 2)
      ctx.fillStyle = isHighlight ? "#f59e0b" : "#10b981"
      ctx.fill()
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }, [landmarks, width, height, mirror, highlightJoints])

  return (
    <canvas
      id="pose-canvas"
      className="absolute inset-0 w-full h-full pointer-events-none"
      width={width}
      height={height}
    />
  )
}
