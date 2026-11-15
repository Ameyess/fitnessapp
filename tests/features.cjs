/* eslint-disable no-console */
/**
 * FitStreak feature checks:
 *   1. the vertical (portrait) camera view
 *   2. the custom plan builder
 *
 * Run: node tests/features.cjs [baseUrl]
 */
const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")

const BASE = process.argv[2] || "http://localhost:3000"
const ROOT = path.join(__dirname, "..")
const SHOTS = path.join(ROOT, "test-results")
const EMAIL = "fitstreak.e2e@test.local"
const PASSWORD = "FitStreakE2E!2026"

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`)
}

/* ------------------------------------------------------------------------ */
/* Mock cameras - each returns a FRESH live stream, like a real camera.      */
/* ------------------------------------------------------------------------ */
const MOCK_CAMERA = (W, H) => `
(() => {
  const W = ${W}, H = ${H};
  window.__gumCalls = window.__gumCalls || [];
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    window.__gumCalls.push(constraints);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.style.cssText =
      'position:fixed;left:-' + (W + 40) + 'px;top:0;width:' + W + 'px;height:' + H + 'px;pointer-events:none';
    (document.body || document.documentElement).appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(0, 0, W, H);

    const img = new Image();
    img.src = '/pose-test.jpg';
    const draw = () => {
      try {
        if (!img.naturalWidth) return;
        // Letterbox the person photo so it stays recognisable at any aspect.
        const s = Math.min(W / img.naturalWidth, H / img.naturalHeight);
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } catch (e) {}
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

const waitForVideo = async (page) => {
  await page.waitForSelector("video", { timeout: 20000 })
  await page.waitForFunction(
    () => {
      const v = document.querySelector("video")
      return v && v.readyState >= 2 && v.videoWidth > 0
    },
    { timeout: 20000 }
  )
}

const camInfo = (page) =>
  page.evaluate(() => {
    const v = document.querySelector("video")
    if (!v) return { exists: false }
    const r = v.getBoundingClientRect()
    return {
      exists: true,
      rotation: v.getAttribute("data-rotation"),
      objectFit: getComputedStyle(v).objectFit,
      transform: getComputedStyle(v).transform,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
      rect: { width: r.width, height: r.height, top: r.top, left: r.left },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      gumCalls: window.__gumCalls || [],
    }
  })

// Wait until the tracker has actually rendered a pose. The canvas is always
// mounted, so a green marker is the observable proof that detection has run.
const waitForPoseDetection = async (page) => {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("canvas[data-testid='pose-canvas']")
      if (!canvas || canvas.width === 0 || canvas.height === 0) return false
      const ctx = canvas.getContext("2d")
      if (!ctx) return false
      try {
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        for (let i = 0; i < pixels.length; i += 4) {
          if (
            pixels[i + 3] > 40 &&
            pixels[i + 1] > 140 &&
            pixels[i] < 160 &&
            pixels[i + 2] < 110 &&
            pixels[i + 1] > pixels[i] + 40
          ) {
            return true
          }
        }
      } catch {}
      return false
    },
    { timeout: 30000 }
  )
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({
    args: ["--autoplay-policy=no-user-gesture-required"],
  })

  /* =================== 1. VERTICAL CAMERA VIEW =================== */
  {
    const context = await browser.newContext({
      viewport: { width: 414, height: 896 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    const pageErrors = []
    page.on("pageerror", (e) => pageErrors.push(String(e)))

    // A phone-shaped portrait stream (720x1280) on a 414x896 screen.
    await page.addInitScript(MOCK_CAMERA(720, 1280))
    await page.goto(`${BASE}/exercises/pushups/live`, {
      waitUntil: "domcontentloaded",
    })
    await waitForVideo(page)
    await page.waitForTimeout(900)

    let info = await camInfo(page)
    record(
      "portrait stream on a portrait screen keeps rotation 0",
      info.rotation === "0",
      `rotation=${info.rotation}`
    )
    record(
      "the camera preview FILLS the portrait screen (no letterbox bars)",
      info.objectFit === "cover",
      `object-fit=${info.objectFit}`
    )
    record(
      "the video element covers the whole portrait viewport",
      info.rect.width >= info.viewport.width * 0.95 &&
        info.rect.height >= info.viewport.height * 0.95,
      `rect=${Math.round(info.rect.width)}x${Math.round(info.rect.height)} viewport=${info.viewport.width}x${info.viewport.height}`
    )

    // The stream must be requested at the SCREEN's aspect, otherwise the
    // phone hands back a horizontal frame and the user jumps out of view.
    const ideal = info.gumCalls.length
      ? (info.gumCalls[0].video || {}).aspectRatio
      : null
    const screenAspect = 414 / 896
    const idealValue =
      ideal && typeof ideal === "object" ? ideal.ideal : ideal
    record(
      "the camera is asked for a screen-shaped (portrait) stream",
      !!idealValue && Math.abs(idealValue - screenAspect) / screenAspect < 0.2,
      `aspectRatio.ideal=${idealValue} screen=${screenAspect.toFixed(3)}`
    )

    /* ---- manual rotation ---- */
    const rotate = page.getByRole("button", { name: /rotate camera/i })
    record(
      "a rotate control is available",
      (await rotate.count()) > 0,
      `count=${await rotate.count()}`
    )
    if ((await rotate.count()) > 0) {
      // The pose tracker only runs once the workout starts, so start it
      // before checking that the skeleton still renders after a rotation.
      const startBtn = page.getByRole("button", { name: /start counting/i })
      if (await startBtn.count()) {
        await startBtn.first().click()
        await page.waitForTimeout(2500)
      }

      const seen = []
      for (let i = 0; i < 4; i++) {
        await rotate.first().click({ force: true })
        await page.waitForTimeout(250)
        const cur = await camInfo(page)
        seen.push(cur.rotation)
      }
      record(
        "the rotate button cycles 90 -> 180 -> 270 -> 0",
        JSON.stringify(seen) === JSON.stringify(["90", "180", "270", "0"]),
        JSON.stringify(seen)
      )

      // The skeleton must still be drawn after a rotation.
      const markers = await page.evaluate(() => {
        const c = document.querySelector("canvas")
        if (!c) return { green: 0 }
        const ctx = c.getContext("2d")
        const d = ctx.getImageData(0, 0, c.width, c.height).data
        let green = 0
        for (let i = 0; i < d.length; i += 4) {
          if (
            d[i + 3] > 40 &&
            d[i + 1] > 140 &&
            d[i] < 160 &&
            d[i + 2] < 110 &&
            d[i + 1] > d[i] + 40
          )
            green++
        }
        return { green }
      })
      record(
        "the skeleton overlay still renders after rotating",
        markers.green > 100,
        `greenPx=${markers.green}`
      )
      await page.screenshot({
        path: path.join(SHOTS, "05-vertical-camera.png"),
        fullPage: true,
      })
    }

    await page.close()
    await context.close()
  }

  /* ---- a LANDSCAPE stream on a portrait screen must become vertical ---- */
  {
    const context = await browser.newContext({
      viewport: { width: 414, height: 896 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await page.addInitScript(MOCK_CAMERA(1280, 720))
    await page.goto(`${BASE}/exercises/pushups/live`, {
      waitUntil: "domcontentloaded",
    })
    await waitForVideo(page)

    // Start the tracker before checking the final orientation. A transient
    // quarter turn that later falls back to 0 must not pass this check.
    const startBtn = page.getByRole("button", { name: /start counting/i })
    await startBtn.waitFor({ state: "visible", timeout: 20000 })
    await startBtn.first().click()
    await waitForPoseDetection(page)
    await page.waitForTimeout(2500)

    const info = await camInfo(page)
    record(
      "a horizontal stream stays rotated after pose detection starts",
      info.rotation === "90" || info.rotation === "270",
      `rotation=${info.rotation} stream=${info.videoWidth}x${info.videoHeight}`
    )
    record(
      "the rotated preview fills the portrait screen after pose detection",
      info.objectFit === "cover",
      `object-fit=${info.objectFit}`
    )
    await page.close()
    await context.close()
  }

  /* =================== 2. CUSTOM PLAN BUILDER =================== */
  {
    const context = await browser.newContext({
      viewport: { width: 414, height: 896 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    const pageErrors = []
    const consoleErrors = []
    page.on("pageerror", (e) => pageErrors.push(String(e)))
    page.on("console", (m) => {
      if (m.type() === "error" && !/favicon|Failed to load resource/i.test(m.text()))
        consoleErrors.push(m.text())
    })
    page.on("dialog", (d) => d.accept())

    // sign in
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('input[type="email"]', { timeout: 20000 })
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => /Today's goals/i.test(document.body.innerText), {
      timeout: 20000,
    })

    /* ---- the plan page exists and is linked from the header ---- */
    await page.goto(`${BASE}/plan`, { waitUntil: "domcontentloaded" })
    const planOk = await page
      .waitForSelector('[data-testid="plan-page"]', { timeout: 15000 })
      .then(() => true)
      .catch(() => false)
    record("the /plan page renders", planOk)
    if (!planOk) {
      await browser.close()
      process.exit(1)
    }

    const navPlan = await page
      .getByRole("link", { name: "Plan" })
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false)
    record("the header links to the plan", navPlan, `found=${navPlan}`)

    /* ---- clean up leftovers from a previous run ---- */
    const deleteCustom = async () => {
      for (let pass = 0; pass < 6; pass++) {
        const items = await page.$$('[data-testid^="custom-item-"]')
        if (!items.length) return
        const tid = await items[0].getAttribute("data-testid")
        const id = tid.replace("custom-item-", "")
        const del = page.locator(`[data-testid="custom-delete-${id}"]`)
        if (!(await del.count())) return
        await del.first().click({ force: true })
        await page.waitForTimeout(300)
        const confirm = page.locator('[data-testid="custom-delete-confirm"]')
        if (await confirm.count()) {
          await confirm.first().click({ force: true })
        } else {
          const fallback = page.getByRole("button", { name: "Delete", exact: true })
          if (await fallback.count()) await fallback.first().click({ force: true })
        }
        await page.waitForTimeout(700)
      }
    }
    await deleteCustom()
    record(
      "the plan starts from a clean slate",
      (await page.locator('[data-testid^="custom-item-"]').count()) === 0,
      `items=${await page.locator('[data-testid^="custom-item-"]').count()}`
    )

    /* ---- create a custom exercise ---- */
    await page.click('[data-testid="custom-add-open"]')
    await page.fill('[data-testid="custom-name-input"]', "Wall Sit")
    const iconBtn = page.locator('[data-testid^="custom-icon-"]').first()
    if (await iconBtn.count()) await iconBtn.click()
    await page.click('[data-testid="custom-type-rep"]')
    await page.fill('[data-testid="custom-target-input"]', "30")
    await page.click('[data-testid="custom-save"]')
    await page.waitForTimeout(700)

    const item = page.locator('[data-testid^="custom-item-"]').first()
    const itemCount = await page.locator('[data-testid^="custom-item-"]').count()
    record("a custom exercise can be created", itemCount === 1, `items=${itemCount}`)

    let customId = ""
    if (itemCount === 1) {
      const tid = await item.getAttribute("data-testid")
      customId = tid.replace("custom-item-", "")
      const text = await item.innerText()
      record(
        "the custom exercise shows its name and target",
        /wall sit/i.test(text) && /30/.test(text),
        text.replace(/\n/g, " | ").slice(0, 80)
      )
    }

    /* ---- it persists to Firestore ---- */
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="plan-page"]', { timeout: 15000 })
    await page.waitForTimeout(900)
    const persisted = await page.locator('[data-testid^="custom-item-"]').count()
    record(
      "the custom exercise persists across a reload",
      persisted === 1,
      `items=${persisted}`
    )

    /* ---- it shows up on the home screen ---- */
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => /Today's goals/i.test(document.body.innerText), {
      timeout: 20000,
    })
    await page.waitForTimeout(700)
    const homeHasCustom = /Wall Sit/i.test(await page.innerText("body"))
    record(
      "the custom exercise appears in Today's goals",
      homeHasCustom,
      homeHasCustom ? "found" : "missing"
    )
    await page.screenshot({ path: path.join(SHOTS, "06-home-custom.png"), fullPage: true })

    /* ---- manual logging of a custom exercise ---- */
    if (customId) {
      await page.goto(`${BASE}/exercises/custom/${customId}`, {
        waitUntil: "domcontentloaded",
      })
      // The container testid is also used by the loading and not-found
      // states, so wait for the actual form instead.
      const manualInput = page.locator('[data-testid="manual-log-input"]')
      const entryOk = await manualInput
        .waitFor({ timeout: 15000 })
        .then(() => true)
        .catch(() => false)
      record("the custom exercise page renders", entryOk)
      if (entryOk) {
        const manual = manualInput
        {
          await manual.fill("30")
          await page.click('[data-testid="manual-log-save"]')
          await page.waitForTimeout(1500)
          const logged = /30|logged|saved|done|complete/i.test(await page.innerText("body"))
          record("a custom exercise can be logged manually", logged)

          await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
          await page.waitForFunction(
            () => /Today's goals/i.test(document.body.innerText),
            { timeout: 20000 }
          )
          await page.waitForTimeout(800)
          const homeText = await page.innerText("body")
          const done = /30\s*\/\s*30/.test(homeText)
          record(
            "the logged custom exercise shows as completed on Home",
            done,
            done ? "30/30" : homeText.slice(0, 120).replace(/\n/g, " | ")
          )
        }
      }
    }

    /* ---- built-in targets are editable and persist ---- */
    await page.goto(`${BASE}/plan`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('[data-testid="plan-page"]', { timeout: 15000 })
    await page.waitForTimeout(700)
    const builtin = page.locator('[data-testid="builtin-target-squats"]')
    if (await builtin.count()) {
      await builtin.fill("22")
      await builtin.blur()
      await page.waitForTimeout(900)
      await page.reload({ waitUntil: "domcontentloaded" })
      await page.waitForSelector('[data-testid="plan-page"]', { timeout: 15000 })
      await page.waitForTimeout(900)
      const val = await page
        .locator('[data-testid="builtin-target-squats"]')
        .inputValue()
        .catch(() => "")
      record(
        "a built-in target can be edited and persists",
        val === "22",
        `value=${val}`
      )
      // put it back
      await page.locator('[data-testid="builtin-target-squats"]').fill("15")
      await page.locator('[data-testid="builtin-target-squats"]').blur()
      await page.waitForTimeout(700)
    } else {
      record("a built-in target can be edited and persists", false, "no builtin-target-squats")
    }

    /* ---- the header still fits at 320px with the extra tab ---- */
    await page.setViewportSize({ width: 320, height: 800 })
    await page.waitForTimeout(500)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    record(
      "the header still fits at 320px with the Plan tab",
      overflow <= 1,
      `overflow=${overflow}px`
    )
    await page.screenshot({ path: path.join(SHOTS, "07-plan-320.png"), fullPage: true })

    /* ---- clean up ---- */
    await deleteCustom()

    const realConsoleErrors = consoleErrors.filter(
      (e) => !/favicon|404|Failed to load resource/i.test(e)
    )
    record("no page errors on the plan flow", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300))
    record(
      "no console errors on the plan flow",
      realConsoleErrors.length === 0,
      realConsoleErrors.join(" | ").slice(0, 300)
    )

    await context.close()
  }

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
