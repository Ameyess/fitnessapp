/* eslint-disable no-console */
/**
 * Independent Round 3 DOM measurements.
 * Run: node tests/qa-round3-ui.cjs http://localhost:3000
 */
const path = require("path")
const fs = require("fs")
const { chromium } = require("playwright")

const BASE = process.argv[2] || "http://localhost:3000"
const ROOT = path.join(__dirname, "..")
const SHOTS = path.join(ROOT, "test-results")
const EMAIL = "fitstreak.e2e@test.local"
const PASSWORD = "FitStreakE2E!2026"

const MOCK_CAMERA = `
(() => {
  const W = 720, H = 960;
  window.__fitStreakCameraCalls = [];
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    window.__fitStreakCameraCalls.push(JSON.parse(JSON.stringify(constraints || null)));
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + W + 'px;height:' + H + 'px';
    document.documentElement.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(0, 0, W, H);
    const img = new Image(); img.src = '/pose-test.jpg';
    const draw = () => { try { if (img.naturalWidth) ctx.drawImage(img, 0, 0, W, H); } catch (e) {} };
    img.onload = draw; img.onerror = draw; draw();
    const timer = setInterval(draw, 33);
    const stream = canvas.captureStream(30);
    stream.getTracks().forEach((t) => t.addEventListener('ended', () => clearInterval(timer)));
    return stream;
  };
})();
`

function luminance(hex) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const linear = rgb.map((v) =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(a, b) {
  const hi = Math.max(luminance(a), luminance(b))
  const lo = Math.min(luminance(a), luminance(b))
  return (hi + 0.05) / (lo + 0.05)
}

async function login(page, timeout = 20000) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  const started = Date.now()
  await page.click('button[type="submit"]')
  await page.waitForFunction(
    () => /Today's goals|Start your streak|Let/.test(document.body.innerText),
    { timeout }
  )
  return Date.now() - started
}

async function measureHeader(page, width) {
  await page.setViewportSize({ width, height: 740 })
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => /Today's goals/.test(document.body.innerText), {
    timeout: 20000,
  })
  await page.waitForTimeout(150)
  const result = await page.evaluate(() => {
    const header = document.querySelector("header")
    const controls = Array.from(header?.querySelectorAll("a,button") || [])
      .map((el, index) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return {
          index,
          label: el.getAttribute("aria-label") || el.textContent?.trim() || el.tagName,
          display: cs.display,
          visibility: cs.visibility,
          opacity: Number(cs.opacity),
          left: +r.left.toFixed(2),
          right: +r.right.toFixed(2),
          top: +r.top.toFixed(2),
          bottom: +r.bottom.toFixed(2),
          width: +r.width.toFixed(2),
          height: +r.height.toFixed(2),
          color: cs.color,
          background: cs.backgroundColor,
        }
      })
      .filter((x) => x.display !== "none" && x.visibility !== "hidden" && x.width > 0)

    const clipped = controls.filter(
      (x) => x.left < -0.5 || x.right > innerWidth + 0.5 || x.top < -0.5
    )
    const overlaps = []
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i]
        const b = controls[j]
        const iw = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        const ih = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
        if (iw > 0 && ih > 0) overlaps.push([a.label, b.label, +(iw * ih).toFixed(1)])
      }
    }
    const root = getComputedStyle(document.documentElement)
    const vars = Object.fromEntries(
      [
        "--c-surface",
        "--c-faint",
        "--c-flame-soft",
        "--c-flame-text",
        "--c-primary-soft",
        "--c-primary-text",
      ].map((name) => [name, root.getPropertyValue(name).trim()])
    )
    return {
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      header: header ? {
        left: header.getBoundingClientRect().left,
        right: header.getBoundingClientRect().right,
        width: header.getBoundingClientRect().width,
      } : null,
      controls,
      clipped,
      overlaps,
      vars,
      themeToggleDisplay: getComputedStyle(
        document.querySelector('button[aria-label^="Switch to"]') || document.body
      ).display,
    }
  })
  await page.screenshot({
    path: path.join(SHOTS, `qa-header-${width}.png`),
    fullPage: false,
  })
  return result
}

