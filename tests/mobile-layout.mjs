import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
const routes = {
  public: ['/', '/entrar', '/cadastro'],
  member: ['/app', '/app/parceiros', '/app/economia', '/app/assinatura', '/app/conta'],
  partner: ['/parceiro', '/parceiro/historico'],
  admin: ['/admin', '/admin/parceiros', '/admin/equipe', '/admin/compras', '/admin/cobrancas'],
}

try {
  for (const width of [320, 360, 390, 430, 768]) {
    for (const [role, paths] of Object.entries(routes)) {
      const context = await browser.newContext({ viewport: { width, height: 780 }, serviceWorkers: 'block' })
      await context.addInitScript(currentRole => {
        if (currentRole !== 'public') localStorage.setItem('rkmed-prototype-session-v1', JSON.stringify({ role: currentRole, memberId: currentRole === 'member' ? 'member-ana' : undefined }))
        if (currentRole === 'partner') sessionStorage.setItem('rkmed-demo-work-session-v1', JSON.stringify({ employeeId: 'employee-marina', partnerId: 'vida' }))
      }, role)
      const page = await context.newPage()
      for (const path of paths) {
        await page.goto(`${process.env.RKMED_TEST_URL ?? 'http://127.0.0.1:5173'}${path}`, { waitUntil: 'domcontentloaded' })
        const layout = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
          smallTargets: [...document.querySelectorAll('.mobile-bottom-nav button, .workspace-sidebar nav button, .workspace-sidebar-bottom button, .login-choice button, .mobile-menu, .filter-chips button, .counter-tabs button')]
            .filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0)
            .filter(element => { const rect = element.getBoundingClientRect(); return rect.width < 44 || rect.height < 44 })
            .map(element => element.textContent?.trim() || element.getAttribute('aria-label') || element.tagName),
        }))
        assert.ok(layout.scrollWidth <= width, `${path} at ${width}px scrolls horizontally to ${layout.scrollWidth}px`)
        assert.deepEqual(layout.smallTargets, [], `${path} at ${width}px has small navigation targets`)
        if (role === 'partner' || role === 'admin') {
          await page.getByRole('button', { name: 'Abrir navegação' }).click()
          const drawer = page.getByRole('dialog', { name: 'Navegação do painel' })
          await drawer.waitFor({ state: 'visible' })
          assert.ok(await drawer.locator('nav button').first().isVisible(), 'Navigation options must be visible')
          await page.keyboard.press('Escape')
          assert.equal(await drawer.count(), 0, 'Escape must close navigation')
          assert.ok(await page.getByRole('button', { name: 'Abrir navegação' }).evaluate(element => element === document.activeElement), 'Focus must return to the menu button')
        }
        if (path === '/app' && width <= 430) {
          const qr = await page.locator('.qr-img').boundingBox()
          const nav = await page.locator('.mobile-bottom-nav').boundingBox()
          assert.ok(qr && nav && qr.y + qr.height <= nav.y, 'Member QR must fit above bottom navigation on first screen')
        }
      }
      await context.close()
    }
  }
  console.log('PASS: layouts fit 320–768px; member QR is visible and staff navigation supports Escape and focus return.')
} finally {
  await browser.close()
}
