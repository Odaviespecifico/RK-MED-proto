import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const origin = process.env.RKMED_SANDBOX_URL ?? 'http://127.0.0.1:5174'
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addInitScript(() => {
    localStorage.setItem('rkmed-prototype-session-v1', JSON.stringify({ role: 'admin', memberId: 'member-ana' }))
    localStorage.setItem('rkmed-prototype-data-v1', JSON.stringify({ members: [{ id: 'member-ana', name: 'Ana Paula Lima' }] }))
  })
  const page = await context.newPage()
  const modules = []
  page.on('request', request => { modules.push(request.url()) })
  await page.goto(`${origin}/admin`)
  await page.getByText('Entre para continuar', { exact: true }).waitFor()
  assert.equal(await page.getByText('Ana Paula Lima').count(), 0)
  await page.goto(`${origin}/entrar`)
  await page.getByRole('button', { name: 'Login com email' }).click()
  assert.equal(await page.getByText('Acesso de demonstração', { exact: true }).count(), 0)
  await page.route('**/auth/v1/otp', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/auth/v1/verify', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Expired OTP', code: 'otp_expired' }) }))
  await page.getByPlaceholder('seu@email.com').fill('fixture@example.invalid')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByPlaceholder('••••••').fill('123456')
  await page.getByRole('button', { name: 'Acessar meu cartão' }).click()
  await page.getByText('Código inválido ou expirado. Solicite um novo código.').waitFor()
  assert.equal(page.url().includes('/entrar'), true)
  assert.equal(modules.some(url => url.includes('/src/mocks/') || url.includes('DemoApp-')), false)
  await page.screenshot({ path: '/tmp/rkmed-sandbox-login.png', fullPage: true })
  await context.close()
  console.log('PASS: sandbox ignores mock sessions/data, uses Supabase OTP transport and rejects demo OTP on provider failure. No provider requests were sent.')
} finally { await browser.close() }
