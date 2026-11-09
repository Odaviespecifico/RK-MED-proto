import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { localClients, login as fixtureLogin, establishmentCode } from '../../scripts/dev/local.mjs'
const local = localClients()
const partnerFixture = await fixtureLogin(local, 'parceiro@rkmed.test')
const entryCode = await establishmentCode(local, partnerFixture)
await partnerFixture.auth.signOut({ scope: 'local' })
const origin = process.env.RKMED_SANDBOX_URL || 'http://127.0.0.1:5174'
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const failures = []
  page.on('pageerror', error => failures.push(error.message))
  async function login(email) {
    await page.goto(`${origin}/acesso-admin`)
    await page.getByLabel('E-mail', { exact: true }).fill(email)
    await page.getByLabel('Senha', { exact: true }).fill('RKMED-local-test-2026!')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  }
  async function signout() { await page.getByRole('button', { name: 'Abrir navegação' }).click(); await page.getByRole('button', { name: 'Sair', exact: true }).click(); await page.waitForURL(origin + '/') }
  for (const [path, title] of [['termos', 'Termos de uso'], ['privacidade', 'Aviso de privacidade']]) {
    await page.goto(`${origin}/${path}`)
    await page.getByRole('heading', { name: title, exact: true }).waitFor()
    await page.getByText(/^Versão: test-/).waitFor()
    assert.ok(await page.getByText('Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.', { exact: false }).count())
  }
  await login('parceiro@rkmed.test')
  assert.equal(await page.locator('select').count(), 0)
  await page.getByLabel('Código do estabelecimento').fill(entryCode)
  await page.getByLabel('Código do funcionário').fill('2468')
  await page.getByRole('button', { name: 'Iniciar atendimento' }).click()
  await page.getByRole('button', { name: 'Buscar por CPF' }).click()
  await page.getByLabel('CPF exato').fill('12345678909')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await page.getByText('Benefício disponível', { exact: true }).waitFor()
  await page.getByRole('checkbox', { name: 'Conferi a pessoa com a foto' }).check()
  await page.getByLabel('Valor bruto (R$)').fill('200,00')
  await page.getByRole('button', { name: 'Revisar valores' }).click()
  await page.getByText('Desconto: R$ 40,00 (20%)', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Confirmar registro' }).click()
  await page.getByText('Compra registrada!', { exact: true }).waitFor()
  await page.screenshot({ path: '/tmp/rkmed-connected-counter.png', fullPage: true })
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false)
  await signout()
  await login('diretoria@rkmed.test')
  await page.getByRole('heading', { name: 'Visão geral', exact: true }).waitFor()
  await page.getByText('ASSOCIADOS ATIVOS', { exact: true }).waitFor()
  assert.equal(await page.getByText('ana@rkmed.test', { exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Bloquear', exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Abrir navegação' }).click()
  await page.getByRole('button', { name: 'Compras', exact: true }).click()
  await page.getByRole('heading', { name: 'Compras registradas' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Estornar', exact: true }).count(), 0)
  await signout()
  await login('ana@rkmed.test') // Synthetic fixture password through real local Auth; member product login remains OTP.
  await page.getByRole('img', { name: 'QR do cartão do associado' }).waitFor()
  for (const [label, heading] of [['Parceiros', 'Parceiros'], ['Economia', 'Minha economia'], ['Assinatura', 'Minha assinatura'], ['Conta', 'Minha conta']]) {
    await page.getByRole('button', { name: 'Abrir navegação' }).click()
    await page.getByRole('dialog', { name: 'Navegação do painel' }).getByRole('button', { name: label, exact: true }).click()
    await page.getByRole('heading', { name: heading, exact: true }).waitFor()
  }
  await page.getByText('ana@rkmed.test', { exact: true }).waitFor()
  await page.getByText('Sua mensagem', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Abrir navegação' }).click()
  await page.getByRole('dialog', { name: 'Navegação do painel' }).getByRole('button', { name: 'Início', exact: true }).click()
  await page.getByRole('img', { name: 'QR do cartão do associado' }).waitFor()
  await page.screenshot({ path: '/tmp/rkmed-connected-member.png', fullPage: true })
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false)
  assert.deepEqual(failures, [])
  console.log('PASS: balcão móvel com Auth/RPC/Storage reais locais, foto, cálculo, compra, diretoria sem ações e cartão do associado.')
  await context.close()
} finally { await browser.close() }