async function measureLive(browser) {
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  await context.addInitScript(MOCK_CAMERA)
  const page = await context.newPage()
  await login(page)
  await page.goto(`${BASE}/exercises/pushups/live`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("video", { timeout: 20000 })
  await page.waitForFunction(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) =>
      /start counting/i.test(x.textContent || "")
    )
    return b && !b.disabled
  }, { timeout: 20000 })
  await page.waitForFunction(() => {
    const v = document.querySelector("video")
    return v && v.readyState >= 2 && v.videoWidth > 0
  }, { timeout: 20000 })

  await page.getByRole("button", { name: /start counting/i }).click()
  const start = Date.now()
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-testid="workout-controls"]')
    return c && Number(getComputedStyle(c).opacity) < 0.15
  }, { timeout: 10000 })
  const hideAfterMs = Date.now() - start

  const hidden = await page.evaluate(() => {
    const controls = document.querySelector('[data-testid="workout-controls"]')
    const overlay = document.querySelector('[data-testid="show-controls"]')
    const add = document.querySelector('button[aria-label="Add a rep"]')
    const close = document.querySelector('button[aria-label="Close workout"]')
    const switchCamera = document.querySelector('button[aria-label="Switch camera"]')
    const toggleSound = document.querySelector('button[aria-label="Toggle sound"]')
    const probe = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return hit?.getAttribute("aria-label") || hit?.getAttribute("data-testid") || hit?.tagName
    }
    return {
      controlsOpacity: Number(getComputedStyle(controls).opacity),
      controlsPointerEvents: getComputedStyle(controls).pointerEvents,
      overlayOpacity: Number(getComputedStyle(overlay).opacity),
      overlayPointerEvents: getComputedStyle(overlay).pointerEvents,
      addHitTarget: probe(add),
      closeHitTarget: probe(close),
      switchCameraHitTarget: probe(switchCamera),
      toggleSoundHitTarget: probe(toggleSound),
    }
  })

  // Restore by tapping the video, then measure visible controls against markers.
  await page.mouse.click(207, 500)
  await page.waitForTimeout(350)
  const shownAndOverlap = await page.evaluate(() => {
    const controls = document.querySelector('[data-testid="workout-controls"]')
    const canvas = document.querySelector("canvas")
    const ctx = canvas.getContext("2d")
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, skeleton = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
        const green = a > 40 && g > 140 && r < 160 && b < 110 && g > r + 40
        const orange = a > 40 && r > 210 && g > 100 && g < 190 && b < 70
        if (green || orange) {
          skeleton++
          minX = Math.min(minX, x); maxX = Math.max(maxX, x)
          minY = Math.min(minY, y); maxY = Math.max(maxY, y)
        }
      }
    }
    const dpr = width / (canvas.clientWidth || 1)
    const markerBox = maxX < 0 ? null : {
      left: minX / dpr, right: maxX / dpr,
      top: minY / dpr, bottom: maxY / dpr,
    }
    const hits = []
    document.querySelectorAll("button,a").forEach((el) => {
      const cs = getComputedStyle(el)
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.15) return
      if (cs.pointerEvents === "none") return
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height || !markerBox) return
      const iw = Math.max(0, Math.min(r.right, markerBox.right) - Math.max(r.left, markerBox.left))
      const ih = Math.max(0, Math.min(r.bottom, markerBox.bottom) - Math.max(r.top, markerBox.top))
      if (iw > 0 && ih > 0) {
        hits.push({
          label: el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 20),
          left: +r.left.toFixed(1), right: +r.right.toFixed(1),
          top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1),
          intersectionPx: +(iw * ih).toFixed(1),
        })
      }
    })
    const count = document.querySelector('[data-testid="rep-count"]')
    const countStyle = count ? getComputedStyle(count) : null
    const video = document.querySelector("video")
    const videoStyle = video ? getComputedStyle(video) : null
    const videoRect = video?.getBoundingClientRect()
    const intrinsicW = video?.videoWidth || 0
    const intrinsicH = video?.videoHeight || 0
    const contentScale = intrinsicW && intrinsicH
      ? Math.min((videoRect?.width || 0) / intrinsicW, (videoRect?.height || 0) / intrinsicH)
      : 0
    const contentBox = videoRect && intrinsicW && intrinsicH ? {
      left: videoRect.left + (videoRect.width - intrinsicW * contentScale) / 2,
      right: videoRect.right - (videoRect.width - intrinsicW * contentScale) / 2,
      top: videoRect.top + (videoRect.height - intrinsicH * contentScale) / 2,
      bottom: videoRect.bottom - (videoRect.height - intrinsicH * contentScale) / 2,
    } : null
    const controlRect = controls.getBoundingClientRect()
    return {
      restoredOpacity: Number(getComputedStyle(controls).opacity),
      restoredPointerEvents: getComputedStyle(controls).pointerEvents,
      skeletonPixels: skeleton,
      markerBox,
      contentBox,
      videoObjectFit: videoStyle?.objectFit,
      intrinsicVideo: { width: intrinsicW, height: intrinsicH },
      controlsRect: {
        left: +controlRect.left.toFixed(1), right: +controlRect.right.toFixed(1),
        top: +controlRect.top.toFixed(1), bottom: +controlRect.bottom.toFixed(1),
      },
      hits,
      count: count?.textContent?.trim(),
      countColor: countStyle?.color,
      countFontSize: countStyle?.fontSize,
      countFontWeight: countStyle?.fontWeight,
      countShadow: countStyle?.textShadow,
    }
  })

  const readCount = async () => page.evaluate(() =>
    Number(document.querySelector('[data-testid="rep-count"]')?.textContent || -1)
  )
  const before = await readCount()
  await page.getByRole("button", { name: /add a rep/i }).click()
  await page.waitForTimeout(250)
  const afterPlus = await readCount()
  await page.waitForTimeout(1650)
  const afterDetectionWait = await readCount()
  await page.getByRole("button", { name: /remove a rep/i }).click()
  await page.waitForTimeout(250)
  const afterMinus = await readCount()
  await page.waitForTimeout(500)
  const afterMinusWait = await readCount()

  const cameraCalls = await page.evaluate(() => window.__fitStreakCameraCalls || [])
  await page.screenshot({
    path: path.join(SHOTS, "qa-live-restored.png"),
    fullPage: false,
  })
  await context.close()
  return {
    hideAfterMs,
    hidden,
    shownAndOverlap,
    cameraCalls,
    manual: { before, afterPlus, afterDetectionWait, afterMinus, afterMinusWait },
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch()
  const loginTimes = []
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({
      viewport: { width: 414, height: 896 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    loginTimes.push(await login(page))
    await context.close()
  }

  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  await login(page)
  const headers = []
  for (const width of [320, 360, 414]) headers.push(await measureHeader(page, width))

  const vars = await page.evaluate(() => {
    const read = () => {
      const root = getComputedStyle(document.documentElement)
      const names = [
        "--c-surface", "--c-faint", "--c-flame-soft", "--c-flame-text",
        "--c-primary-soft", "--c-primary-text"
      ]
      return Object.fromEntries(names.map((n) => [n, root.getPropertyValue(n).trim()]))
    }
    const light = read()
    document.documentElement.classList.add("dark")
    const dark = read()
    document.documentElement.classList.remove("dark")
    return { light, dark }
  })

  const tokenRatios = {
    inactiveNav: {
      light: contrast(vars.light["--c-faint"], vars.light["--c-surface"]),
      dark: contrast(vars.dark["--c-faint"], vars.dark["--c-surface"]),
    },
    streakPill: {
      light: contrast(vars.light["--c-flame-text"], vars.light["--c-flame-soft"]),
      dark: contrast(vars.dark["--c-flame-text"], vars.dark["--c-flame-soft"]),
    },
    statusBadge: {
      light: contrast(vars.light["--c-primary-text"], vars.light["--c-primary-soft"]),
      dark: contrast(vars.dark["--c-primary-text"], vars.dark["--c-primary-soft"]),
    },
    warningBadge: {
      light: contrast(vars.light["--c-flame-text"], vars.light["--c-flame-soft"]),
      dark: contrast(vars.dark["--c-flame-text"], vars.dark["--c-flame-soft"]),
    },
  }

  await context.close()
  const live = await measureLive(browser)
  await browser.close()

  console.log(JSON.stringify({
    loginTimes,
    headers,
    vars,
    tokenRatios,
    live,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
