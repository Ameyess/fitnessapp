/* eslint-disable no-console */
const { chromium } = require("playwright")
const BASE = process.argv[2] || "http://[::1]:3000"
const EMAIL = "fitstreak.e2e@test.local"
const PASS = "FitStreakE2E!2026"

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  })
  const page = await ctx.newPage()
  await page.goto(BASE + "/sign-in", { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]')
  await page.waitForTimeout(700)
  await page.screenshot({ path: "test-results/audit-signin.png" })
  const hdr = await page.evaluate(() => {
    const h = document.querySelector("header")
    if (!h) return null
    return [...h.querySelectorAll("a,button")].map(el => {
      const r = el.getBoundingClientRect()
      return { l: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 18), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    })
  })
  console.log("SIGNIN_HEADER", JSON.stringify(hdr))

  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => /Today's goals/i.test(document.body.innerText))

  for (const route of ["/settings", "/exercises/pushups", "/friends", "/history"]) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1500)
    const name = route.replace(/\//g, "_") || "_home"
    await page.screenshot({ path: `test-results/audit${name}.png`, fullPage: true })
    const info = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      headerItems: document.querySelector("header") ? document.querySelector("header").querySelectorAll("a,button").length : 0,
      rows: document.querySelectorAll("main a, main button").length,
      text: document.body.innerText.slice(0, 120).replace(/\n/g, " | "),
    }))
    console.log("ROUTE", route, JSON.stringify(info))
  }
  await browser.close()
}
main().catch(e => { console.error(e); process.exit(2) })
