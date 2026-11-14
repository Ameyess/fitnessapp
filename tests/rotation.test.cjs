/* eslint-disable no-console */
/**
 * Unit tests for the camera rotation maths.
 *
 * Bundles the REAL src/lib/camera/rotation.ts with esbuild and drives it, so
 * we test the shipped logic - not a copy of it.
 *
 * Run: node tests/rotation.test.cjs
 */
const path = require("path")
const os = require("os")
const esbuild = require("esbuild")

const ROOT = path.join(__dirname, "..")
const OUT = path.join(os.tmpdir(), "fitstreak-rotation.cjs")

const results = []
function check(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`)
}

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

async function load() {
  await esbuild.build({
    entryPoints: [path.join(ROOT, "src/lib/camera/rotation.ts")],
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
  const R = await load()
  const {
    mapPoint,
    rotatedSize,
    pickFit,
    chooseRotation,
    nextRotation,
  } = R

  /* ---------------- mapPoint: no mirror ---------------- */
  {
    const u = 0.25
    const v = 0.75
    const p0 = mapPoint(u, v, 0, false)
    check(
      "mapPoint 0deg is the identity",
      near(p0.x, u) && near(p0.y, v),
      JSON.stringify(p0)
    )

    const p90 = mapPoint(u, v, 90, false)
    check(
      "mapPoint 90deg rotates clockwise",
      near(p90.x, 1 - v) && near(p90.y, u),
      JSON.stringify(p90)
    )

    const p180 = mapPoint(u, v, 180, false)
    check(
      "mapPoint 180deg is a half turn",
      near(p180.x, 1 - u) && near(p180.y, 1 - v),
      JSON.stringify(p180)
    )

    const p270 = mapPoint(u, v, 270, false)
    check(
      "mapPoint 270deg rotates counter-clockwise",
      near(p270.x, v) && near(p270.y, 1 - u),
      JSON.stringify(p270)
    )
  }

  /* ---------------- mapPoint: mirror is applied in SOURCE space first ---------------- */
  {
    const u = 0.25
    const v = 0.75
    const m0 = mapPoint(u, v, 0, true)
    check(
      "mapPoint mirrors in source space",
      near(m0.x, 1 - u) && near(m0.y, v),
      JSON.stringify(m0)
    )

    // mirror then rotate == rotate(1-v, u)
    const m90 = mapPoint(u, v, 90, true)
    const expectX = 1 - v
    const expectY = 1 - u
    check(
      "mapPoint mirrors BEFORE rotating",
      near(m90.x, expectX) && near(m90.y, expectY),
      `${JSON.stringify(m90)} expected ${JSON.stringify({ x: expectX, y: expectY })}`
    )

    // rotating then mirroring would give (1-(1-v), 1-u) = (v, 1-u) - a
    // different point, so this really does test the composition order.
    check(
      "mirror+rotate is not rotate+mirror",
      !near(m90.x, v) || !near(m90.y, 1 - u),
      JSON.stringify(m90)
    )
  }

  /* ---------------- rotatedSize ---------------- */
  {
    const s0 = rotatedSize(0, 1280, 720)
    const s90 = rotatedSize(90, 1280, 720)
    const s180 = rotatedSize(180, 1280, 720)
    const s270 = rotatedSize(270, 1280, 720)
    check(
      "rotatedSize swaps the axes for 90/270",
      s0.width === 1280 &&
        s0.height === 720 &&
        s90.width === 720 &&
        s90.height === 1280 &&
        s180.width === 1280 &&
        s180.height === 720 &&
        s270.width === 720 &&
        s270.height === 1280,
      JSON.stringify({ s0, s90, s180, s270 })
    )
  }

  /* ---------------- pickFit ---------------- */
  {
    const phoneStream = 720 / 1280 // 0.5625
    const phoneViewport = 414 / 896 // 0.462
    check(
      "pickFit covers a phone-shaped stream on a phone screen",
      pickFit(phoneStream, phoneViewport) === "cover",
      pickFit(phoneStream, phoneViewport)
    )

    const tallStream = 720 / 960 // 0.75 - the e2e mock
    check(
      "pickFit contains a badly mismatched stream (never crop the user out)",
      pickFit(tallStream, phoneViewport) === "contain",
      pickFit(tallStream, phoneViewport)
    )

    check(
      "pickFit covers matching aspects",
      pickFit(phoneViewport, phoneViewport) === "cover",
      pickFit(phoneViewport, phoneViewport)
    )
  }

  /* ---------------- nextRotation ---------------- */
  {
    check("nextRotation cycles 0 -> 90", nextRotation(0) === 90, String(nextRotation(0)))
    check("nextRotation cycles 90 -> 180", nextRotation(90) === 180, String(nextRotation(90)))
    check("nextRotation cycles 180 -> 270", nextRotation(180) === 270, String(nextRotation(180)))
    check("nextRotation cycles 270 -> 0", nextRotation(270) === 0, String(nextRotation(270)))
  }

  /* ---------------- chooseRotation ---------------- */
  {
    // Portrait stream on a portrait screen: never rotate.
    const r1 = chooseRotation({
      streamWidth: 720,
      streamHeight: 960,
      viewportWidth: 414,
      viewportHeight: 896,
      upVector: null,
    })
    check("a portrait stream on a portrait screen is not rotated", r1 === 0, String(r1))

    // Landscape stream on a portrait screen: rotate to a vertical view.
    const r2 = chooseRotation({
      streamWidth: 1280,
      streamHeight: 720,
      viewportWidth: 414,
      viewportHeight: 896,
      upVector: null,
    })
    check(
      "a landscape stream on a portrait screen is rotated",
      r2 === 90 || r2 === 270,
      String(r2)
    )

    // The person is already upright in the source frame -> keep it upright.
    const r3 = chooseRotation({
      streamWidth: 1280,
      streamHeight: 720,
      viewportWidth: 414,
      viewportHeight: 896,
      upVector: { x: 0, y: -0.3 }, // shoulder above hip
    })
    check(
      "an upright pose is not rotated",
      r3 === 0,
      String(r3)
    )

    // The person lies sideways in the source frame -> pick the rotation that
    // puts them back upright, whatever the direction.
    const r4 = chooseRotation({
      streamWidth: 1280,
      streamHeight: 720,
      viewportWidth: 414,
      viewportHeight: 896,
      upVector: { x: 0.3, y: 0 }, // shoulder to the RIGHT of the hip
    })
    // The mapping is affine, so the rotated vector is tip - origin.
    const origin = mapPoint(0, 0, r4, false)
    const tip = mapPoint(0.3, 0, r4, false)
    const dx = tip.x - origin.x
    const dy = tip.y - origin.y
    check(
      "a sideways pose is rotated so the person ends up upright",
      (r4 === 90 || r4 === 270) && dy < 0 && Math.abs(dy) >= Math.abs(dx),
      `rotation=${r4} up=(${dx.toFixed(3)}, ${dy.toFixed(3)})`
    )
  }

  const passed = results.filter((r) => r.pass).length
  console.log(`\n=== ${passed}/${results.length} checks passed ===`)
  results.forEach((r) => {
    if (!r.pass) console.log(`  FAILED: ${r.name} :: ${r.detail || ""}`)
  })
  process.exit(passed === results.length ? 0 : 1)
}

main().catch((e) => {
  console.error("HARNESS ERROR:", e)
  process.exit(2)
})
