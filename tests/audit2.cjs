/* eslint-disable no-console */
const { chromium } = require("playwright")
const BASE = process.argv[2] || "http://[::1]:3000"
const EMAIL = "fitstreak.e2e@test.local"
const PASS = "FitStreakE2E!2026"

const MOCK_CAMERA = `
(() => {
  const W = 720, H = 960;
  navigator.mediaDevices.getUserMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.style.cssText = 'position:fixed;left:-' + (W + 40) + 'px;top:0;width:' + W + 'px;height:' + H + 'px;pointer-events:none';
    (document.body || document.documentElement).appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(0, 0, W, H);
    const img = new Image();
    img.src = '/pose-test.jpg';
    const draw = () => { try { if (img.naturalWidth) ctx.drawImage(img, 0, 0, W, H); } catch (e) {} };
    img.onload = draw; img.onerror = draw; draw();
    const timer = setInterval(draw, 33);
    const stream = canvas.captureStream(30);
    stream.getTracks().forEach((t) => t.addEventListener('ended', () => clearInterval(timer)));
    return stream;
  };
})();
`

async function main() {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] })
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  })
  const page = await ctx.newPage()
  const reqs = []
  page.on("request", r => reqs.push({ t: Date.now(), m: r.method(), u: r.url().slice(0, 110), type: r.resourceType() }))
  const errs = []
  page.on("pageerror", e => errs.push("PAGEERR " + String(e)))
  page.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text().slice(0, 200)) })

  // ---- cold path: "/" -> sign-in form ----
  const c0 = Date.now()
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  console.log("COLD_TO_SIGNIN_MS", Date.now() - c0)
  console.log("URL_AFTER_REDIRECT", page.url())

  // ---- login timing with request log ----
  reqs.length = 0
  const t0 = Date.now()
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => /Today's goals|Start your streak/i.test(document.body.innerText), { timeout: 30000 })
  console.log("LOGIN_TO_HOME_MS", Date.now() - t0)
  console.log("REQS", JSON.stringify(reqs.map(r => r.m + " " + r.type + " " + r.u), null, 0))

  // ---- warm reload to home (session persisted) ----
  const t1 = Date.now()
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => /Today's goals|Start your streak/i.test(document.body.innerText), { timeout: 30000 })
  console.log("WARM_RELOAD_TO_HOME_MS", Date.now() - t1)

  // ---- LVR: live camera ----
  await page.addInitScript(MOCK_CAMERA)
  const lc0 = Date.now()
  await page.goto(BASE + "/exercises/pushups/live", { waitUntil: "domcontentloaded" })
  await page.waitForSelector("video", { timeout: 20000 })
  await page.waitForFunction(() => {
    const b = Array.from(document.querySelectorAll("button")).find(x => /start counting/i.test(x.textContent || ""))
    return b && !b.disabled
  }, { timeout: 30000 })
  console.log("CAMERA_READY_MS", Date.now() - lc0)

  const tStart = Date.now()
  await page.getByRole("button", { name: /start counting/i }).click()
  // wait until canvas has green pixels
  let greenCount = 0
  for (let i = 0; i < 60; i++) {
    greenCount = await page.evaluate(() => {
      const c = document.querySelector("canvas")
      if (!c) return 0
      const ctx2 = c.getContext("2d")
      const d = ctx2.getImageData(0, 0, c.width, c.height).data
      let g = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 40 && d[i + 1] > 140 && d[i] < 160 && d[i + 2] < 110 && d[i + 1] > d[i] + 40) g++
      }
      return g
    })
    if (greenCount > 200) break
    await page.waitForTimeout(250)
  }
  console.log("FIRST_MARKERS_MS", Date.now() - tStart, "green", greenCount)

  await page.waitForTimeout(1500)

  const live = await page.evaluate(() => {
    const v = document.querySelector("video")
    const c = document.querySelector("canvas")
    // sample the video frame brightness by drawing it to an offscreen canvas
    let vidSample = null
    try {
      const off = document.createElement("canvas")
      off.width = 60; off.height = 60
      const octx = off.getContext("2d")
      octx.drawImage(v, 0, 0, 60, 60)
      const d = octx.getImageData(0, 0, 60, 60).data
      let sum = 0, n = 0, maxL = 0
      for (let i = 0; i < d.length; i += 4) { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; sum += l; n++; if (l > maxL) maxL = l }
      vidSample = { meanLuma: +(sum / n).toFixed(1), maxLuma: +maxL.toFixed(1) }
    } catch (e) { vidSample = String(e) }
    const canvasRect = c ? c.getBoundingClientRect() : null
    const videoRect = v ? v.getBoundingClientRect() : null
    // HUD elements
    const hud = []
    document.querySelectorAll("button,span,div").forEach(el => {
      const t = (el.textContent || "").trim()
      if (/^(PUSHUPS|Finish|Fix count|Get in frame)$/i.test(t) || /reps$/i.test(t)) {
        const r = el.getBoundingClientRect()
        if (r.width > 20 && r.height > 10) hud.push({ t: t.slice(0, 24), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) })
      }
    })
    return {
      videoSize: v ? { w: v.videoWidth, h: v.videoHeight } : null,
      readyState: v ? v.readyState : -1,
      paused: v ? v.paused : null,
      videoTransform: v ? getComputedStyle(v).transform : null,
      vidSample,
      canvasRect: canvasRect ? { x: Math.round(canvasRect.x), y: Math.round(canvasRect.y), w: Math.round(canvasRect.width), h: Math.round(canvasRect.height) } : null,
      videoRect: videoRect ? { x: Math.round(videoRect.x), y: Math.round(videoRect.y), w: Math.round(videoRect.width), h: Math.round(videoRect.height) } : null,
      hud,
      bodyText: document.body.innerText.slice(0, 300),
    }
  })
  console.log("LIVE", JSON.stringify(live, null, 1))
  await page.screenshot({ path: "test-results/audit-live.png" })

  console.log("ERRORS", JSON.stringify(errs.slice(0, 10)))
  await browser.close()
}
main().catch(e => { console.error("HARNESS", e); process.exit(2) })
