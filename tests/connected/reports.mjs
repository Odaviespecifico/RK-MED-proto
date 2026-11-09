import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'
import { localClients, login } from '../../scripts/dev/local.mjs'
const origin = process.env.RKMED_SANDBOX_URL || 'http://127.0.0.1:5174'
const local = localClients()
const viewer = await login(local, 'diretoria@rkmed.test')
const denied = await viewer.rpc('rk_export_purchases', { p_from: '2026-01-01', p_to: '2026-01-01' })
assert.equal(denied.error?.code, '42501')
await viewer.auth.signOut({ scope: 'local' })
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  for (const role of ['diretoria', 'suporte']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin + '/acesso-admin')
    await page.getByLabel('E-mail', { exact: true }).fill(role + '@rkmed.test')
    await page.getByLabel('Senha', { exact: true }).fill('RKMED-local-test-2026!')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.getByRole('heading', { name: 'Visão geral', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Abrir navegação' }).click()
    await page.getByRole('button', { name: 'Relatórios', exact: true }).click()
    await page.getByRole('button', { name: 'Consultar relatório', exact: true }).click()
    await page.getByText('Registros no período', { exact: true }).waitFor()
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false)
    if (role === 'diretoria') {
      assert.equal(await page.getByRole('button', { name: 'Exportar CSV' }).count(), 0)
    } else {
      await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click()
      const received = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Confirmar exportação', exact: true }).click()
      const download = await received
      assert.match(download.suggestedFilename(), /^rkmed-compras-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/)
      const text = await readFile(await download.path(), 'utf8')
      assert.ok(text.startsWith('\uFEFF"Registro";"Associado";"CPF mascarado"'))
      assert.ok(!text.includes('12345678909'))
      assert.ok(!text.includes('ana@rkmed.test'))
      await page.getByText(/A exportação foi auditada/).waitFor()
    }
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log('PASS: relatórios móveis reais, diretoria sem exportação na UI/API e CSV autorizado sem CPF integral/contatos.')
} finally { await browser.close() }
