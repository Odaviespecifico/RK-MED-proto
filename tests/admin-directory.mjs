import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
const origin = process.env.RKMED_TEST_URL ?? 'http://127.0.0.1:5173'

try {
  await page.goto(`${origin}/acesso-admin`)
  await page.getByPlaceholder('••••••••').fill('demo123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.goto(`${origin}/admin/parceiros`)
  await page.getByRole('heading', { name: 'Adicionar parceiro' }).waitFor()
  await page.getByLabel('Nome do estabelecimento').fill('Clínica Aurora')
  await page.getByLabel('Categoria').fill('Clínica')
  await page.getByLabel('Desconto (%)').fill('18')
  await page.getByLabel('Endereço completo').fill('Rua das Flores, 42 · Carpina, PE')
  await page.getByRole('button', { name: 'Adicionar parceiro' }).click()
  await page.getByRole('heading', { name: 'Clínica Aurora' }).waitFor()

  await page.goto(`${origin}/admin/equipe`)
  await page.locator('.management-selector select').selectOption({ label: 'Clínica Aurora' })
  await page.getByLabel('Nome completo').fill('Joana Alves')
  await page.getByLabel('Código de quatro dígitos').fill('7391')
  await page.getByRole('button', { name: 'Adicionar funcionário' }).click()
  await page.getByText('Joana Alves').waitFor()

  await page.goto(`${origin}/acesso-parceiro`)
  await page.getByPlaceholder('••••••••').fill('demo123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByPlaceholder('••••').fill('7391')
  await page.getByRole('button', { name: 'Iniciar atendimento' }).click()
  await page.getByRole('alert').getByText('Código não autorizado para este parceiro.', { exact: false }).waitFor()
  await page.locator('.partner-entry-card select').selectOption({ label: 'Clínica Aurora' })
  await page.getByPlaceholder('••••').fill('7391')
  await page.getByRole('button', { name: 'Iniciar atendimento' }).click()
  await page.getByRole('heading', { name: 'Atendimento no balcão' }).waitFor()
  await page.locator('.workspace-sidebar nav button').nth(1).click()
  assert.equal(await page.getByText('Marina Costa').count(), 0)
  console.log('PASS: admin creates a partner and employee; employee code is limited to its partner and history is scoped.')
} finally {
  await browser.close()
}
