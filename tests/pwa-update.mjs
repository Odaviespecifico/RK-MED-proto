import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright-core'

// Change only the worker bytes, preserving the actual compiled app and manifest.
const root = resolve('dist-sandbox')
let revision = 1
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' }
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(root + '/')) { response.writeHead(403).end(); return }
  try {
    const bytes = await readFile(file)
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    response.end(pathname === '/sw.js' ? Buffer.concat([bytes, Buffer.from(`\n// update-test-revision-${revision}\n`)]) : bytes)
  } catch { response.writeHead(404).end() }
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  assert.equal(await page.getByRole('button', { name: 'Atualizar agora', exact: true }).count(), 0)
  revision++
  await page.evaluate(async () => (await navigator.serviceWorker.ready).update())
  const button = page.getByRole('button', { name: 'Atualizar agora', exact: true })
  await button.waitFor()
  await Promise.all([page.waitForEvent('load'), button.click()])
  assert.equal(await page.getByRole('button', { name: 'Atualizar agora', exact: true }).count(), 0)
  console.log('PASS: nova versão do service worker exibe atualização; confirmação ativa a versão e recarrega o app.')
} finally {
  await browser.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
