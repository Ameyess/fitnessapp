/* eslint-disable no-console */
/** Independent Round 3 login-latency benchmark. */
const { chromium } = require("playwright")

const BASE = process.argv[2] || "http://localhost:3000"
const EMAIL = "fitstreak.e2e@test.local"
const PASSWORD = "FitStreakE2E!2026"

async function main() {
  const browser = await chromium.launch()
  const samples = []
  for (let i = 0; i < 6; i++) {
    const context = await browser.newContext({ viewport: { width: 414, height: 896 } })
    const page = await context.newPage()
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('input[type="email"]', { timeout: 20000 })
    const started = Date.now()
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => /Today's goals|Start your streak/i.test(document.body.innerText), { timeout: 20000 })
    const elapsed = Date.now() - started
    samples.push(elapsed)
    console.log(`sample ${i + 1}: ${elapsed}ms`)
    await context.close()
  }
  await browser.close()
  const sorted = [...samples].sort((a, b) => a - b)
  const median = (sorted[2] + sorted[3]) / 2
  console.log(JSON.stringify({ samples, min: sorted[0], median, max: sorted.at(-1), under1500: samples.filter((n) => n < 1500).length, total: samples.length }))
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
