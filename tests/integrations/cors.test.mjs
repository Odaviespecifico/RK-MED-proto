import test from 'node:test'
import assert from 'node:assert/strict'

test('browser gateways allow configured localhost and hosted preflights and retain CORS on failures', async t => {
  const oldDeno = globalThis.Deno
  t.after(() => { globalThis.Deno = oldDeno })
  const env = { APP_ENV: 'sandbox', APP_ORIGIN: 'https://rkmed.vercel.app', CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:5175,http://localhost:5175', OTP_HMAC_SECRET: 'synthetic-secret'.repeat(3) }
  for (const name of ['phone-code', 'rkmed-api']) {
    let handler
    globalThis.Deno = { env: { toObject: () => env }, serve: fn => { handler = fn } }
    await import(`../../supabase/functions/${name}/index.ts?cors`)
    const send = (origin, method = 'OPTIONS') => handler(new Request(`https://example.invalid/${name}`, { method, headers: { origin, 'content-type': 'application/json', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,apikey,content-type,x-client-info' }, ...(method === 'POST' ? { body: '{}' } : {}) }))
    for (const origin of [env.APP_ORIGIN, 'http://127.0.0.1:5175', 'http://localhost:5175', 'https://rk-med-proto-git-stage-odaviespecificos-projects.vercel.app']) {
      const preflight = await send(origin)
      assert.equal(preflight.status, 200)
      assert.equal(preflight.headers.get('access-control-allow-origin'), origin)
      assert.match(preflight.headers.get('access-control-allow-headers'), /apikey/)
      assert.equal(preflight.headers.get('vary'), 'Origin')
      const failure = await send(origin, 'POST')
      assert.ok(failure.status >= 400)
      assert.equal(failure.headers.get('access-control-allow-origin'), origin)
    }
    env.APP_ENV = 'production'
    assert.equal((await send(env.APP_ORIGIN)).status, 200)
    for (const origin of ['https://rkmed.vercel.app.evil.test', 'null', 'http://127.0.0.1:5175']) {
      const denied = await send(origin)
      assert.equal(denied.status, 403)
      assert.equal(denied.headers.get('access-control-allow-origin'), null)
    }
    env.APP_ENV = 'sandbox'
  }
})
