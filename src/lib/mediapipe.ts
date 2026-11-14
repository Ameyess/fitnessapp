import { Landmark } from "@mediapipe/tasks-vision"

export interface AnglePoint { x: number; y: number; z: number; visibility: number }

export function toPoint(lm: Landmark): AnglePoint {
  return { x: lm.x, y: lm.y, z: lm.z ?? 0, visibility: lm.visibility ?? 0 }
}

export function angleABC(a: AnglePoint, b: AnglePoint, c: AnglePoint): number {
  const ba = { x: a.x - b.x, y: a.y - b.y }
  const bc = { x: c.x - b.x, y: c.y - b.y }
  const dot = ba.x * bc.x + ba.y * bc.y
  const magBa = Math.hypot(ba.x, ba.y)
  const magBc = Math.hypot(bc.x, bc.y)
  if (magBa === 0 || magBc === 0) return 0
  let cos = dot / (magBa * magBc)
  cos = Math.max(-1, Math.min(1, cos))
  return (Math.acos(cos) * 180) / Math.PI
}

export function distance(p: AnglePoint, q: AnglePoint): number {
  return Math.hypot(p.x - q.x, p.y - q.y)
}

/**
 * Angle of the a->b segment relative to horizontal, in degrees (0-90).
 *
 * Used for floor exercises (situps, crunches): the torso pivots up from the
 * floor, so "elevation" is far more stable than the interior hip angle,
 * which changes with the position of the knees.
 */
export function elevationDeg(a: AnglePoint, b: AnglePoint): number {
  return (Math.atan2(Math.abs(a.y - b.y), Math.abs(a.x - b.x)) * 180) / Math.PI
}

export function landmarksVisible(
  landmarks: Landmark[],
  indices: number[],
  minConfidence = 0.5,
): boolean {
  return indices.every((i) => {
    const lm = landmarks[i]
    return !!lm && lm.visibility >= minConfidence
  })
}

export function getLandmark(landmarks: Landmark[], index: number): AnglePoint | null {
  const lm = landmarks[index]
  if (!lm) return null
  return toPoint(lm)
}
