import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const origin = process.env.RKMED_TEST_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const android = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'
async function visit({ userAgent = android, installed = false, role = 'member', route = '/app', width = 390 } = {}) {
  const context = await browser.newContext({ userAgent, viewport: { width, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' })
  await context.addInitScript(({ installed, role }) => {
    localStorage.setItem('rkmed-prototype-session-v1', JSON.stringify({ role, memberId: 'member-ana' }))
    if (installed) Object.defineProperty(navigator, 'standalone', { value: true })
  }, { installed, role })
  const page = await context.newPage()
  await page.goto(`${origin}${route}`)
  await page.locator(role === 'member' && route.startsWith('/app') ? '.member-app' : '#main-content').waitFor()
  return { context, page, modal: page.getByRole('dialog', { name: 'Seu cartão, na tela inicial.' }) }
}
try {
  const ios = await visit({ userAgent: iphone, width: 360 })
  await ios.modal.waitFor()
  assert.equal(await ios.modal.getByText('Adicionar à Tela de Início', { exact: true }).count(), 1)
  assert.equal(await ios.modal.getByRole('button', { name: 'Instalar app RKMED' }).count(), 0)
  const bounds = await ios.modal.boundingBox()
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 360)
  await ios.page.screenshot({ path: '/tmp/rkmed-pwa-install-iphone.png' })
  await ios.page.keyboard.press('Escape')
  await ios.modal.waitFor({ state: 'hidden' })
  await ios.page.reload()
  await ios.page.locator('.member-app').waitFor()
  assert.equal(await ios.modal.count(), 0, 'Dismissal persists across reloads')
  await ios.context.close()

  const native = await visit()
  await native.modal.waitFor()
  await native.page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = async () => { window.installCalls = (window.installCalls || 0) + 1 }
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(event)
  })
  await native.modal.getByRole('button', { name: 'Instalar app RKMED' }).click()
  await native.modal.waitFor({ state: 'hidden' })
  assert.equal(await native.page.evaluate(() => window.installCalls), 1)
  await native.context.close()

  const failed = await visit()
  await failed.modal.waitFor()
  await failed.page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = async () => { throw new Error('Browser refused') }
    event.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(event)
  })
  await failed.modal.getByRole('button', { name: 'Instalar app RKMED' }).click()
  await failed.modal.getByRole('alert').waitFor()
  assert.equal(await failed.modal.getByRole('button', { name: 'Instalar app RKMED' }).count(), 0)
  await failed.modal.getByRole('button', { name: 'Agora não' }).click()
  await failed.context.close()

  const alreadyInstalled = await visit({ installed: true })
  assert.equal(await alreadyInstalled.modal.count(), 0)
  await alreadyInstalled.context.close()

  const completed = await visit()
  await completed.modal.waitFor()
  await completed.page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await completed.modal.waitFor({ state: 'hidden' })
  await completed.context.close()

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await desktop.addInitScript(() => localStorage.setItem('rkmed-prototype-session-v1', JSON.stringify({ role: 'member', memberId: 'member-ana' })))
  const page = await desktop.newPage()
  await page.goto(`${origin}/app`)
  await page.locator('.member-app').waitFor()
  assert.equal(await page.locator('.member-install-dialog').count(), 0)
  await desktop.close()

  const publicArea = await visit({ route: '/entrar' })
  await publicArea.page.locator('.auth-layout').waitFor()
  assert.equal(await publicArea.modal.count(), 0)
  // Capture the browser event before entering the lazy member area.
  await publicArea.page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = async () => {}
    event.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(event)
    history.pushState({}, '', '/app')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await publicArea.modal.getByRole('button', { name: 'Instalar app RKMED' }).waitFor()
  await publicArea.context.close()
  const staff = await visit({ role: 'admin', route: '/admin' })
  await staff.page.locator('.workspace').waitFor()
  assert.equal(await staff.modal.count(), 0)
  await staff.context.close()
  console.log('PASS: mobile member prompt, iPhone instructions, Android install/error, dismissal, installed/desktop/public suppression.')
} finally { await browser.close() }
