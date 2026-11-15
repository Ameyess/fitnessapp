export type Rotation = 0 | 90 | 180 | 270

const FIT_RATIO_LIMIT = 1.25

export function rotatedSize(
  rotation: Rotation,
  sw: number,
  sh: number
): { width: number; height: number } {
  if (rotation === 90 || rotation === 270) {
    return { width: sh, height: sw }
  }
  return { width: sw, height: sh }
}

export function mapPoint(
  u: number,
  v: number,
  rotation: Rotation,
  mirror: boolean
): { x: number; y: number } {
  const sourceX = mirror ? 1 - u : u

  if (rotation === 90) return { x: 1 - v, y: sourceX }
  if (rotation === 180) return { x: 1 - sourceX, y: 1 - v }
  if (rotation === 270) return { x: v, y: 1 - sourceX }
  return { x: sourceX, y: v }
}

export function pickFit(
  rotatedAspect: number,
  viewportAspect: number
): "cover" | "contain" {
  if (
    !Number.isFinite(rotatedAspect) ||
    !Number.isFinite(viewportAspect) ||
    rotatedAspect <= 0 ||
    viewportAspect <= 0
  ) {
    return "contain"
  }

  const ratio = Math.max(
    rotatedAspect / viewportAspect,
    viewportAspect / rotatedAspect
  )
  return ratio <= FIT_RATIO_LIMIT ? "cover" : "contain"
}

export function chooseRotation(params: {
  streamWidth: number
  streamHeight: number
  viewportWidth: number
  viewportHeight: number
  upVector?: { x: number; y: number } | null
}): Rotation {
  const {
    streamWidth,
    streamHeight,
    viewportWidth,
    viewportHeight,
    upVector,
  } = params

  if (
    !Number.isFinite(streamWidth) ||
    !Number.isFinite(streamHeight) ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    streamWidth <= 0 ||
    streamHeight <= 0 ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return 0
  }

  const streamAspect = streamWidth / streamHeight
  const viewportAspect = viewportWidth / viewportHeight

  const streamIsPortrait = streamAspect < 1
  const viewportIsPortrait = viewportAspect < 1

  // The source and the screen agree on orientation: never rotate. A portrait
  // stream on a portrait screen is already the vertical view we want, and
  // rotating it would turn a floor exercise (push-ups, planks) sideways.
  if (streamIsPortrait === viewportIsPortrait) return 0

  // Orientations disagree, so the frame has to turn a quarter to become a
  // vertical view. This is the direction used when the pose cannot tell us
  // which way is up.
  const aspectDefault: Rotation = streamIsPortrait ? 270 : 90

  const hasUsableUpVector =
    !!upVector &&
    Number.isFinite(upVector.x) &&
    Number.isFinite(upVector.y) &&
    Math.hypot(upVector.x, upVector.y) > 0.000001

  if (!hasUsableUpVector || !upVector) return aspectDefault

  // A vector is "upright" when it points up the screen (dy < 0) and is more
  // vertical than horizontal.
  const isUpright = (v: { x: number; y: number }) =>
    v.y < 0 && Math.abs(v.y) >= Math.abs(v.x)

  // The rotation mapping is affine, so the rotated vector is the difference
  // between the mapped tip and the mapped origin.
  const rotatedVector = (rotation: Rotation) => {
    const origin = mapPoint(0, 0, rotation, false)
    const tip = mapPoint(upVector.x, upVector.y, rotation, false)
    return { x: tip.x - origin.x, y: tip.y - origin.y }
  }

  // The pose can choose which quarter turn to use, but it can never turn a
  // matching orientation back into 0 (or a mismatched orientation into 0).
  // Evaluate both candidates against the source-space up-vector and use the
  // one that leaves the person upright.
  const candidates: Rotation[] = [90, 270]
  const upright = candidates.filter((r) => isUpright(rotatedVector(r)))
  if (upright.length === 1) return upright[0]

  // Ambiguous (no clear upright candidate - e.g. the user is lying on the
  // floor or is already upright in the source frame): fall back to the
  // orientation-based default. The preview must still remain vertical.
  return aspectDefault
}

export function nextRotation(rotation: Rotation): Rotation {
  if (rotation === 0) return 90
  if (rotation === 90) return 180
  if (rotation === 180) return 270
  return 0
}
