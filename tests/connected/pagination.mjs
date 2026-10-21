import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { scaleFixture } from '../../scripts/dev/scale-fixture.mjs'
import { fixturePassword } from '../../scripts/dev/local.mjs'

const fixture = await scaleFixture({ members: 60, purchases: 120, history: 60 })
const origin = process.env.RKMED_PAGINATION_URL || 'http://127.0.0.1:4174'
let browser
async function until(check, message) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)) }
  throw new Error(message)
}
async function login(page, email) {
  await page.goto(origin + '/acesso-admin')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(fixturePassword)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
  const context = await browser.newContext({ viewport: { width: 360, height: 844 } })
  const page = await context.newPage()
  const errors = [], requests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => requests.push(request.url()))
  const names = () => page.locator('tbody tr td:first-child b').allTextContents()
  await login(page, 'diretoria@rkmed.test')
  await page.getByRole('heading', { name: 'Associados', exact: true }).waitFor()
  await page.getByLabel('Buscar por nome').fill(fixture.prefix)
  await page.getByRole('button', { name: 'Buscar associados', exact: true }).click()
  await until(async () => (await names()).length === 25 && (await names()).every(name => name.startsWith(fixture.prefix)), 'Primeira página de associados')
  const first = await names()
  const controls = page.getByRole('navigation', { name: 'Páginas de associados', exact: true })
  await controls.getByRole('button', { name: 'Próxima página' }).click()
  await until(async () => (await names()).length === 25 && !(await names()).some(name => first.includes(name)), 'Segunda página sem duplicatas')
  const second = await names()
  await controls.getByRole('button', { name: 'Próxima página' }).click()
  await until(async () => (await names()).length === 10, 'Última página de associados')
  assert.equal(await controls.getByRole('button', { name: 'Próxima página' }).isDisabled(), true)
  await controls.getByRole('button', { name: 'Página anterior' }).click()
  await until(async () => JSON.stringify(await names()) === JSON.stringify(second), 'Voltar para a página anterior')
  await page.getByLabel('Buscar por nome').fill(fixture.prefix + ' 0001')
  await page.getByRole('button', { name: 'Buscar associados', exact: true }).click()
  await until(async () => (await names()).length === 1, 'Busca no servidor')
  assert.match(await page.locator('tbody').textContent(), /1\.240,00/)
  assert.equal(await controls.getByRole('button', { name: 'Página anterior' }).isDisabled(), true)
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false)

  // A late response from an older search must not replace the current filter's rows.
  let release, started = false
  const blocked = new Promise(resolve => { release = resolve })
  await page.route('**/rpc/rk_members_page', async route => {
    if (route.request().postDataJSON().p_query === fixture.prefix) { started = true; await blocked }
    await route.continue()
  })
  await page.getByLabel('Buscar por nome').fill(fixture.prefix)
  await page.getByRole('button', { name: 'Buscar associados', exact: true }).click()
  await until(() => started, 'Busca antiga iniciada')
  await page.getByLabel('Buscar por nome').fill(fixture.prefix + ' 0002')
  await page.getByRole('button', { name: 'Buscar associados', exact: true }).click()
  await until(async () => (await names())[0] === fixture.prefix + ' 0002', 'Nova busca respondeu')
  const oldResponse = page.waitForResponse(response => response.url().endsWith('/rpc/rk_members_page') && response.request().postDataJSON().p_query === fixture.prefix)
  release(); await oldResponse; await page.waitForTimeout(300)
  assert.deepEqual(await names(), [fixture.prefix + ' 0002'])
  assert.deepEqual(errors, [])
  await context.close()

  const memberContext = await browser.newContext({ viewport: { width: 360, height: 844 } })
  const member = await memberContext.newPage()
  member.on('pageerror', error => errors.push(error.message))
  member.on('request', request => requests.push(request.url()))
  await login(member, fixture.memberEmail)
  await member.getByRole('img', { name: 'QR do cartão do associado' }).waitFor()
  assert.equal(await member.locator('body').evaluate(el => el.scrollWidth > innerWidth), false)
  const cached = () => member.evaluate(async () => {
    const database = await new Promise((resolve, reject) => { const req = indexedDB.open('rkmed-sandbox-member-v1', 1); req.onsuccess = () => resolve(req.result); req.onerror = reject })
    try { return await new Promise((resolve, reject) => { const req = database.transaction('snapshots').objectStore('snapshots').getAll(); req.onsuccess = () => resolve(req.result[0]); req.onerror = reject }) } finally { database.close() }
  })
  await until(async () => { const value = await cached(); return value?.purchases.length === 25 && value.photo?.startsWith('data:image/') }, 'Primeira página salva com foto')
  const historyControls = member.getByRole('navigation', { name: 'Páginas do meu histórico' })
  await historyControls.getByRole('button', { name: 'Próxima página' }).click()
  await until(async () => (await cached())?.purchases.length === 50, 'Segunda página preserva a primeira no cache')
  await historyControls.getByRole('button', { name: 'Próxima página' }).click()
  await until(async () => (await cached())?.purchases.length === 62, 'Histórico completo consultado preservado no cache')
  assert.equal((await cached()).savingsCents, '124000')
  assert.ok(!JSON.stringify(await cached()).includes(fixture.cpf))
  assert.match(await member.locator('.savings-card strong').textContent(), /1\.240,00/)
  await member.evaluate(() => navigator.serviceWorker.ready)
  await member.reload()
  await member.waitForFunction(() => !!navigator.serviceWorker.controller)
  await memberContext.setOffline(true)
  await member.reload()
  await member.getByText('Mostrando apenas o histórico salvo neste aparelho.', { exact: false }).waitFor()
  await member.getByRole('img', { name: 'QR do cartão do associado' }).waitFor()
  await until(async () => await member.locator('tbody tr').count() === 25, 'Histórico offline paginado')
  await member.getByRole('navigation', { name: 'Páginas do meu histórico' }).getByRole('button', { name: 'Próxima página' }).click()
  await member.getByText('Página 2', { exact: true }).waitFor()
  assert.match(await member.locator('.savings-card strong').textContent(), /1\.240,00/)
  assert.equal(await member.getByRole('button', { name: 'Gerenciar pagamento' }).isDisabled(), true)
  assert.equal(requests.filter(url => /\/rpc\/(rk_purchases|rk_admin_members)$/.test(url)).length, 0)
  assert.deepEqual(errors, [])
  await memberContext.close()
  console.log('PASS: paginação móvel, busca/cursor sem duplicatas, resposta antiga ignorada, totais completos e páginas offline preservadas sem consultas integrais.')
} finally { if (browser) await browser.close(); await fixture.cleanup() }
