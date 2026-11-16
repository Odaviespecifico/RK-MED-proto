import test from 'node:test'
import assert from 'node:assert/strict'
import Stripe from 'stripe'

test('production webhook verifies signature and mode, then rejects a sandbox database before Stripe calls', async t => {
  const oldDeno = globalThis.Deno, oldFetch = globalThis.fetch
  t.after(() => { globalThis.Deno = oldDeno; globalThis.fetch = oldFetch })
  const env = { APP_ENV: 'production', APP_ORIGIN: 'https://members.example.invalid', APP_PROJECT_REF: 'productionref',
    SANDBOX_SUPABASE_PROJECT_REF: 'sandboxref', SUPABASE_URL: 'https://productionref.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key', STRIPE_SECRET_KEY: 'rk_live_synthetic', STRIPE_WEBHOOK_SECRET: 'whsec_synthetic' }
  let handler, attestations = 0
  globalThis.Deno = { env: { toObject: () => env }, serve: fn => { handler = fn } }
  globalThis.fetch = async url => {
    assert.equal(String(url), `${env.SUPABASE_URL}/rest/v1/rpc/rk_backend_environment`)
    attestations++
    return Response.json('sandbox')
  }
  await import('../../supabase/functions/stripe-webhook/index.ts')
  const stripe = new Stripe('synthetic-helper')
  const send = async (live, tamper = false) => {
    const body = JSON.stringify({ id: 'evt_synthetic', type: 'invoice.paid', livemode: live, created: 1, data: { object: { id: 'in_synthetic' } } })
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: env.STRIPE_WEBHOOK_SECRET })
    return handler(new Request('https://productionref.supabase.co/functions/v1/stripe-webhook', {
      method: 'POST', headers: { 'stripe-signature': signature }, body: tamper ? `${body} ` : body,
    }))
  }
  assert.equal((await send(true, true)).status, 400)
  assert.equal((await send(false)).status, 400)
  assert.equal(attestations, 0)
  assert.equal((await send(true)).status, 503)
  assert.equal(attestations, 1)
})

test('production OTP handler refuses test recipient policy and mismatched database without sending a code', async t => {
  const oldDeno = globalThis.Deno, oldFetch = globalThis.fetch
  t.after(() => { globalThis.Deno = oldDeno; globalThis.fetch = oldFetch })
  const env = { APP_ENV: 'production', APP_ORIGIN: 'https://members.example.invalid', APP_PROJECT_REF: 'productionref',
    SANDBOX_SUPABASE_PROJECT_REF: 'sandboxref', SUPABASE_URL: 'https://productionref.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key', OTP_HMAC_SECRET: 'synthetic-secret'.repeat(3), SMS_ALLOWED_TEST_NUMBERS: '*' }
  let handler, calls = 0
  globalThis.Deno = { env: { toObject: () => env }, serve: fn => { handler = fn } }
  globalThis.fetch = async url => {
    assert.equal(String(url), `${env.SUPABASE_URL}/rest/v1/rpc/rk_backend_environment`)
    calls++
    return Response.json('sandbox')
  }
  await import('../../supabase/functions/phone-code/index.ts')
  const send = () => handler(new Request(`${env.SUPABASE_URL}/functions/v1/phone-code`, { method: 'POST',
    headers: { origin: env.APP_ORIGIN }, body: JSON.stringify({ action: 'request', purpose: 'signup', channel: 'sms', contact: '+5581999990001' }) }))
  assert.equal((await send()).status, 400)
  assert.equal(calls, 0)
  env.SMS_ALLOWED_NUMBERS = '*'
  assert.equal((await send()).status, 400)
  assert.equal(calls, 1)
})
