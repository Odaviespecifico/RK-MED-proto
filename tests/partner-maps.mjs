import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const demo = 'http://127.0.0.1:5173'
const connected = 'http://127.0.0.1:5174'
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' })
  // Provider rendering is isolated here; its real iframe was verified separately.
  await context.route('https://www.google.com/maps?*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><body><button aria-label="Ampliar" onclick="this.textContent=\'Zoom ampliado\'">+</button></body></html>' }))
  const page = await context.newPage()
  const failures = []
  page.on('pageerror', error => failures.push(error.message))
  async function openMap(entry) {
    const summary = entry.locator('summary')
    assert.equal(await entry.locator('iframe').count(), 0, 'Per-partner iframe loads only after opening')
    await summary.focus(); await summary.press('Enter')
    await entry.locator('iframe').waitFor()
    const src = new URL(await entry.locator('iframe').getAttribute('src'))
    assert.equal(src.searchParams.get('output'), 'embed')
    assert.equal(src.searchParams.get('key'), null)
    assert.ok(src.searchParams.get('q').includes('Brasil'))
    await entry.frameLocator('iframe').getByRole('button', { name: 'Ampliar' }).click()
    await entry.frameLocator('iframe').getByText('Zoom ampliado', { exact: true }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow at 360px')
    await summary.click()
    await page.waitForFunction(() => [...document.querySelectorAll('details.partner-location:not([open])')].every(d => !d.querySelector('iframe')))
  }
  async function login(origin, email, password) {
    await page.goto(`${origin}/acesso-admin`)
    await page.getByLabel('E-mail', { exact: true }).fill(email)
    await page.getByLabel('Senha', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.waitForURL(/\/(admin|app|parceiro)$/)
  }
  await page.goto(demo)
  await openMap(page.locator('.partner-card').first())
  const mapList = page.locator('.partner-map-list button')
  await mapList.nth(1).click()
  const selected = await mapList.nth(1).locator('b').innerText()
  await page.locator(`iframe[title="Mapa de ${selected}"]`).waitFor()
  await context.setOffline(true)
  await page.getByText(/Conecte-se à internet para explorar o mapa/).waitFor()
  assert.equal(await page.locator('iframe').count(), 0)
  await context.setOffline(false)
  await login(demo, 'admin@rkmed.demo', 'demo123')
  await page.goto(`${demo}/admin/parceiros`)
  await openMap(page.locator('.management-row').first())
  await login(connected, 'admin@rkmed.test', 'RKMED-local-test-2026!')
  await page.goto(`${connected}/admin/parceiros`)
  await openMap(page.locator('.partner-directory-entry').first())
  await login(connected, 'ana@rkmed.test', 'RKMED-local-test-2026!')
  await page.goto(`${connected}/app/parceiros`)
  await openMap(page.locator('.partner-directory-entry').first())
  await login(connected, 'parceiro@rkmed.test', 'RKMED-local-test-2026!')
  await page.waitForURL(`${connected}/parceiro`)
  await openMap(page.locator('.workspace-main > .surface-card').first())
  assert.deepEqual(failures, [])
  console.log('PASS: mapas internos por parceiro na landing, gestão demo/conectada, associado e balcão; seleção da rede, teclado, carregamento sob demanda, offline e layout 360px.')
} finally { await browser.close() }
