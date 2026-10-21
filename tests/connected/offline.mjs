import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
const origin = process.env.RKMED_OFFLINE_URL || 'http://127.0.0.1:4174'
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  async function login(email) { await page.goto(`${origin}/acesso-admin`); await page.getByLabel('E-mail', { exact: true }).fill(email); await page.getByLabel('Senha', { exact: true }).fill('RKMED-local-test-2026!'); await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await page.getByRole('img', { name: 'QR do cartão do associado' }).waitFor() }
  const cached = () => page.evaluate(async () => { const database = await new Promise((resolve, reject) => { const req = indexedDB.open('rkmed-sandbox-member-v1', 1); req.onsuccess = () => resolve(req.result); req.onerror = reject }); try { return await new Promise((resolve, reject) => { const req = database.transaction('snapshots').objectStore('snapshots').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = reject }) } finally { database.close() } })
  await login('ana@rkmed.test')
  async function waitSnapshot(accountSuffix) {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      const rows = await cached()
      if (rows.length === 1 && rows[0].account.endsWith(accountSuffix) && rows[0].photo?.startsWith('data:image/')) return
      await page.waitForTimeout(200)
    }
    throw new Error('Snapshot não ficou disponível em 30 segundos.')
  }
  await waitSnapshot('000000000001')
  const rows = await cached()
  assert.equal(rows.length, 1); assert.equal(rows[0].member.cpf, '***.***.***-09')
  assert.ok(!JSON.stringify(rows).includes('12345678909'))
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  try { await page.getByRole('img', { name: 'QR do cartão do associado' }).waitFor() }
  catch (error) {
    console.error('Offline diagnostics:', await page.evaluate(() => ({ path: location.pathname, online: navigator.onLine, controlled: !!navigator.serviceWorker.controller, accountPresent: !!localStorage.getItem('rkmed-sandbox-offline-account-v1'), headings: [...document.querySelectorAll('h1,h2,[role="status"]')].map(el => el.textContent) })))
    throw error
  }
  await page.getByText('Você está offline.', { exact: false }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Gerenciar pagamento' }).isDisabled(), true)
  await page.goto(origin + '/') // Installed manifest start_url must also recover the member card.
  await page.getByRole('img', { name: 'QR do cartão do associado' }).waitFor()
  await page.waitForURL(origin + '/app')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await page.waitForURL(origin + '/')
  assert.equal((await cached()).length, 0)
  assert.equal(await page.evaluate(() => localStorage.getItem('rkmed-sandbox-offline-account-v1')), null)
  assert.equal(await page.evaluate(() => localStorage.getItem('rkmed-auth-local-local')), null)
  await context.setOffline(false)
  await login('carlos@rkmed.test')
  await page.waitForFunction(() => localStorage.getItem('rkmed-sandbox-offline-account-v1')?.endsWith('000000000002'))
  await waitSnapshot('000000000002')
  const other = await cached()
  assert.equal(other.length, 1); assert.ok(other[0].account.endsWith('000000000002')); assert.ok(!JSON.stringify(other).includes('Ana'))
  console.log('PASS: PWA compilada, reinício offline, snapshot privado sem CPF integral, ações desabilitadas, limpeza no logout e isolamento entre contas.')
  await context.close()
} finally { await browser.close() }
