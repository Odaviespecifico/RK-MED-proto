import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

// Read-only against hosted homologation. Never requests OTPs or creates payments.
const origin = 'https://rk-med-proto.vercel.app'
const backend = 'https://chuyompxoctmpawhfmyb.supabase.co'
const key = process.env.RKMED_HOSTED_KEY
assert.ok(key, 'Configure RKMED_HOSTED_KEY com a chave publicável da homologação')
const headers = { apikey: key, 'Content-Type': 'application/json', Origin: origin }
for (const rpc of ['rk_partners', 'rk_documents']) {
  const response = await fetch(`${backend}/rest/v1/rpc/${rpc}`, { method: 'POST', headers, body: '{}' })
  assert.equal(response.status, 200, rpc)
  assert.ok(Array.isArray(await response.json()))
}
for (const rpc of ['rk_context', 'rk_admin_overview', 'rk_member_economy', 'rk_support_requests', 'rk_staff_accounts', 'rk_backend_pending']) {
  const response = await fetch(`${backend}/rest/v1/rpc/${rpc}`, { method: 'POST', headers, body: '{}' })
  assert.ok([401, 403].includes(response.status), `${rpc} recusado sem sessão`)
}
const work = await fetch(`${backend}/rest/v1/rpc/rk_start_work`, { method: 'POST', headers,
  body: JSON.stringify({ p_code: '0000', p_establishment_code: 'INVALID000' }) })
assert.ok([401, 403].includes(work.status), 'Início de turno exige sessão autorizada')
for (const [rpc, body] of [
  ['rk_backend_test_partner_finish', { p_actor: '00000000-0000-4000-8000-000000000001', p_session: '00000000-0000-4000-8000-000000000002', p_operation: '00000000-0000-4000-8000-000000000003', p_owner: '00000000-0000-4000-8000-000000000004' }],
  ['rk_backend_test_partner_release', { p_actor: '00000000-0000-4000-8000-000000000001', p_operation: '00000000-0000-4000-8000-000000000003', p_owner: '00000000-0000-4000-8000-000000000004' }],
]) {
  const response = await fetch(`${backend}/rest/v1/rpc/${rpc}`, { method: 'POST', headers, body: JSON.stringify(body) })
  assert.ok([401, 403].includes(response.status), `${rpc} exige backend autorizado`)
}
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  await context.addInitScript(() => localStorage.setItem('rkmed-prototype-session-v1', JSON.stringify({ role: 'admin' })))
  const page = await context.newPage()
  const errors = []; const modules = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().endsWith('.js')) modules.push(request.url()) })
  const partners = page.waitForResponse(response => response.url() === `${backend}/rest/v1/rpc/rk_partners`)
  await page.goto(origin)
  assert.equal((await partners).status(), 200)
  await page.getByRole('button', { name: 'Começar cadastro', exact: false }).click()
  await page.getByRole('button', { name: 'Receber código por e-mail', exact: true }).waitFor()
  await page.goto(`${origin}/admin`)
  await page.getByText('Entre para continuar', { exact: true }).waitFor()
  await page.goto(`${origin}/entrar`)
  await page.getByRole('button', { name: /^Login com SMS/ }).waitFor()
  assert.equal(modules.some(url => /DemoApp|mocks/.test(url)), false)
  assert.deepEqual(errors, [])
  await page.route(`${backend}/rest/v1/rpc/rk_partners`, route => route.abort())
  await page.goto(origin)
  await page.getByText('Não foi possível carregar a rede de parceiros. Recarregue a página para tentar novamente.', { exact: true }).waitFor()
  console.log('PASS: site hospedado conectado ao projeto correto; telas de cadastro/login SMS carregadas; mocks ignorados; RPCs privados recusados; falha de parceiros visível. Nenhum OTP ou pagamento disparado.')
} finally { await browser.close() }
