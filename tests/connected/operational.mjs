import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'
import { localClients, login } from '../../scripts/dev/local.mjs'

const local = localClients() // This helper rejects every destination except the Docker loopback stack.
const origin = process.env.RKMED_SANDBOX_URL || 'http://127.0.0.1:5174'
const fixture = randomUUID()
const eventKey = `ops-realtime-test-${fixture}`
function sql(statement) {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_rkmed', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'], { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}
async function until(check, label, milliseconds = 12000) {
  const deadline = Date.now() + milliseconds
  while (Date.now() < deadline) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)) }
  throw new Error(`Tempo excedido: ${label}`)
}
const clients = []
let browser
try {
  for (const role of ['admin', 'suporte', 'diretoria', 'ana', 'parceiro', 'anon']) {
    const client = role === 'anon' ? local.client() : await login(local, role + '@rkmed.test')
    const received = []
    const entry = { role, client, received, status: null }
    clients.push(entry)
    client.channel('ops-test-' + role + '-' + fixture)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rk_operational_signal', filter: 'id=eq.1' }, event => received.push(event.new))
      .subscribe(status => { entry.status = status })
  }
  await until(() => clients.every(c => ['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(c.status)), 'inscrições Realtime')
  for (const entry of clients) {
    const summary = await entry.client.rpc('rk_operational_summary')
    if (['admin', 'suporte'].includes(entry.role)) { assert.equal(entry.status, 'SUBSCRIBED'); assert.equal(summary.error, null) }
    else assert.ok(summary.error, `Resumo indevidamente permitido para ${entry.role}`)
  }

  browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const errors = []
  let queueRequests = 0
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().endsWith('/rpc/rk_delivery_queue')) queueRequests++ })
  await page.goto(origin + '/acesso-admin')
  await page.getByLabel('E-mail', { exact: true }).fill('admin@rkmed.test')
  await page.getByLabel('Senha', { exact: true }).fill('RKMED-local-test-2026!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByText('Alertas conectados em tempo real.', { exact: true }).waitFor()
  const summaryBefore = (await clients[0].client.rpc('rk_operational_summary')).data
  const previousRisk = Number(summaryBefore.riskReviews)
  const previousFailure = Number(summaryBefore.deliveryFailures)
  sql(`insert into private.notification_outbox(id,member_id,event_key,kind,status,attempts) values('${fixture}','00000000-0000-4000-8000-000000000001','${eventKey}','risk.charge.dispute.created','failed',1);`)
  await until(() => clients.filter(c => ['admin', 'suporte'].includes(c.role)).every(c => c.received.length > 0), 'sinal entregue a admin/suporte')
  await until(async () => Number(await page.locator('[data-alert="riskReviews"]').textContent()) === previousRisk + 1, 'contador atualizado sem refresh manual')
  assert.equal(Number(await page.locator('[data-alert="deliveryFailures"]').textContent()), previousFailure + 1)
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false)
  await page.getByRole('button', { name: 'Abrir cobranças e fila', exact: true }).click()
  await page.waitForURL(origin + '/admin/cobrancas')
  await page.getByRole('heading', { name: 'Fila de comunicações e alertas', exact: true }).waitFor()
  const requestsBefore = queueRequests
  await page.getByRole('button', { name: 'Abrir cobranças e fila', exact: true }).click()
  await until(() => queueRequests > requestsBefore, 'fila consultada mesmo quando já está aberta')
  for (const c of clients.filter(c => !['admin', 'suporte'].includes(c.role))) assert.equal(c.received.length, 0, `Sinal recebido por ${c.role}`)
  for (const value of clients[0].received) assert.deepEqual(Object.keys(value).sort(), ['changed_at', 'id', 'revision'])

  // Expire this test's support session only, without touching global roles or other sessions.
  const support = clients.find(c => c.role === 'suporte')
  const session = (await support.client.auth.getSession()).data.session
  const sessionId = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url')).session_id
  assert.match(sessionId, /^[a-f\d-]{36}$/i)
  const before = support.received.length
  const adminBefore = clients[0].received.length
  sql(`update auth.sessions set not_after=now()-interval '1 second' where id='${sessionId}'; update private.notification_outbox set status='sent' where id='${fixture}';`)
  await until(() => clients[0].received.length > adminBefore, 'evento seguinte recebido por admin')
  await until(async () => Number(await page.locator('[data-alert="deliveryFailures"]').textContent()) === previousFailure, 'falha removida após envio aceito')
  assert.equal(support.received.length, before, 'Sessão revogada não deve receber novos sinais')
  assert.ok((await support.client.rpc('rk_operational_summary')).error)
  assert.equal(Number(await page.locator('[data-alert="riskReviews"]').textContent()), previousRisk + 1, 'Envio não encerra revisão de risco')
  await page.reload()
  await page.getByText('Alertas conectados em tempo real.', { exact: true }).waitFor()
  assert.equal(Number(await page.locator('[data-alert="riskReviews"]').textContent()), previousRisk + 1)
  assert.deepEqual(errors, [])
  console.log('PASS: Realtime real local, sinal sem PII, UI móvel atualizada, membro/parceiro/diretoria/anônimo isolados e sessão revogada sem novos eventos.')
} finally {
  sql(`delete from private.notification_outbox where id='${fixture}' and event_key='${eventKey}';`)
  if (browser) await browser.close()
  for (const { client } of clients) { await client.removeAllChannels(); await client.auth.signOut({ scope: 'local' }) }
}
