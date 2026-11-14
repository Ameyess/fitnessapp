const { chromium } = require("playwright")

const MOCK = `
(() => {
  const W = 720, H = 960;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b2b2b'; ctx.fillRect(0,0,W,H);
  const stream = canvas.captureStream(30);
  window.__CANVAS = canvas;
  const attach = () => {
    if (canvas.isConnected) return;
    canvas.style.cssText = 'position:fixed;left:-800px;top:0;width:' + W + 'px;height:' + H + 'px;pointer-events:none';
    (document.body || document.documentElement).appendChild(canvas);
  };
  navigator.mediaDevices.getUserMedia = async () => { attach(); return stream; };
  const img = new Image();
  img.src = '/pose-test.jpg';
  const draw = () => { try { if (img.naturalWidth) ctx.drawImage(img, 0, 0, W, H); } catch (e) {} };
  img.onload = draw; img.onerror = draw; draw();
  setInterval(draw, 33);
})();
`

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  page.on("console", (m) => console.log("  [page]", m.text()))
  await page.addInitScript(MOCK)
  await page.goto("http://localhost:3000/exercises/pushups/live", {
    waitUntil: "domcontentloaded",
  })
  await page.waitForTimeout(3000)
  const t1 = await page.evaluate(() => {
    const v = document.querySelector("video")
    return { ct: v ? v.currentTime : null, vw: v ? v.videoWidth : null }
  })
  await page.waitForTimeout(2000)
  const info = await page.evaluate(() => {
    const v = document.querySelector("video")
    const c = window.__CANVAS
    const track = v && v.srcObject ? v.srcObject.getVideoTracks()[0] : null
    return {
      canvasConnected: c ? c.isConnected : null,
      canvasRect: c ? c.getBoundingClientRect().width + "x" + c.getBoundingClientRect().height : null,
      canvasBitmap: c ? c.width + "x" + c.height : null,
      trackState: track ? track.readyState : null,
      trackMuted: track ? track.muted : null,
      videoW: v ? v.videoWidth : null,
      videoH: v ? v.videoHeight : null,
      currentTime: v ? v.currentTime : null,
      paused: v ? v.paused : null,
    }
  })
  console.log("t1:", JSON.stringify(t1))
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
})()
