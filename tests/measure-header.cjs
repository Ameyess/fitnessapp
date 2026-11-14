/* eslint-disable no-console */
/** Measures the header's parts at narrow widths so the layout can be tuned. */
const { chromium } = require("playwright")

const BASE = process.argv[2] || "http://localhost:3000"
const EMAIL = "fitstreak.e2e@test.local"
const PASSWORD = "FitStreakE2E!2026"

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => /Today's goals/i.test(document.body.innerText), {
    timeout: 20000,
  })

  for (const width of [320, 360, 390, 414, 430, 480, 640]) {
    await page.setViewportSize({ width, height: 800 })
    await page.waitForTimeout(400)
    const info = await page.evaluate(() => {
      const header = document.querySelector("header")
      const inner = header?.firstElementChild
      const brand = header?.querySelector('a[aria-label="FitStreak home"]')
      const streak = header?.querySelector('a[aria-label^="Current streak"]')
      const nav = header?.querySelector('nav[aria-label="Main"]')
      const w = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null)
      return {
        inner: w(inner),
        brand: w(brand),
        streak: w(streak),
        nav: w(nav),
        vw: window.innerWidth,
        overflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    console.log(
      `${width}px -> vw=${info.vw} brand=${info.brand} streak=${info.streak} nav=${info.nav} sum=${
        (info.brand || 0) + (info.streak || 0) + (info.nav || 0)
      } overflow=${info.overflow}`
    )
  }
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(2)
})
