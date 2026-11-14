/* eslint-disable no-console */
const { chromium } = require("playwright")
const BASE = process.argv[2] || "http://[::1]:3000"
const EMAIL = "fitstreak.e2e@test.local"
const PASS = "FitStreakE2E!2026"

async function main() {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] })
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  })
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", e => errs.push("PAGEERR: " + String(e)))
  page.on("console", m => { if (m.type() === "error") errs.push("CONSOLE: " + m.text()) })

  // ---------- login timing ----------
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  const t0 = Date.now()
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => /Today's goals|Start your streak/i.test(document.body.innerText), { timeout: 30000 })
  const t1 = Date.now()
  console.log("LOGIN_TO_HOME_MS", t1 - t0)

  // measure nav/interactive element sizes + contrast
  const audit = await page.evaluate(() => {
    function lum(rgb){const c=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]}
    function parse(s){const m=s.match(/[\d.]+/g);return m?m.slice(0,3).map(Number):null}
    function ratio(a,b){const l1=lum(a),l2=lum(b);const hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+0.05)/(lo+0.05)}
    const out={small:[],navCount:0,headerItems:[],overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth, scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth}
    document.querySelectorAll('a,button').forEach(el=>{
      const r=el.getBoundingClientRect()
      if(r.width===0||r.height===0)return
      const cs=getComputedStyle(el)
      const bg=parse(cs.backgroundColor)
      // find effective bg by walking up
      let e=el,eff=null
      while(e){const c=parse(getComputedStyle(e).backgroundColor);const a=getComputedStyle(e).backgroundColor;if(c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(a)){eff=c;break}e=e.parentElement}
      const fg=parse(cs.color)
      const label=(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,24)
      if(fg&&eff) out.small.push({label,h:Math.round(r.height),w:Math.round(r.width),ratio:+ratio(fg,eff).toFixed(2)})
    })
    const hdr=document.querySelector('header')
    if(hdr) out.headerItems=[...hdr.querySelectorAll('a,button')].map(el=>({label:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,20),h:Math.round(el.getBoundingClientRect().height),w:Math.round(el.getBoundingClientRect().width)}))
    return out
  })
  console.log("AUDIT", JSON.stringify(audit, null, 1))
  await page.screenshot({ path: "test-results/audit-home.png", fullPage: true })

  // ---------- dark theme audit ----------
  await page.getByRole("button", { name: /switch to (dark|light) mode/i }).click()
  await page.waitForTimeout(600)
  const darkAudit = await page.evaluate(() => {
    function lum(rgb){const c=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]}
    function parse(s){const m=s.match(/[\d.]+/g);return m?m.slice(0,3).map(Number):null}
    function ratio(a,b){const l1=lum(a),l2=lum(b);const hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+0.05)/(lo+0.05)}
    const out={items:[],html:document.documentElement.className}
    document.querySelectorAll('a,button,span,p,h1,h2').forEach(el=>{
      const r=el.getBoundingClientRect(); if(r.width===0||r.height===0)return
      if(!el.textContent||!el.textContent.trim())return
      const cs=getComputedStyle(el)
      let e=el,eff=null
      while(e){const a=getComputedStyle(e).backgroundColor;const c=parse(a);if(c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(a)){eff=c;break}e=e.parentElement}
      const fg=parse(cs.color)
      if(fg&&eff) out.items.push({t:el.textContent.trim().slice(0,22),ratio:+ratio(fg,eff).toFixed(2),size:cs.fontSize,weight:cs.fontWeight})
    })
    return out
  })
  console.log("DARK", JSON.stringify(darkAudit.items.filter(i=>i.ratio<4.5).slice(0,25)))
  console.log("DARK_HTML", darkAudit.html)
  await page.screenshot({ path: "test-results/audit-home-dark.png", fullPage: true })

  console.log("ERRORS", JSON.stringify(errs.slice(0, 15), null, 1))
  await browser.close()
}
main().catch(e => { console.error("HARNESS", e); process.exit(2) })
