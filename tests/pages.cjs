/* eslint-disable no-console */
/**
 * Visits every route and asserts it renders without errors and that the
 * shared app chrome (top nav + streak) is present.
 */
const path = require("path")
const fs = require("fs")
const { chromium } = require("playwright")

const BASE = process.argv[2] || "http://localhost:3000"
const ROOT = path.join(__dirname, "..")
const SHOTS = path.join(ROOT, "test-results")
const EMAIL = "fitstreak.e2e@test.local"
const PASSWORD = "FitStreakE2E!2026"

const ROUTES = [
  { path: "/", name: "home", expect: /Today's goals|Start your streak/i },
  { path: "/history", name: "history", expect: /Stats|Reps per day|No data/i },
  { path: "/friends", name: "friends", expect: /Friends|Add a friend|No friends/i },
  { path: "/leaderboard", name: "leaderboard", expect: /leaderboard|No friends/i },
  { path: "/settings", name: "settings", expect: /Appearance|Daily reminder|You/i },
  { path: "/onboarding", name: "onboarding", expect: /goal|Daily goal|Almost there/i },
  { path: "/exercises/pushups", name: "exercise-setup", expect: /Start workout|phone/i },
]

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`)
}

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()

  // sign in
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => /Today's goals/i.test(document.body.innerText), {
    timeout: 20000,
  })

  for (const route of ROUTES) {
    const errors = []
    const onErr = (e) => errors.push(String(e))
    const onConsole = (m) => {
      if (m.type() === "error" && !/favicon|Failed to load resource/i.test(m.text()))
        errors.push(m.text())
    }
    page.on("pageerror", onErr)
    page.on("console", onConsole)

    await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1200)

    const info = await page.evaluate(() => {
      const text = document.body.innerText
      const header = document.querySelector("header")
      const streak = document.querySelector('a[aria-label^="Current streak"]')
      const nav = document.querySelector('nav[aria-label="Main"]')
      // touch targets
      let small = 0
      document.querySelectorAll("button, a").forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return
        if (r.height < 44 || r.width < 44) small++
      })
      // horizontal overflow
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth
      return {
        text: text.slice(0, 260),
        hasHeader: !!header,
        hasStreak: !!streak,
        hasNav: !!nav,
        smallTargets: small,
        overflow,
      }
    })

    record(
      `${route.name} renders expected content`,
      route.expect.test(info.text),
      info.text.replace(/\n/g, " ").slice(0, 90)
    )
    record(`${route.name} has app chrome (nav + streak)`, info.hasHeader && info.hasStreak && info.hasNav)
    record(`${route.name} has no horizontal overflow`, info.overflow <= 1, `overflow=${info.overflow}px`)
    record(`${route.name} touch targets >= 44px`, info.smallTargets === 0, `small=${info.smallTargets}`)
    record(`${route.name} no console/page errors`, errors.length === 0, errors.join(" | ").slice(0, 200))

    await page.screenshot({
      path: path.join(SHOTS, `page-${route.name}.png`),
      fullPage: true,
    })
    page.off("pageerror", onErr)
    page.off("console", onConsole)
  }

  /* ---------- narrow viewports (header must never overflow) ---------- */
  for (const width of [360, 320]) {
    await page.setViewportSize({ width, height: 740 })
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(900)
    const info = await page.evaluate(() => {
      const header = document.querySelector("header")
      const last = header ? header.querySelector("nav[aria-label='Main'] button:last-of-type") : null
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerRight: header ? header.getBoundingClientRect().right : null,
        viewport: window.innerWidth,
        lastBtnRight: last ? last.getBoundingClientRect().right : null,
      }
    })
    record(
      `header fits at ${width}px`,
      info.overflow <= 1 && (info.lastBtnRight ?? 0) <= info.viewport,
      `overflow=${info.overflow}px lastBtnRight=${info.lastBtnRight} vw=${info.viewport}`
    )
    await page.screenshot({ path: path.join(SHOTS, `narrow-${width}.png`) })
  }
  await page.setViewportSize({ width: 414, height: 896 })

  await browser.close()
  const passed = results.filter((r) => r.pass).length
  console.log(`\n=== ${passed}/${results.length} page checks passed ===`)
  results.filter((r) => !r.pass).forEach((r) => console.log(`  FAILED: ${r.name} :: ${r.detail || ""}`))
  process.exit(passed === results.length ? 0 : 1)
})().catch((e) => {
  console.error("HARNESS ERROR:", e)
  process.exit(2)
})
