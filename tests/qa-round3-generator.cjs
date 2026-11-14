/* eslint-disable no-console */
/**
 * Independent Round 3 QA generator.
 *
 * This deliberately does NOT reuse tests/repcounter.test.cjs helpers.  It
 * generates MediaPipe-shaped landmarks with forward segment kinematics,
 * then drives the shipped src/lib/exercises/repCounter.ts bundle.
 *
 * Run: node tests/qa-round3-generator.cjs
 */
const path = require("path")
const fs = require("fs")
const os = require("os")
const esbuild = require("esbuild")

const ROOT = path.join(__dirname, "..")
const OUT = path.join(
  "C:\\Users\\Amayas\\AppData\\Local\\Temp\\opencode",
  "fitstreak-round3-repcounter.cjs"
)
const EX_OUT = path.join(
  "C:\\Users\\Amayas\\AppData\\Local\\Temp\\opencode",
  "fitstreak-round3-exercises.cjs"
)

const checks = []
function check(name, pass, detail = "") {
  checks.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`)
}

const RAD = Math.PI / 180
const add = (p, angle, length) => ({
  x: p.x + Math.cos(angle * RAD) * length,
  y: p.y + Math.sin(angle * RAD) * length,
})
const mirrorX = (p) => ({ x: 1 - p.x, y: p.y })
const basePose = () =>
  Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))

/**
 * Put C after A--B so the interior angle A-B-C is exactly `jointAngle`.
 * `aToB` and `bToC` are independent segment directions.
 */
function chain(A, B, jointAngle, bToC, lengthBC) {
  const aToB = Math.atan2(B.y - A.y, B.x - A.x) / RAD
  const bToA = aToB + 180
  const direction = bToA + jointAngle
  return add(B, direction, lengthBC)
}

function bilateralPose(left, mapping) {
  const lm = basePose()
  for (const [leftIndex, rightIndex, point] of mapping) {
    lm[leftIndex] = { ...point, z: 0, visibility: 1 }
    lm[rightIndex] = { ...mirrorX(point), z: 0, visibility: 1 }
  }
  return lm
}

/** Push-up: torso plus an arm whose shoulder-elbow-wrist angle is exact. */
function pushupPose(elbowAngle, armDirection, armLength) {
  const shoulder = { x: 0.42, y: 0.28 }
  const elbow = add(shoulder, armDirection, armLength)
  const wrist = chain(shoulder, elbow, elbowAngle, 0, armLength)
  return bilateralPose(shoulder, [
    [11, 12, shoulder],
    [13, 14, elbow],
    [15, 16, wrist],
    [23, 24, { x: 0.42, y: 0.62 }],
    [25, 26, { x: 0.44, y: 0.80 }],
    [27, 28, { x: 0.46, y: 0.96 }],
  ])
}

/** Sit-up/crunch: torso segment elevation from horizontal, knee-independent. */
function torsoPose(elevation, torsoDirection, kneeX, kneeY) {
  const hip = { x: 0.58, y: 0.66 }
  const shoulder = add(hip, torsoDirection, 0.31)
  const knee = { x: kneeX, y: kneeY }
  return bilateralPose(shoulder, [
    [11, 12, shoulder],
    [23, 24, hip],
    [25, 26, knee],
  ])
}

/** Squat: exact hip-knee-ankle interior angle. */
function squatPose(kneeAngle, thighDirection, kneeLength) {
  const hip = { x: 0.44, y: 0.35 }
  const knee = add(hip, thighDirection, kneeLength)
  const ankle = chain(hip, knee, kneeAngle, 0, kneeLength)
  return bilateralPose(hip, [
    [11, 12, { x: 0.44, y: 0.18 }],
    [23, 24, hip],
    [25, 26, knee],
    [27, 28, ankle],
  ])
}

/** Jumping jack: target the angle measured at the virtual point above shoulder. */
function jumpingJackPose(measuredAngle, armLength) {
  const shoulder = { x: 0.43, y: 0.42 }
  const virtualAboveShoulder = { x: shoulder.x, y: shoulder.y - 0.1 }
  // The measured ray starts at the virtual point, not at the shoulder.
  const wrist = add(virtualAboveShoulder, 90 - measuredAngle, armLength)
  return bilateralPose(shoulder, [
    [11, 12, shoulder],
    [15, 16, wrist],
    [23, 24, { x: 0.48, y: 0.65 }],
    [25, 26, { x: 0.48, y: 0.82 }],
    [27, 28, { x: 0.48, y: 0.97 }],
  ])
}

/** Plank: exact shoulder-hip-ankle interior angle, independently per side. */
function plankPose(hipAngle, shoulderDirection) {
  const shoulder = { x: 0.20, y: 0.50 }
  const hip = { x: 0.50, y: 0.52 }
  const ankle = chain(shoulder, hip, hipAngle, 0, 0.31)
  return bilateralPose(shoulder, [
    [11, 12, shoulder],
    [23, 24, hip],
    [27, 28, ankle],
  ])
}

async function loadShippedCode() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  await esbuild.build({
    entryPoints: [path.join(ROOT, "src/lib/exercises/repCounter.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: OUT,
    alias: { "@": path.join(ROOT, "src") },
    logLevel: "silent",
  })
  await esbuild.build({
    entryPoints: [path.join(ROOT, "src/lib/exercises/index.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: EX_OUT,
    alias: { "@": path.join(ROOT, "src") },
    logLevel: "silent",
  })
  return {
    createRepCounter: require(OUT).createRepCounter,
    exercises: require(EX_OUT).exerciseRegistry,
  }
}

function cycle(counter, config, poses, start = 10_000) {
  let now = start
  const states = []
  for (const pose of poses) {
    now += 500
    states.push(counter.update({ config, landmarks: pose, now }))
  }
  return { states, now }
}

async function main() {
  const { createRepCounter, exercises } = await loadShippedCode()

  // Push-ups: several arm directions and segment lengths.
  for (const [armDirection, armLength] of [[55, 0.15], [80, 0.17], [110, 0.13]]) {
    const config = exercises.pushups
    const counter = createRepCounter(config)
    const { states } = cycle(counter, config, [
      pushupPose(174, armDirection, armLength),
      pushupPose(88, armDirection, armLength),
      pushupPose(174, armDirection, armLength),
      pushupPose(88, armDirection, armLength),
      pushupPose(174, armDirection, armLength),
    ])
    check(
      `pushups count 2 cycles (arm ${armDirection}deg)`,
      states[0].phase === "up" &&
        states[1].phase === "down" &&
        states[2].reps === 1 &&
        states[4].reps === 2,
      `phases=${states.map((s) => s.phase).join("/")} reps=${states.at(-1).reps}`
    )
  }

  // Sit-ups: raised torso plus deliberately different knee placements.
  for (const [upElevation, kneeX] of [
    [68, 0.80],
    [76, 0.62],
    [82, 0.90],
  ]) {
    const config = exercises.situps
    const counter = createRepCounter(config)
    const { states } = cycle(counter, config, [
      torsoPose(6, 186, kneeX, 0.72),
      torsoPose(upElevation, 180 + upElevation, kneeX, 0.72),
      torsoPose(6, 186, kneeX, 0.72),
    ])
    check(
      `situps count 1 cycle (up ${upElevation}deg, knee x=${kneeX})`,
      states[0].phase === "down" &&
        states[1].phase === "up" &&
        states[2].reps === 1,
      `phases=${states.map((s) => s.phase).join("/")} reps=${states.at(-1).reps}`
    )
  }

  // Crunches: same invariant over a smaller torso elevation.
  for (const [upElevation, kneeX] of [[35, 0.78], [41, 0.60], [46, 0.91]]) {
    const config = exercises.crunches
    const counter = createRepCounter(config)
    const { states } = cycle(counter, config, [
      torsoPose(5, 186, kneeX, 0.73),
      torsoPose(upElevation, 180 + upElevation, kneeX, 0.73),
      torsoPose(5, 186, kneeX, 0.73),
    ])
    check(
      `crunches count 1 cycle (up ${upElevation}deg, knee x=${kneeX})`,
      states[0].phase === "down" &&
        states[1].phase === "up" &&
        states[2].reps === 1,
      `phases=${states.map((s) => s.phase).join("/")} reps=${states.at(-1).reps}`
    )
  }

  // Squats: several thigh directions.
  for (const [thighDirection, kneeLength] of [[82, 0.20], [100, 0.23], [125, 0.18]]) {
    const config = exercises.squats
    const counter = createRepCounter(config)
    const { states } = cycle(counter, config, [
      squatPose(172, thighDirection, kneeLength),
      squatPose(92, thighDirection, kneeLength),
      squatPose(172, thighDirection, kneeLength),
      squatPose(92, thighDirection, kneeLength),
      squatPose(172, thighDirection, kneeLength),
    ])
    check(
      `squats count 2 cycles (thigh ${thighDirection}deg)`,
      states[0].phase === "up" &&
        states[1].phase === "down" &&
        states[2].reps === 1 &&
        states[4].reps === 2,
      `phases=${states.map((s) => s.phase).join("/")} reps=${states.at(-1).reps}`
    )
  }

  // Jumping jacks: arms down (~175deg) -> fully up (~15deg) -> down.
  for (const [downDirection, upDirection] of [[82, -72], [96, -58], [70, -78]]) {
    const config = exercises.jumpingjacks
    const counter = createRepCounter(config)
    const { states } = cycle(counter, config, [
      jumpingJackPose(174, downDirection, 0.25),
      jumpingJackPose(16, upDirection, 0.25),
      jumpingJackPose(174, downDirection, 0.25),
    ])
    check(
      `jumping jacks count 1 cycle (arms ${downDirection}/${upDirection}deg)`,
      states[0].phase === "up" &&
        states[1].phase === "down" &&
        states[2].reps === 1,
      `phases=${states.map((s) => s.phase).join("/")} reps=${states.at(-1).reps}`
    )
  }

  // Timed exercise: preserve the start of an unbroken hold and reset it.
  {
    const config = exercises.planks
    const counter = createRepCounter(config)
    let now = 20_000
    const first = counter.update({
      config,
      landmarks: plankPose(178, 180),
      now,
    })
    now += 4_250
    const held = counter.update({
      config,
      landmarks: plankPose(176, 180),
      now,
    })
    now += 500
    const broken = counter.update({
      config,
      landmarks: plankPose(142, 180),
      now,
    })
    now += 700
    const resumed = counter.update({
      config,
      landmarks: plankPose(179, 180),
      now,
    })
    check(
      "plank holdStart survives 4.25s aligned hold",
      first.holdStart === 20_000 && held.holdStart === 20_000 && held.phase === "holding",
      `first=${first.holdStart} held=${held.holdStart}`
    )
    check(
      "plank holdStart resets on broken position and restarts",
      broken.holdStart === null && resumed.holdStart === now,
      `broken=${broken.holdStart} resumed=${resumed.holdStart} expected=${now}`
    )
  }

  const passed = checks.filter((c) => c.pass).length
  console.log(`\n=== ${passed}/${checks.length} independent generator checks passed ===`)
  if (passed !== checks.length) process.exitCode = 1
}

main().catch((error) => {
  console.error("HARNESS ERROR:", error)
  process.exit(2)
})
