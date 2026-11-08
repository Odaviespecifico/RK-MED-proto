import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: '/usr/bin/brave-browser', headless: true,
  args: ['--no-sandbox', '--disable-gpu', ...(process.env.RKMED_NO_WEBGL ? ['--disable-webgl'] : [])],
})
try {
  const page = await browser.newPage()
  if (process.env.RKMED_NO_WEBGL) await page.addInitScript(() => {
    for (const prototype of [HTMLCanvasElement.prototype, OffscreenCanvas.prototype]) {
      const original = prototype.getContext
      prototype.getContext = function (type, ...args) {
        if (type.includes('webgl')) return null
        return original.call(this, type, ...args)
      }
    }
  })
  await page.goto(process.env.RKMED_TEST_URL || 'http://127.0.0.1:5173')
  const result = await page.evaluate(async () => {
    try {
      const { detectFace, createLiveFaceDetector, countUsableFaces } = await import('/src/lib/face.ts')
      const image = await createImageBitmap(await (await fetch('/demo-ana.webp')).blob())
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      canvas.getContext('2d').drawImage(image, 0, 0)
      image.close()
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'))
      const photo = await detectFace(new File([blob], 'portrait.jpg', { type: 'image/jpeg' }))
      const blank = document.createElement('canvas')
      blank.width = blank.height = 600
      blank.getContext('2d').fillRect(0, 0, 600, 600)
      const empty = await new Promise(resolve => blank.toBlob(resolve, 'image/jpeg'))
      const negative = await detectFace(new File([empty], 'blank.jpg', { type: 'image/jpeg' }))
      const detector = await createLiveFaceDetector()
      try {
        const live = countUsableFaces((await detector.detectForVideo(canvas, performance.now())).detections, canvas.width, canvas.height, true)
        return { photo: photo.count, live, negative: negative.count }
      } finally { detector.close() }
    } catch (error) { return { error: error.message, stack: error.stack } }
  })
  assert.equal(result.error, undefined, result.stack)
  assert.equal(result.photo, 1, 'uploaded portrait must detect one face')
  assert.equal(result.live, 1, 'live frame must detect one face')
  assert.equal(result.negative, 0, 'an image without a face must remain rejected')
  console.log('PASS: uploaded photo and live frame detect one face.')
} finally { await browser.close() }
