/* eslint-disable no-console */
/**
 * Independent Round 3 QA for the shipped repetition counter.
 *
 * This generator deliberately does not import or copy helpers from the
 * repository's unit test. It builds MediaPipe-shaped landmark arrays with
 * forward kinematics, bundles the real TypeScript implementation with
 * esbuild, and drives that bundle.
 *
 * Run: node tests/qa-round3-generator.cjs
 */
const fs = require("fs")
const path = require("path")
const esbuild = require("esbuild")

const ROOT = path.join(__dirname, "..")
const TMP = "C:\\Users\\Amayas\\AppData\\Local\\Temp\\opencode"
const COUNTER_OUT = path.join(TMP, "fitstreak-r3-independent-repcounter.cjs")
const EXERCISES_OUT = path.join(TMP, "fitstreak-r3-independent-exercises.cjs")
const DEG = Math.PI / 180

const results = []
function expect(label, actual, wanted) {
  const pass = JSON.stringify(actual) === JSON.stringify(wanted)
  results.push({ label, pass, actual, wanted })
  console.log(`${pass ? "PASS" : "FAIL"}  ${label} :: actual=${JSON.stringify(actual)} expected=${JSON.stringify(wanted)}`)
}

function add(origin, directionDeg, length) {
  const a = directionDeg * DEG
  return { x: origin.x + Math.cos(a) * length, y: origin.y + Math.sin(a) * length }
}

/** Place C so angle(A-B-C) is exactly wantedDegrees. */
function exactJoint(A, B, wantedDegrees, lengthBC, turn = 1) {
  const towardA = Math.atan2(A.y - B.y, A.x - B.x) / DEG
  return add(B, towardA + turn * wantedDegrees, lengthBC)
}

function point(x, y) {
  return { x, y, z: 0, visibility: 1 }
}

/** A 33-point pose; unassigned points remain valid but outside the body. */
function pose(pairs) {
  const out = Array.from({ length: 33 }, () => point(0.5, 0.5))
  for (const [leftIndex, rightIndex, leftPoint] of pairs) {
    out[leftIndex] = { ...leftPoint, z: 0, visibility: 1 }
    out[rightIndex] = { ...point(1 - leftPoint.x, leftPoint.y), z: 0, visibility: 1 }
  }
  return out
}

function pushup(elbowDegrees, armDirection, armLength) {
  const shoulder = point(0.42, 0.28)
  const elbow = add(shoulder, armDirection, armLength)
  const wrist = exactJoint(shoulder, elbow, elbowDegrees, armLength)
  return pose([
    [11, 12, shoulder], [13, 14, elbow], [15, 16, wrist],
    [23, 24, point(0.42, 0.62)], [25, 26, point(0.44, 0.80)],
    [27, 28, point(0.46, 0.96)],
  ])
}

function floorTorso(elevationDegrees, kneeX, kneeY) {
  const hip = point(0.58, 0.66)
  const shoulder = add(hip, 180 + elevationDegrees, 0.31)
  return pose([
    [11, 12, shoulder], [23, 24, hip], [25, 26, point(kneeX, kneeY)],
  ])
}

function squat(kneeDegrees, thighDirection, legLength) {
  const hip = point(0.44, 0.35)
  const knee = add(hip, thighDirection, legLength)
  const ankle = exactJoint(hip, knee, kneeDegrees, legLength)
  return pose([
    [11, 12, point(0.44, 0.18)], [23, 24, hip],
    [25, 26, knee], [27, 28, ankle],
  ])
}

/** Construct the wrist so the counter's virtual vertical angle is exact. */
function jumpingJack(measuredDegrees, armLength) {
  const shoulder = point(0.43, 0.42)
  const virtual = point(shoulder.x, shoulder.y - 0.1)
  const a = measuredDegrees * DEG
  const wrist = point(virtual.x + Math.sin(a) * armLength, virtual.y + Math.cos(a) * armLength)
  return pose([
    [11, 12, shoulder], [15, 16, wrist],
    [23, 24, point(0.48, 0.65)], [25, 26, point(0.48, 0.82)],
    [27, 28, point(0.48, 0.97)],
  ])
}

function plank(hipDegrees, turn = -1) {
  const shoulder = point(0.20, 0.50)
  const hip = point(0.50, 0.52)
  const ankle = exactJoint(shoulder, hip, hipDegrees, 0.31, turn)
  return pose([[11, 12, shoulder], [23, 24, hip], [27, 28, ankle]])
}

async function loadShippedImplementation() {
  fs.mkdirSync(TMP, { recursive: true })
  const common = {
    bundle: true,
    format: "cjs",
    platform: "node",
    alias: { "@": path.join(ROOT, "src") },
    logLevel: "silent",
  }
  await esbuild.build({
    ...common,
    entryPoints: [path.join(ROOT, "src/lib/exercises/repCounter.ts")],
    outfile: COUNTER_OUT,
  })
  await esbuild.build({
    ...common,
    entryPoints: [path.join(ROOT, "src/lib/exercises/index.ts")],
    outfile: EXERCISES_OUT,
  })
  return {
    createRepCounter: require(COUNTER_OUT).createRepCounter,
    exercises: require(EXERCISES_OUT).exerciseRegistry,
  }
}

function drive(createRepCounter, config, frames, start = 10_000) {
  const counter = createRepCounter(config)
  let now = start
  const states = frames.map((landmarks) => {
    now += 500
    return counter.update({ config, landmarks, now })
  })
  return states
}

