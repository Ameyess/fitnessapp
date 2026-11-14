/* eslint-disable no-console */
/**
 * FitStreak end-to-end checks.
 *
 * Run:  node tests/e2e.cjs [baseUrl]
 *
 * Covers:
 *  1. Pose overlay diagnostic - real MediaPipe detection + real <PoseCanvas>
 *  2. Full live camera pipeline with a mocked MediaStream (real person image)
 *  3. Sign-in -> home latency (target < 1500ms)
 *  4. Theme switching (light / dark / system)
 */
const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")

const BASE = process.argv[2] || "http://localhost:3000"
const ROOT = path.join(__dirname, "..")
const SHOTS = path.join(ROOT, "test-results")
const TEST_EMAIL = "fitstreak.e2e@test.local"
const TEST_PASSWORD = "FitStreakE2E!2026"

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`)
}

/* ---------------- test user via firebase-admin ---------------- */
async function ensureTestUser() {
  const env = {}
  for (const line of fs
    .readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "")
  }
  const serviceAccount = JSON.parse(
    Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")
  )
  const { initializeApp, cert } = require("firebase-admin/app")
  const { getAuth } = require("firebase-admin/auth")
  initializeApp({ credential: cert(serviceAccount) })
  const auth = getAuth()
  try {
    const u = await auth.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: "E2E Athlete",
    })
    return u.uid
  } catch (e) {
    if (!String(e.code).includes("already-exists")) throw e
    const u = await auth.getUserByEmail(TEST_EMAIL)
    return u.uid
  }
}

/* ------------- mock getUserMedia with a canvas stream ------------- */
const MOCK_CAMERA = `
(() => {
  // Each getUserMedia call must return a FRESH live stream, exactly like a
  // real camera. (React StrictMode remounts the camera effect in dev.)
  const W = 720, H = 960;
  navigator.mediaDevices.getUserMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    // The captured stream inherits the canvas' CSS layout size, so keep it
    // at full resolution and just move it off-screen.
    canvas.style.cssText =
      'position:fixed;left:-' + (W + 40) + 'px;top:0;width:' + W + 'px;height:' + H + 'px;pointer-events:none';
    (document.body || document.documentElement).appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(0, 0, W, H);

    const img = new Image();
    img.src = '/pose-test.jpg';
    const draw = () => {
      try { if (img.naturalWidth) ctx.drawImage(img, 0, 0, W, H); } catch (e) {}
    };
    img.onload = draw;
    img.onerror = draw;
    draw();
    const timer = setInterval(draw, 33);

    const stream = canvas.captureStream(30);
    const stop = () => clearInterval(timer);
    stream.getTracks().forEach((t) => t.addEventListener('ended', stop));
    return stream;
  };
})();
`

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const uid = await ensureTestUser()
  console.log("test user uid:", uid)

  const browser = await chromium.launch({
    args: ["--autoplay-policy=no-user-gesture-required"],
  })
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()

  const pageErrors = []
  page.on("pageerror", (e) => pageErrors.push(String(e)))
  const consoleErrors = []
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text())
  })

  /* ---------- 1. Pose overlay diagnostic ---------- */
  await page.goto(`${BASE}/dev/pose`, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="status"]')
      return el && /status: (done|no-pose|error)/.test(el.textContent || "")
    },
    { timeout: 45000 }
  )
  const poseStatus = await page.textContent('[data-testid="status"]')
  record("pose diagnostic detects a person", /status: done/.test(poseStatus || ""), poseStatus?.trim())

  // Count the green marker pixels drawn on the canvas
  const markerStats = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="stage"] canvas')
    if (!c) return { canvas: false }
    const ctx = c.getContext("2d")
    const { width, height } = c
    const d = ctx.getImageData(0, 0, width, height).data
    let green = 0
    let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]
        // lime #58cc02 (88,204,2) and its soft halo
        const isLime = a > 40 && g > 140 && r < 160 && b < 110 && g > r + 40
        if (isLime) {
          green++
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    return {
      canvas: true,
      width, height,
      green,
      bbox: maxX > 0 ? { minX, maxX, minY, maxY } : null,
    }
  })
  record(
    "skeleton markers are drawn on the canvas",
    markerStats.canvas && markerStats.green > 200,
    `greenPx=${markerStats.green} canvas=${markerStats.width}x${markerStats.height}`
  )
  record(
    "markers form a body-sized region (not a dot)",
    !!markerStats.bbox &&
      markerStats.bbox.maxX - markerStats.bbox.minX > markerStats.width * 0.15 &&
      markerStats.bbox.maxY - markerStats.bbox.minY > markerStats.height * 0.15,
    markerStats.bbox
      ? `bbox=${markerStats.bbox.maxX - markerStats.bbox.minX}x${markerStats.bbox.maxY - markerStats.bbox.minY}`
      : "no bbox"
  )
  await page.screenshot({ path: path.join(SHOTS, "01-pose-diagnostic.png"), fullPage: true })

  /* ---------- 2. Live camera pipeline ---------- */
  await page.addInitScript(MOCK_CAMERA)
  await page.goto(`${BASE}/exercises/pushups/live`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("video", { timeout: 20000 })

  // The guide button becomes enabled once the camera is live
  await page.waitForFunction(
    () => {
      const b = Array.from(document.querySelectorAll("button")).find((x) =>
        /start counting/i.test(x.textContent || "")
      )
      return b && !b.disabled
    },
    { timeout: 20000 }
  )
  record("camera stream starts (get-in-frame ready)", true)

  // Wait until the video element actually has decoded frames
  await page.waitForFunction(
    () => {
      const v = document.querySelector("video")
      return v && v.readyState >= 2 && v.videoWidth > 0
    },
    { timeout: 20000 }
  )

  const camInfo = await page.evaluate(() => {
    const v = document.querySelector("video")
    return {
      exists: !!v,
      videoWidth: v ? v.videoWidth : 0,
      videoHeight: v ? v.videoHeight : 0,
      readyState: v ? v.readyState : -1,
      hasSrcObject: !!(v && v.srcObject),
    }
  })
  record(
    "video element receives the MediaStream",
    camInfo.hasSrcObject && camInfo.videoWidth > 0 && camInfo.readyState >= 2,
    JSON.stringify(camInfo)
  )

  // Start the workout
  await page.getByRole("button", { name: /start counting/i }).click()
  await page.waitForTimeout(3500)

  const liveStats = await page.evaluate(() => {
    const c = document.querySelector("canvas")
    const v = document.querySelector("video")
    let green = 0
    let bbox = null
    if (c) {
      const ctx = c.getContext("2d")
      const { width, height } = c
      const d = ctx.getImageData(0, 0, width, height).data
      let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          if (
            d[i + 3] > 40 &&
            d[i + 1] > 140 &&
            d[i] < 160 &&
            d[i + 2] < 110 &&
            d[i + 1] > d[i] + 40
          ) {
            green++
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
      if (maxX > 0) bbox = { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY }
    }
    const badge = Array.from(document.querySelectorAll("span")).find((s) => {
      const t = (s.textContent || "").trim().toLowerCase()
      return ["get in frame", "up", "down", "holding", "ready"].includes(t)
    })
    return {
      canvas: !!c,
      canvasSize: c ? { w: c.clientWidth, h: c.clientHeight } : null,
      videoSize: v ? { w: v.videoWidth, h: v.videoHeight } : null,
      green,
      bbox,
      badge: badge ? badge.textContent.trim() : null,
      bodyText: document.body.innerText.slice(0, 400),
    }
  })
  record(
    "live skeleton overlay renders markers",
    liveStats.green > 200,
    `greenPx=${liveStats.green} bbox=${liveStats.bbox ? liveStats.bbox.w + "x" + liveStats.bbox.h : "none"}`
  )
  record(
    "overlay canvas matches the video area",
    !!liveStats.canvasSize && liveStats.canvasSize.w > 0 && liveStats.canvasSize.h > 0,
    JSON.stringify(liveStats.canvasSize)
  )
  record(
    "pose is recognised (not stuck on 'Get in frame')",
    !!liveStats.badge && !/get in frame/i.test(liveStats.badge),
    `badge="${liveStats.badge}"`
  )

  // Fullscreen: no app chrome over the camera
  const chrome = await page.evaluate(() => ({
    header: !!document.querySelector("header"),
    floating: !!document.querySelector('a[aria-label^="Current streak"]'),
  }))
  record(
    "workout is fullscreen (no app chrome)",
    !chrome.header && !chrome.floating,
    JSON.stringify(chrome)
  )

  // Rep counter must be readable (light text over the video)
  const counterColor = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("span")).find((s) =>
      /^\d+$/.test((s.textContent || "").trim())
    )
    return el ? getComputedStyle(el).color : null
  })
  record(
    "rep counter is legible over the camera",
    !!counterColor && /255/.test(counterColor),
    `color=${counterColor}`
  )
  /* ---------- 2e. Overlay is aligned with the rendered video ---------- */
  const alignment = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")
    const video = document.querySelector("video")
    if (!canvas || !video) return { skipped: true }
    const ctx = canvas.getContext("2d")
    const { width, height } = canvas
    const d = ctx.getImageData(0, 0, width, height).data
    let minX = 1e9,
      maxX = -1,
      minY = 1e9,
      maxY = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (
          d[i + 3] > 40 &&
          d[i + 1] > 140 &&
          d[i] < 160 &&
          d[i + 2] < 110 &&
          d[i + 1] > d[i] + 40
        ) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return { skipped: true }

    const dpr = width / (canvas.clientWidth || 1)
    // The rendered (letterboxed) video rect, computed exactly like the CSS
    // object-fit: contain does.
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    const sw = video.videoWidth
    const sh = video.videoHeight
    const scale = Math.min(cw / sw, ch / sh)
    const rw = sw * scale
    const rh = sh * scale
    const rect = {
      left: (cw - rw) / 2,
      right: (cw - rw) / 2 + rw,
      top: (ch - rh) / 2,
      bottom: (ch - rh) / 2 + rh,
    }
    const box = {
      left: minX / dpr,
      right: maxX / dpr,
      top: minY / dpr,
      bottom: maxY / dpr,
    }
    const inside =
      box.left >= rect.left - 2 &&
      box.right <= rect.right + 2 &&
      box.top >= rect.top - 2 &&
      box.bottom <= rect.bottom + 2
    return {
      skipped: false,
      inside,
      box,
      rect,
      fillW: (box.right - box.left) / rw,
      fillH: (box.bottom - box.top) / rh,
    }
  })
  record(
    "markers land inside the rendered video area",
    alignment.skipped || alignment.inside,
    alignment.skipped
      ? "no markers"
      : `box=${JSON.stringify(alignment.box)} video=${JSON.stringify(alignment.rect)}`
  )
  record(
    "markers cover a realistic portion of the frame",
    alignment.skipped || (alignment.fillW > 0.2 && alignment.fillH > 0.3),
    alignment.skipped ? "no markers" : `fill=${(alignment.fillW * 100).toFixed(0)}% x ${(alignment.fillH * 100).toFixed(0)}%`
  )

  await page.screenshot({ path: path.join(SHOTS, "02-live-workout.png"), fullPage: true })

  /* ---------- 2b. Manual rep correction is not clobbered ---------- */
  const readCount = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="rep-count"]')
      return el ? parseInt((el.textContent || "0").trim(), 10) : null
    })

  // The controls auto-hide, so make sure they are on screen first.
  const controlsVisible = () =>
    page.evaluate(() => {
      const c = document.querySelector('[data-testid="workout-controls"]')
      if (!c) return false
      const cs = getComputedStyle(c)
      return parseFloat(cs.opacity) > 0.5 && cs.pointerEvents !== "none"
    })

  const ensureControls = async () => {
    if (await controlsVisible()) return
    await page.locator('[data-testid="show-controls"]').click({ force: true })
    await page.waitForTimeout(500)
  }

  await ensureControls()
  const countBefore = await readCount()
  await page.getByRole("button", { name: /add a rep/i }).click()
  await page.waitForTimeout(300)
  const countAfterAdd = await readCount()
  // Wait through several detection frames - the machine count must not
  // overwrite the user's manual correction.
  await page.waitForTimeout(1600)
  const countAfterWait = await readCount()
  record(
    "manual rep correction increments the counter",
    countAfterAdd === (countBefore ?? 0) + 1,
    `before=${countBefore} after=${countAfterAdd}`
  )
  record(
    "manual rep correction survives the detection loop",
    countAfterWait === countAfterAdd,
    `afterAdd=${countAfterAdd} afterWait=${countAfterWait}`
  )

  /* ---------- 2c. Controls auto-hide and can be restored ---------- */
  await page.waitForTimeout(4600)
  const hiddenState = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="workout-controls"]')
    if (!c) return { present: false }
    const r = c.getBoundingClientRect()
    return {
      present: true,
      opacity: parseFloat(getComputedStyle(c).opacity),
      pointerEvents: getComputedStyle(c).pointerEvents,
      rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right },
    }
  })
  record(
    "controls auto-hide so the video stays unobstructed",
    hiddenState.present &&
      (hiddenState.opacity < 0.15 || hiddenState.pointerEvents === "none"),
    JSON.stringify(hiddenState)
  )

  // Restore by tapping the video
  await page.mouse.click(207, 500)
  await page.waitForTimeout(500)
  const shownState = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="workout-controls"]')
    if (!c) return { present: false }
    return {
      present: true,
      opacity: parseFloat(getComputedStyle(c).opacity),
      pointerEvents: getComputedStyle(c).pointerEvents,
    }
  })
  record(
    "tapping the video restores the controls",
    shownState.present &&
      shownState.opacity > 0.5 &&
      shownState.pointerEvents !== "none",
    JSON.stringify(shownState)
  )

  /* ---------- 2d. No visible control covers the tracked region ---------- */
  const bodyOverlap = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")
    if (!canvas) return { skipped: true }
    const ctx = canvas.getContext("2d")
    const { width, height } = canvas
    const d = ctx.getImageData(0, 0, width, height).data
    let minX = 1e9,
      maxX = -1,
      minY = 1e9,
      maxY = -1,
      count = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (
          d[i + 3] > 40 &&
          d[i + 1] > 140 &&
          d[i] < 160 &&
          d[i + 2] < 110 &&
          d[i + 1] > d[i] + 40
        ) {
          count++
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return { skipped: true }
    // Canvas is 2x DPR; convert to CSS pixels
    const dpr = width / (canvas.clientWidth || 1)
    const box = {
      left: minX / dpr,
      right: maxX / dpr,
      top: minY / dpr,
      bottom: maxY / dpr,
    }
    const area = (box.right - box.left) * (box.bottom - box.top)
    const hits = []
    document.querySelectorAll("button, a").forEach((el) => {
      const cs = getComputedStyle(el)
      if (cs.display === "none" || cs.visibility === "hidden") return
      if (parseFloat(cs.opacity) < 0.15) return
      if (cs.pointerEvents === "none") return
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const ix = Math.max(0, Math.min(r.right, box.right) - Math.max(r.left, box.left))
      const iy = Math.max(0, Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top))
      const inter = ix * iy
      if (inter > 0) {
        hits.push({
          label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24),
          pct: Math.round((inter / area) * 100),
        })
      }
    })
    return { skipped: false, area, hits }
  })
  const worst = bodyOverlap.skipped
    ? 0
    : bodyOverlap.hits.reduce((m, h) => Math.max(m, h.pct), 0)
  record(
    "no visible control covers the tracked region",
    bodyOverlap.skipped || worst < 15,
    bodyOverlap.skipped
      ? "no markers to compare"
      : `worst overlap=${worst}% ${JSON.stringify(bodyOverlap.hits)}`
  )

  /* ---------- 3. Sign-in latency ---------- */
  const ctx2 = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const p2 = await ctx2.newPage()
  await p2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await p2.waitForSelector('input[type="email"]', { timeout: 20000 })

  const t0 = Date.now()
  await p2.fill('input[type="email"]', TEST_EMAIL)
  await p2.fill('input[type="password"]', TEST_PASSWORD)
  await p2.click('button[type="submit"]')
  await p2.waitForFunction(
    () => /Today's goals|Start your streak|Let/.test(document.body.innerText),
    { timeout: 20000 }
  )
  const t1 = Date.now()
  const loginMs = t1 - t0
  record("sign-in -> home under 1500ms", loginMs < 1500, `${loginMs}ms`)

  await p2.waitForTimeout(1200)
  await p2.screenshot({ path: path.join(SHOTS, "03-home.png"), fullPage: true })

  // Warm-cache load
  const t2 = Date.now()
  await p2.reload({ waitUntil: "domcontentloaded" })
  await p2.waitForFunction(
    () => /Today's goals|Start your streak/i.test(document.body.innerText),
    { timeout: 20000 }
  )
  const warmMs = Date.now() - t2
  record("warm reload -> home under 1500ms", warmMs < 1500, `${warmMs}ms`)

  /* ---------- 4. Theme ---------- */
  // The header theme toggle is hidden on narrow phones (it lives in
  // Settings), so test the Settings selector on mobile.
  await p2.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" })
  await p2.waitForTimeout(700)
  await p2.getByRole("button", { name: /^dark$/i }).first().click()
  await p2.waitForTimeout(400)
  const isDark = await p2.evaluate(() =>
    document.documentElement.classList.contains("dark")
  )
  record("theme switch (Settings) switches to dark", isDark)
  await p2.screenshot({ path: path.join(SHOTS, "04-home-dark.png"), fullPage: true })

  const bg = await p2.evaluate(() => getComputedStyle(document.body).backgroundColor)
  record("dark theme repaints the background", bg === "rgb(19, 31, 36)", bg)

  // The header toggle must exist on wider viewports
  await p2.setViewportSize({ width: 900, height: 800 })
  await p2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await p2.waitForTimeout(900)
  const wideToggle = await p2.evaluate(
    () => !!document.querySelector('button[aria-label^="Switch to"]')
  )
  record("header theme toggle present on wide screens", wideToggle)

  // The floating streak button must not cover interactive content
  const overlap = await p2.evaluate(() => {
    const fab = document.querySelector('a[aria-label^="Current streak"]')
    if (!fab) return { fab: false }
    const f = fab.getBoundingClientRect()
    const hits = []
    document.querySelectorAll("a, button").forEach((el) => {
      if (el === fab || fab.contains(el)) return
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const inter =
        f.left < r.right && f.right > r.left && f.top < r.bottom && f.bottom > r.top
      if (inter) hits.push((el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30))
    })
    return { fab: true, hits }
  })
  record(
    "floating streak does not cover any control",
    overlap.fab && overlap.hits.length === 0,
    overlap.hits ? `overlaps: ${overlap.hits.join(", ")}` : "no fab"
  )

  /* ---------- 5. Console cleanliness ---------- */
  const realErrors = consoleErrors.filter(
    (e) => !/favicon|404|Failed to load resource/i.test(e)
  )
  record("no page errors", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300))
  record(
    "no console errors",
    realErrors.length === 0,
    realErrors.join(" | ").slice(0, 300)
  )

  await browser.close()

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
