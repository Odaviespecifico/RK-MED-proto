import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'
import { localClients, login } from '../../scripts/dev/local.mjs'
const local = localClients()
const origin = 'http://127.0.0.1:5174'
const message = `Solicitação sintética ${randomUUID()}`
const member = await login(local, 'ana@rkmed.test')
const ticket = await member.rpc('rk_open_support_request', { p_message: message })
assert.equal(ticket.error, null)
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } })
  const page = await context.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  async function signIn(email) {
    await page.goto(origin + '/acesso-admin')
    await page.getByLabel('E-mail', { exact: true }).fill(email)
    await page.getByLabel('Senha', { exact: true }).fill('RKMED-local-test-2026!')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.waitForURL(/\/(admin|app)$/)
  }
  await signIn('admin@rkmed.test')
  await page.goto(origin + '/admin/suporte')
  await page.getByText(message, { exact: true }).waitFor()
  await page.locator('.dash-row').filter({ hasText: message }).getByRole('button', { name: 'Responder', exact: true }).click()
  await page.getByLabel('Resposta', { exact: true }).fill('Resposta sintética validada no navegador.')
  await page.getByRole('button', { name: 'Registrar resposta', exact: true }).click()
  await page.getByText('Resposta salva no histórico do associado e colocada na fila de e-mail.', { exact: true }).waitFor()
  await page.goto(origin + '/admin/equipe')
  await page.getByRole('heading', { name: 'Acessos internos', exact: true }).waitFor()
  await page.getByLabel('Buscar acesso por e-mail ou estabelecimento').fill('diretoria@rkmed.test')
  const row = page.locator('.staff-access-row').filter({ hasText: 'diretoria@rkmed.test' })
  await row.getByRole('button', { name: 'Editar acesso', exact: true }).click()
  await page.getByLabel('Motivo da alteração').fill('Conferência visual sem alteração')
  await page.getByRole('button', { name: 'Revisar alteração' }).click()
  await page.getByRole('region', { name: 'Confirmar alteração de acesso' }).waitFor()
  assert.equal(await page.locator('body').evaluate(e => e.scrollWidth > innerWidth), false)
  await page.getByRole('button', { name: 'Cancelar alteração' }).click()
  await page.screenshot({ path: '/tmp/rkmed-staff-access.png', fullPage: true })
  await context.close()
  const memberContext = await browser.newContext({ viewport: { width: 360, height: 800 } })
  const memberPage = await memberContext.newPage()
  await memberPage.goto(origin + '/acesso-admin')
  await memberPage.getByLabel('E-mail', { exact: true }).fill('ana@rkmed.test')
  await memberPage.getByLabel('Senha', { exact: true }).fill('RKMED-local-test-2026!')
  await memberPage.getByRole('button', { name: 'Entrar', exact: true }).click()
  await memberPage.waitForURL(origin + '/app')
  await memberPage.goto(origin + '/app/conta')
  await memberPage.getByText('Resposta sintética validada no navegador.', { exact: true }).waitFor()
  assert.equal(await memberPage.locator('body').evaluate(e => e.scrollWidth > innerWidth), false)
  await memberPage.locator('.support-thread').filter({ hasText: message }).getByRole('button', { name: 'Encerrar solicitação' }).click()
  await memberPage.locator('.support-thread').filter({ hasText: message }).getByText('Encerrada', { exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: suporte respondido, histórico do associado, encerramento e gestão de acessos a 360px com banco real local.')
} finally {
  await browser.close()
  execFileSync('docker', ['exec','-i','supabase_db_rkmed','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], { input: `delete from private.notification_outbox where event_key='support.answer:${ticket.data}'; delete from private.support_requests where id='${ticket.data}';`, stdio: ['pipe','pipe','pipe'] })
  await member.auth.signOut({ scope: 'local' })
}
