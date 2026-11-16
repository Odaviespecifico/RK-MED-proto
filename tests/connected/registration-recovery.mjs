import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
const profile = mkdtempSync(join(tmpdir(), 'rkmed-registration-'))
const options = { executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox'] }
const url = 'http://127.0.0.1:5192/tests/fixtures/registration-preview.html'
let context
try {
  context = await chromium.launchPersistentContext(profile, options)
  let page = await context.newPage(); await page.goto(url)
  await page.getByRole('button',{name:'Adicionar parceiro'}).click()
  await page.getByLabel('Nome do parceiro (obrigatório)').fill('Rascunho preservado')
  await page.close()
  page = await context.newPage(); await page.goto(url)
  await page.getByText('Recuperamos seu preenchimento.',{exact:false}).waitFor()
  assert.equal(await page.getByLabel('Nome do parceiro (obrigatório)').inputValue(),'Rascunho preservado')
  await context.close(); context = undefined
  context = await chromium.launchPersistentContext(profile, options)
  page = await context.newPage(); await page.goto(url)
  await page.getByText('Recuperamos seu preenchimento.',{exact:false}).waitFor()
  assert.equal(await page.getByLabel('Nome do parceiro (obrigatório)').inputValue(),'Rascunho preservado')
  await page.getByRole('button',{name:'Cancelar',exact:true}).click()
  await page.reload(); assert.equal(await page.locator('dialog[open]').count(),0)
  const fallback = await page.evaluate(async () => {
    const original = window.indexedDB
    const { authStorage } = await import('/src/integrations/auth-storage.ts')
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true })
    try {
      await authStorage.setItem('rkmed-auth-synthetic', 'synthetic-token-never-localstorage')
      if (await authStorage.getItem('rkmed-auth-synthetic') !== 'synthetic-token-never-localstorage') return false
      if (JSON.stringify(localStorage).includes('synthetic-token-never-localstorage')) return false
    } finally { Object.defineProperty(window, 'indexedDB', { value: original, configurable: true }) }
    if (await authStorage.getItem('rkmed-auth-synthetic') !== 'synthetic-token-never-localstorage') return false
    await authStorage.removeItem('rkmed-auth-synthetic')
    return await authStorage.getItem('rkmed-auth-synthetic') === null
  }); assert.equal(fallback, true)
  console.log('PASS: fechar a aba e reiniciar o navegador preservam o rascunho; cancelar o remove.')
} finally { if(context) await context.close(); rmSync(profile,{recursive:true,force:true}) }
