import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:5192/tests/fixtures/registration-preview.html')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  for (const viewport of [{ width: 1280, height: 900 }, { width: 360, height: 820 }, { width: 360, height: 540 }]) {
    await page.setViewportSize(viewport)
    for (const name of ['Adicionar parceiro', 'Adicionar administrador']) {
      await page.getByRole('button', { name, exact: true }).click()
      const dialog = page.locator('dialog[open]')
      const box = await dialog.boundingBox()
      assert.ok(Math.abs(box.x + box.width / 2 - viewport.width / 2) < 2, 'Modal centralizado horizontalmente')
      assert.ok(Math.abs(box.y + box.height / 2 - viewport.height / 2) < 2, 'Modal centralizado verticalmente')
      assert.ok(box.y >= 10 && box.y + box.height <= viewport.height - 10, 'Modal contido na tela')
      assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth), false, 'Sem overflow horizontal')
      assert.equal(await dialog.locator('[aria-current="step"]').count(), 1)
      const action = dialog.getByRole('button', { name: 'Continuar', exact: true })
      await action.scrollIntoViewIfNeeded()
      const actionBox = await action.boundingBox()
      assert.ok(actionBox.y >= 0 && actionBox.y + actionBox.height <= viewport.height, 'Ação acessível na área visível')
      await page.keyboard.press('Escape')
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), name, 'Foco devolvido ao botão')
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Adicionar parceiro', exact: true }).click()
  await page.screenshot({ path: '/tmp/rkmed-registration-refined-desktop.png' })
  await page.setViewportSize({ width: 360, height: 820 })
  await page.screenshot({ path: '/tmp/rkmed-registration-refined-mobile.png' })
  console.log('PASS: modais centralizados em desktop, celular e tela baixa; ações visíveis, sem overflow e foco restaurado.')
} finally { await browser.close() }
