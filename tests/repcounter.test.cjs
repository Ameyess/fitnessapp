/* eslint-disable no-console */
/**
 * Unit tests for the rep-counting state machine.
 *
 * Bundles the REAL src/lib/exercises/repCounter.ts with esbuild and drives
 * it with synthetic landmarks, so we test the shipped logic - not a copy.
 *
 * Run: node tests/repcounter.test.cjs
 */
const path = require("path")
const fs = require("fs")
const os = require("os")
const esbuild = require("esbuild")

const ROOT = path.join(__dirname, "..")
const OUT = path.join(os.tmpdir(), "fitstreak-repcounter.cjs")

const results = []
function check(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`)
}

/* ---------------- synthetic landmark helpers ---------------- */

/** Build a landmark array where the elbow angle (shoulder-elbow-wrist)
 *  is exactly `deg` degrees. */
function pushupLandmarks(deg) {
  const S = { x: 0.2, y: 0.3 }
  const E = { x: 0.3, y: 0.5 }
  const esDir = Math.atan2(S.y - E.y, S.x - E.x)
  const len = Math.hypot(S.x - E.x, S.y - E.y)
  const ang = esDir + (deg * Math.PI) / 180
  const W = { x: E.x + len * Math.cos(ang), y: E.y + len * Math.sin(ang) }

  const lm = new Array(33).fill(null).map(() => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }))

  const set = (i, p) => {
    lm[i] = { x: p.x, y: p.y, z: 0, visibility: 1 }
  }
  set(11, S)
  set(13, E)
  set(15, W)
  // mirrored right side
  set(12, { x: 1 - S.x, y: S.y })
  set(14, { x: 1 - E.x, y: E.y })
  set(16, { x: 1 - W.x, y: W.y })
  set(23, { x: 0.45, y: 0.75 })
  set(24, { x: 0.55, y: 0.75 })
  set(25, { x: 0.45, y: 0.9 })
  set(26, { x: 0.55, y: 0.9 })
  set(27, { x: 0.45, y: 1.0 })
  set(28, { x: 0.55, y: 1.0 })
  return lm
}

/** Build landmarks where the hip angle (shoulder-hip-knee) is `deg`. */
function situpLandmarks(deg) {
  const S = { x: 0.5, y: 0.2 }
  const H = { x: 0.5, y: 0.5 }
  const shDir = Math.atan2(S.y - H.y, S.x - H.x)
  const len = Math.hypot(S.x - H.x, S.y - H.y)
  const ang = shDir + (deg * Math.PI) / 180
  const K = { x: H.x + len * Math.cos(ang), y: H.y + len * Math.sin(ang) }

  const lm = new Array(33).fill(null).map(() => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }))
  const set = (i, p) => {
    lm[i] = { x: p.x, y: p.y, z: 0, visibility: 1 }
  }
  set(11, S)
  set(23, H)
  set(25, K)
  set(12, { x: 1 - S.x, y: S.y })
  set(24, { x: 1 - H.x, y: H.y })
  set(26, { x: 1 - K.x, y: K.y })
  return lm
}

/** A straight, aligned plank (shoulder-hip-ankle ~180 deg). */
function plankLandmarks(aligned) {
  const lm = new Array(33).fill(null).map(() => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }))
  const set = (i, p) => {
    lm[i] = { x: p.x, y: p.y, z: 0, visibility: 1 }
  }
  if (aligned) {
    set(11, { x: 0.2, y: 0.5 })
    set(23, { x: 0.5, y: 0.5 })
    set(27, { x: 0.8, y: 0.5 })
    set(12, { x: 0.2, y: 0.52 })
    set(24, { x: 0.5, y: 0.52 })
    set(28, { x: 0.8, y: 0.52 })
  } else {
    set(11, { x: 0.2, y: 0.4 })
    set(23, { x: 0.5, y: 0.5 })
    set(27, { x: 0.75, y: 0.9 })
    set(12, { x: 0.2, y: 0.42 })
    set(24, { x: 0.5, y: 0.52 })
    set(28, { x: 0.75, y: 0.92 })
  }
  return lm
}

/**
 * Realistic floor-exercise geometry: the torso is raised `elev` degrees off
 * the floor. `kneeX` moves the knees around to prove the measurement is
 * independent of leg position (the old hip-interior-angle approach was not).
 */
function torsoLandmarks(elev, kneeX = 0.78) {
  const hip = { x: 0.55, y: 0.62 }
  const rad = (elev * Math.PI) / 180
  // shoulder is `len` away from the hip, raised `elev` degrees from horizontal
  const len = 0.3
  const shoulder = {
    x: hip.x - len * Math.cos(rad),
    y: hip.y - len * Math.sin(rad),
  }
  const knee = { x: kneeX, y: 0.72 }

  const lm = new Array(33).fill(null).map(() => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }))
  const set = (i, p) => {
    lm[i] = { x: p.x, y: p.y, z: 0, visibility: 1 }
  }
  set(11, shoulder)
  set(23, hip)
  set(25, knee)
  set(12, { x: 1 - shoulder.x, y: shoulder.y })
  set(24, { x: 1 - hip.x, y: hip.y })
  set(26, { x: 1 - knee.x, y: knee.y })
  return lm
}

/**
 * Jumping-jack geometry.
 *
 * The counter measures the shoulder -> wrist angle against the vertical:
 * 0deg = arms straight down at the sides, 180deg = arms straight overhead.
 * `deg` is that measured angle.
 */
function jumpingJackLandmarks(deg) {
  const rad = (deg * Math.PI) / 180
  const lm = new Array(33).fill(null).map(() => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }))
  const set = (i, p) => {
    lm[i] = { x: p.x, y: p.y, z: 0, visibility: 1 }
  }
  const len = 0.4
  for (const [shoulderIdx, wristIdx, sx] of [
    [11, 15, 0.45],
    [12, 16, 0.55],
  ]) {
    const sy = 0.3
    // The reference point the counter uses sits 0.1 above the shoulder.
    const ref = { x: sx, y: sy - 0.1 }
    // Rotate the downward reference vector by `deg` to get the wrist.
    const dx = -Math.sin(rad)
    const dy = Math.cos(rad)
    set(shoulderIdx, { x: sx, y: sy })
    set(wristIdx, { x: ref.x + len * dx, y: ref.y + len * dy })
  }
  set(23, { x: 0.45, y: 0.65 })
  set(24, { x: 0.55, y: 0.65 })
  set(25, { x: 0.44, y: 0.85 })
  set(26, { x: 0.56, y: 0.85 })
  set(27, { x: 0.43, y: 0.98 })
  set(28, { x: 0.57, y: 0.98 })
  return lm
}

/* ---------------- test runner ---------------- */
async function load() {
  await esbuild.build({
    entryPoints: [path.join(ROOT, "src/lib/exercises/repCounter.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: OUT,
    alias: { "@": path.join(ROOT, "src") },
    logLevel: "silent",
  })
  return require(OUT)
}

async function main() {
  const { createRepCounter } = await load()
  const EX_OUT = path.join(os.tmpdir(), "fitstreak-exercises.cjs")
  await esbuild.build({
    entryPoints: [path.join(ROOT, "src/lib/exercises/index.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: EX_OUT,
    alias: { "@": path.join(ROOT, "src") },
    logLevel: "silent",
  })
  const { exerciseRegistry } = require(EX_OUT)

  /* ---- 1. pushups: down-to-up ---- */
  {
    const cfg = exerciseRegistry.pushups
    const c = createRepCounter(cfg)
    let t = 1000
    // start extended (up)
    c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    check("pushups: extended arms register as 'up'", c.getState().phase === "up", c.getState().phase)

    t += 500
    c.update({ config: cfg, landmarks: pushupLandmarks(90), now: t })
    check("pushups: bent arms register as 'down'", c.getState().phase === "down", c.getState().phase)
    check("pushups: lowering does not count a rep", c.getState().reps === 0, `reps=${c.getState().reps}`)

    t += 500
    c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    check("pushups: pushing up counts 1 rep", c.getState().reps === 1, `reps=${c.getState().reps}`)

    // second rep
    t += 500
    c.update({ config: cfg, landmarks: pushupLandmarks(90), now: t })
    t += 500
    c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    check("pushups: second cycle counts 2 reps", c.getState().reps === 2, `reps=${c.getState().reps}`)

    // third rep
    t += 500
    c.update({ config: cfg, landmarks: pushupLandmarks(90), now: t })
    t += 500
    c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    check("pushups: third cycle counts 3 reps", c.getState().reps === 3, `reps=${c.getState().reps}`)
  }

  /* ---- 1b. fast cadence (400ms) must still count ---- */
  {
    const cfg = exerciseRegistry.pushups
    const c = createRepCounter(cfg)
    let t = 1000
    c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    for (let i = 0; i < 3; i++) {
      t += 200
      c.update({ config: cfg, landmarks: pushupLandmarks(90), now: t })
      t += 200
      c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    }
    check("pushups: fast 400ms cadence still counts 3 reps", c.getState().reps === 3, `reps=${c.getState().reps}`)
  }

  /* ---- 2. hysteresis: jitter around the threshold must not count ---- */
  {
    const cfg = exerciseRegistry.pushups
    const c = createRepCounter(cfg)
    let t = 1000
    c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    // jiggle between 155 and 168 -> both are in the hysteresis band
    for (let i = 0; i < 20; i++) {
      t += 100
      c.update({
        config: cfg,
        landmarks: pushupLandmarks(i % 2 ? 155 : 168),
        now: t,
      })
    }
    check("hysteresis: jitter in the band does not count reps", c.getState().reps === 0, `reps=${c.getState().reps}`)
  }

  /* ---- 3. cooldown: rapid double transition must not double count ---- */
  {
    const cfg = exerciseRegistry.pushups
    const c = createRepCounter(cfg)
    let t = 1000
    c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    t += 100
    c.update({ config: cfg, landmarks: pushupLandmarks(90), now: t })
    t += 100
    c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    const afterFirst = c.getState().reps
    // bounce again immediately (< 700ms)
    t += 100
    c.update({ config: cfg, landmarks: pushupLandmarks(90), now: t })
    t += 100
    c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    check(
      "cooldown: rapid bounce does not double count",
      afterFirst === 1 && c.getState().reps === 1,
      `reps=${c.getState().reps}`
    )
  }

  /* ---- 4. situps: up-to-down (torso elevation) ---- */
  {
    const cfg = exerciseRegistry.situps
    const c = createRepCounter(cfg)
    let t = 1000
    c.update({ config: cfg, landmarks: torsoLandmarks(5), now: t }) // lying
    check("situps: lying down is the start phase", c.getState().phase === "down", c.getState().phase)
    t += 500
    c.update({ config: cfg, landmarks: torsoLandmarks(75), now: t }) // sat up
    check("situps: sitting up registers as 'up'", c.getState().phase === "up", c.getState().phase)
    check("situps: sitting up does not count yet", c.getState().reps === 0, `reps=${c.getState().reps}`)
    t += 500
    c.update({ config: cfg, landmarks: torsoLandmarks(5), now: t }) // back down
    check("situps: lying back down counts 1 rep", c.getState().reps === 1, `reps=${c.getState().reps}`)
    t += 500
    c.update({ config: cfg, landmarks: torsoLandmarks(75), now: t })
    t += 500
    c.update({ config: cfg, landmarks: torsoLandmarks(5), now: t })
    check("situps: second cycle counts 2 reps", c.getState().reps === 2, `reps=${c.getState().reps}`)
  }

  /* ---- 4b. crunches ---- */
  {
    const cfg = exerciseRegistry.crunches
    const c = createRepCounter(cfg)
    let t = 1000
    c.update({ config: cfg, landmarks: torsoLandmarks(5), now: t })
    check("crunches: lying down is the start phase", c.getState().phase === "down", c.getState().phase)
    t += 500
    c.update({ config: cfg, landmarks: torsoLandmarks(40), now: t })
    check("crunches: crunching up registers as 'up'", c.getState().phase === "up", c.getState().phase)
    t += 500
    c.update({ config: cfg, landmarks: torsoLandmarks(5), now: t })
    check("crunches: lying back down counts 1 rep", c.getState().reps === 1, `reps=${c.getState().reps}`)
  }

  /* ---- 4c. REALISTIC floor geometry (torso elevation off the floor).
         The old interior-hip-angle approach failed here because the hip
         angle shifts with the position of the knees. ---- */
  for (const [name, cfgName, downElev, upElev] of [
    ["situps", "situps", 5, 75],
    ["crunches", "crunches", 5, 40],
  ]) {
    const cfg = exerciseRegistry[cfgName]
    for (const kneeX of [0.78, 0.62, 0.9]) {
      const c = createRepCounter(cfg)
      let t = 1000
      c.update({ config: cfg, landmarks: torsoLandmarks(downElev, kneeX), now: t })
      const downPhase = c.getState().phase
      t += 500
      c.update({ config: cfg, landmarks: torsoLandmarks(upElev, kneeX), now: t })
      const upPhase = c.getState().phase
      t += 500
      c.update({ config: cfg, landmarks: torsoLandmarks(downElev, kneeX), now: t })
      check(
        `${name}: counts a rep with knees at x=${kneeX} (realistic geometry)`,
        c.getState().reps === 1 && downPhase === "down" && upPhase === "up",
        `phases=${downPhase}/${upPhase} reps=${c.getState().reps}`
      )
    }
  }

  /* ---- 4e. jumping jacks: a PARTIAL raise must not re-arm the counter ----
         The old thresholds (down 150 / up 60) had no hysteresis band, so a
         raise to 140deg re-armed the machine and the next full raise was
         counted as a second rep. ---- */
  {
    const cfg = exerciseRegistry.jumpingjacks
    const c = createRepCounter(cfg)
    let t = 1000
    c.update({ config: cfg, landmarks: jumpingJackLandmarks(12), now: t })
    check(
      "jumping jacks: arms down is the start phase",
      c.getState().phase === "down",
      c.getState().phase
    )
    t += 500
    c.update({ config: cfg, landmarks: jumpingJackLandmarks(172), now: t })
    check(
      "jumping jacks: arms overhead registers as 'up'",
      c.getState().phase === "up",
      c.getState().phase
    )
    check(
      "jumping jacks: raising the arms counts 1 rep",
      c.getState().reps === 1,
      `reps=${c.getState().reps}`
    )
    t += 500
    c.update({ config: cfg, landmarks: jumpingJackLandmarks(140), now: t })
    t += 500
    c.update({ config: cfg, landmarks: jumpingJackLandmarks(172), now: t })
    check(
      "jumping jacks: a partial raise does not count a second rep",
      c.getState().reps === 1,
      `reps=${c.getState().reps}`
    )
  }

  /* ---- 4f. jumping jacks: a full cycle still counts every rep ----
         The counter needs a complete arms-down -> arms-up cycle, so the
         sequence starts from the arms-down position. ---- */
  {
    const cfg = exerciseRegistry.jumpingjacks
    const c = createRepCounter(cfg)
    let t = 1000
    c.update({ config: cfg, landmarks: jumpingJackLandmarks(12), now: t })
    for (let cycle = 0; cycle < 3; cycle++) {
      t += 500
      c.update({ config: cfg, landmarks: jumpingJackLandmarks(172), now: t })
      t += 500
      c.update({ config: cfg, landmarks: jumpingJackLandmarks(12), now: t })
    }
    check(
      "jumping jacks: three full cycles count 3 reps",
      c.getState().reps === 3,
      `reps=${c.getState().reps}`
    )
  }

  /* ---- 4d. leg position must not change the measurement ---- */
  {
    const cfg = exerciseRegistry.situps
    const a = createRepCounter(cfg)
    const b = createRepCounter(cfg)
    let t = 1000
    a.update({ config: cfg, landmarks: torsoLandmarks(70, 0.78), now: t })
    b.update({ config: cfg, landmarks: torsoLandmarks(70, 0.62), now: t })
    check(
      "situps: measured angle is independent of knee position",
      Math.abs((a.getState().angle ?? 0) - (b.getState().angle ?? 0)) < 0.001,
      `${a.getState().angle} vs ${b.getState().angle}`
    )
  }

  /* ---- 6b. plank: hold time must be real hold time ---- */
  {
    const cfg = exerciseRegistry.planks
    const c = createRepCounter(cfg)
    let t = 1000
    c.update({ config: cfg, landmarks: plankLandmarks(true), now: t })
    check("plank: holdStart is set when aligned", c.getState().holdStart === t, `holdStart=${c.getState().holdStart}`)
    t += 3000
    c.update({ config: cfg, landmarks: plankLandmarks(true), now: t })
    check("plank: holdStart is preserved while holding", c.getState().holdStart === 1000, `holdStart=${c.getState().holdStart}`)
    // break the position - the hold must reset
    t += 1000
    c.update({ config: cfg, landmarks: plankLandmarks(false), now: t })
    check("plank: holdStart resets when the position breaks", c.getState().holdStart === null, `holdStart=${c.getState().holdStart}`)
    // resume holding
    t += 1000
    c.update({ config: cfg, landmarks: plankLandmarks(true), now: t })
    check("plank: a new hold starts from now", c.getState().holdStart === t, `holdStart=${c.getState().holdStart}`)
  }

  /* ---- 5. out of frame pauses counting ---- */
  {
    const cfg = exerciseRegistry.pushups
    const c = createRepCounter(cfg)
    let t = 1000
    c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    t += 100
    c.update({ config: cfg, landmarks: pushupLandmarks(90), now: t })
    // landmarks disappear
    t += 100
    c.update({ config: cfg, landmarks: null, now: t })
    check("not in frame: state resets to resting", c.getState().inFrame === false && c.getState().phase === "resting", `inFrame=${c.getState().inFrame}`)
    t += 100
    c.update({ config: cfg, landmarks: pushupLandmarks(175), now: t })
    check("not in frame: no rep counted while absent", c.getState().reps === 0, `reps=${c.getState().reps}`)
  }

  /* ---- 6. plank: alignment detection ---- */
  {
    const cfg = exerciseRegistry.planks
    const c = createRepCounter(cfg)
    let t = 1000
    c.update({ config: cfg, landmarks: plankLandmarks(true), now: t })
    check("plank: aligned body registers as holding", c.getState().phase === "holding", c.getState().phase)
    t += 100
    c.update({ config: cfg, landmarks: plankLandmarks(false), now: t })
    check("plank: bent body registers as not holding", c.getState().phase !== "holding", c.getState().phase)
  }

  console.log(
    `\n=== ${results.filter((r) => r.pass).length}/${results.length} unit checks passed ===`
  )
  results.filter((r) => !r.pass).forEach((r) => console.log(`  FAILED: ${r.name} :: ${r.detail || ""}`))
  process.exit(results.every((r) => r.pass) ? 0 : 1)
}

main().catch((e) => {
  console.error("HARNESS ERROR:", e)
  process.exit(2)
})