async function main() {
  const { createRepCounter, exercises } = await loadShippedImplementation()

  // Push-ups: elbow angle, upper-arm direction and limb length all vary.
  for (const [armDirection, armLength] of [[50, 0.14], [72, 0.16], [95, 0.18], [118, 0.13]]) {
    const config = exercises.pushups
    const states = drive(createRepCounter, config, [
      pushup(172, armDirection, armLength),
      pushup(88, armDirection, armLength),
      pushup(172, armDirection, armLength),
      pushup(88, armDirection, armLength),
      pushup(172, armDirection, armLength),
    ])
    expect(`pushups count two cycles (arm=${armDirection},len=${armLength})`, states.at(-1).reps, 2)
    expect(`pushups phases (arm=${armDirection},len=${armLength})`, states.map((s) => s.phase), ["up", "down", "up", "down", "up"])
  }

  // Sit-ups: raised torso plus deliberately different knee placements.
  for (const [elevation, kneeX, kneeY] of [[64, 0.78, 0.72], [72, 0.62, 0.74], [80, 0.91, 0.70], [68, 0.84, 0.80]]) {
    const config = exercises.situps
    const states = drive(createRepCounter, config, [
      floorTorso(5, kneeX, kneeY),
      floorTorso(elevation, kneeX, kneeY),
      floorTorso(5, kneeX, kneeY),
    ])
    expect(`situps count one cycle (elevation=${elevation},kneeX=${kneeX})`, states.at(-1).reps, 1)
    expect(`situps phases (elevation=${elevation},kneeX=${kneeX})`, states.map((s) => s.phase), ["down", "up", "down"])
  }

  // Crunches: the smaller torso movement, again independent of knees.
  for (const [elevation, kneeX] of [[34, 0.80], [39, 0.63], [45, 0.90]]) {
    const config = exercises.crunches
    const states = drive(createRepCounter, config, [
      floorTorso(4, kneeX, 0.73),
      floorTorso(elevation, kneeX, 0.73),
      floorTorso(4, kneeX, 0.73),
    ])
    expect(`crunches count one cycle (elevation=${elevation},kneeX=${kneeX})`, states.at(-1).reps, 1)
    expect(`crunches phases (elevation=${elevation},kneeX=${kneeX})`, states.map((s) => s.phase), ["down", "up", "down"])
  }

  // Squats: exact knee angles with varied thigh direction and leg length.
  for (const [thighDirection, legLength] of [[78, 0.19], [96, 0.22], [112, 0.17], [126, 0.24]]) {
    const config = exercises.squats
    const states = drive(createRepCounter, config, [
      squat(172, thighDirection, legLength),
      squat(94, thighDirection, legLength),
      squat(172, thighDirection, legLength),
      squat(94, thighDirection, legLength),
      squat(172, thighDirection, legLength),
    ])
    expect(`squats count two cycles (thigh=${thighDirection},len=${legLength})`, states.at(-1).reps, 2)
    expect(`squats phases (thigh=${thighDirection},len=${legLength})`, states.map((s) => s.phase), ["up", "down", "up", "down", "up"])
  }

  // Jumping jacks: exact arm angle relative to the counter's vertical ray.
  for (const armLength of [0.18, 0.23, 0.28]) {
    const config = exercises.jumpingjacks
    const states = drive(createRepCounter, config, [
      jumpingJack(12, armLength),
      jumpingJack(172, armLength),
      jumpingJack(12, armLength),
    ])
    expect(`jumping jacks count one cycle (arm=${armLength})`, states.at(-1).reps, 1)
    expect(`jumping jacks phases (arm=${armLength})`, states.map((s) => s.phase), ["down", "up", "down"])
  }

  // A partial arm raise that never reaches the overhead endpoint must not
  // count as a complete jumping jack.
  {
    const config = exercises.jumpingjacks
    const states = drive(createRepCounter, config, [
      jumpingJack(12, 0.23),
      jumpingJack(90, 0.23),
      jumpingJack(12, 0.23),
    ])
    expect("partial jumping jack does not count a rep", states.at(-1).reps, 0)
  }

  // Returning only partway toward the down endpoint must not complete a rep.
  {
    const config = exercises.jumpingjacks
    const states = drive(createRepCounter, config, [
      jumpingJack(12, 0.23),
      jumpingJack(172, 0.23),
      jumpingJack(140, 0.23),
      jumpingJack(172, 0.23),
    ])
    expect(
      "partial return does not count another jumping jack",
      {
        reps: states.at(-1).reps,
        phases: states.map((s) => s.phase),
        angles: states.map((s) => Math.round(s.angle ?? -1)),
      },
      { reps: 1, phases: ["down", "up", "up", "up"], angles: [12, 172, 140, 172] },
    )
  }

  // Timed exercise: elapsed time is the uninterrupted hold, not wall time.
  {
    const config = exercises.planks
    const counter = createRepCounter(config)
    const t0 = 20_000
    const first = counter.update({ config, landmarks: plank(178), now: t0 })
    const heldAt = t0 + 4_250
    const held = counter.update({ config, landmarks: plank(176), now: heldAt })
    const brokenAt = heldAt + 500
    const broken = counter.update({ config, landmarks: plank(138), now: brokenAt })
    const resumedAt = brokenAt + 700
    const resumed = counter.update({ config, landmarks: plank(179), now: resumedAt })
    expect("plank starts and preserves an aligned hold", [first.holdStart, held.holdStart, held.phase], [t0, t0, "holding"])
    expect("plank reports 4.25 seconds of held time", heldAt - held.holdStart, 4_250)
    expect("plank resets held time when alignment breaks", [broken.holdStart, broken.phase], [null, "resting"])
    expect("plank starts a fresh hold after the break", resumed.holdStart, resumedAt)
  }

  const passed = results.filter((r) => r.pass).length
  console.log(`\n=== ${passed}/${results.length} independent generator checks passed ===`)
  if (passed !== results.length) process.exitCode = 1
}

main().catch((error) => {
  console.error("HARNESS ERROR:", error)
  process.exit(2)
})
