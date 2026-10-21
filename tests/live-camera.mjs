import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
await context.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    const image = new Image()
    image.src = '/demo-ana.webp'
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const draw = () => canvas.getContext('2d')?.drawImage(image, 0, 0)
    draw()
    const timer = window.setInterval(draw, 100)
    const stream = canvas.captureStream(15)
    stream.getTracks().forEach(track => track.addEventListener('ended', () => window.clearInterval(timer)))
    return stream
  }
})
const page = await context.newPage()
try {
  await page.goto(`${process.env.RKMED_TEST_URL ?? 'http://127.0.0.1:5173'}/cadastro`)
  await page.getByPlaceholder('Como está no seu documento').fill('Beatriz Martins')
  await page.getByPlaceholder('000.000.000-00').fill('52998224725')
  await page.locator('input[type=date]').fill('1990-01-01')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByPlaceholder('(81) 99999-9999').fill('81999990003')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Código enviado por WhatsApp').fill('123456')
  await page.getByRole('button', { name: 'Confirmar WhatsApp' }).click()
  await page.getByPlaceholder('seu@email.com').fill('beatriz@exemplo.com')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Código enviado por e-mail').fill('123456')
  await page.getByRole('button', { name: 'Confirmar e-mail' }).click()
  await page.getByRole('button', { name: 'Tirar foto' }).waitFor({ state: 'visible' })
  await page.getByText('Um rosto detectado. Você pode tirar a foto.').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Tirar foto' }).click()
  await page.getByText('Um rosto detectado. A foto pode seguir para o cadastro.').waitFor({ timeout: 30000 })
  assert.ok(await page.getByAltText('Prévia da sua foto').isVisible())
  console.log('PASS: live camera detects one face, captures, and validates the still photo.')
} finally {
  await browser.close()
}
