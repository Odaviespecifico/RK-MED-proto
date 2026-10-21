import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
try {
  await page.goto(`${process.env.RKMED_TEST_URL ?? 'http://127.0.0.1:4173'}/entrar`)
  await page.getByRole('button', { name: 'Login com email' }).click()
  await page.getByPlaceholder('ana@exemplo.com').fill('ana@exemplo.com')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByPlaceholder('••••••').fill('123456')
  await page.getByRole('button', { name: 'Acessar meu cartão' }).click()
  await page.getByRole('img', { name: 'QR do cartão do associado' }).waitFor()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('img', { name: 'QR do cartão do associado' }).waitFor()
  await page.getByText('Modo offline').waitFor({ timeout: 15000 })
  await page.screenshot({ path: '/tmp/rkmed-offline.png', fullPage: true })
  await page.getByRole('button', { name: 'Economia' }).last().click()
  await page.getByText('R$ 75,00').first().waitFor()
  await page.getByRole('button', { name: 'Conta' }).last().click()
  if (!await page.getByRole('button', { name: 'Gerenciar cobrança' }).isDisabled()) throw new Error('Billing action must be disabled offline')
  await page.goto(`${process.env.RKMED_TEST_URL ?? 'http://127.0.0.1:4173'}/admin`)
  await page.getByText('Conexão necessária', { exact: true }).waitFor()
  console.log('PASS: built PWA reloads member card and savings while offline.')
} finally {
  await browser.close()
}
