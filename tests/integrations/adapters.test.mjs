import test from 'node:test'
import assert from 'node:assert/strict'
import { readPublicConfig } from '../../src/lib/config.ts'
import { normalizeContact, createMemberAuth } from '../../src/integrations/auth.ts'
import { createSandboxBilling } from '../../src/integrations/billing.ts'
import { createTwilioSandbox } from '../../supabase/functions/_shared/providers/twilio.ts'
import { createStripeSandbox } from '../../supabase/functions/_shared/providers/stripe.ts'

const publicEnv = { VITE_APP_MODE: 'sandbox', VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' }
const operation = '00000000-0000-4000-8000-000000000001'
const stripeEnv = { APP_ENV: 'local', STRIPE_SECRET_KEY: 'rk_test_synthetic', STRIPE_TEST_ACCOUNT_ID: 'acct_fixture', STRIPE_PRICE_ID: 'price_fixture', APP_ORIGIN: 'http://127.0.0.1:5174' }

test('frontend rejects privileged credentials, production and wrong Supabase targets before use', () => {
  for (const value of ['sb_secret_sensitive', 'sk_live_sensitive', `x.${btoa(JSON.stringify({ role: 'service_role' }))}.x`]) {
    assert.throws(() => readPublicConfig({ ...publicEnv, VITE_SUPABASE_PUBLISHABLE_KEY: value }), error => !error.message.includes(value))
  }
  for (const change of [{ VITE_APP_ENV: 'production' }, { VITE_TWILIO_AUTH_TOKEN: 'private' }, { VITE_STRIPE_SECRET_KEY: 'private' }, { VITE_SUPABASE_URL: 'https://prod.supabase.co' }]) {
    assert.throws(() => readPublicConfig({ ...publicEnv, ...change }))
  }
  const anonymous = `x.${btoa(JSON.stringify({ role: 'anon' }))}.x`
  assert.equal(readPublicConfig({ ...publicEnv, VITE_SUPABASE_PUBLISHABLE_KEY: anonymous }).mode, 'sandbox')
  assert.equal(readPublicConfig({ ...publicEnv, VITE_APP_ENV: 'sandbox', VITE_SUPABASE_URL: 'https://testref.supabase.co', VITE_SUPABASE_PROJECT_REF: 'testref' }).projectRef, 'testref')
  assert.throws(() => readPublicConfig({ VITE_APP_MODE: 'sandbox' }))
})

test('member OTP uses Supabase identity, disables implicit signup and keeps SMS within phone auth', async () => {
  const calls = []
  const client = { auth: {
    signInWithOtp: async params => { calls.push(params); return { error: null } },
    verifyOtp: async params => { calls.push(params); return { error: null, data: { user: { id: 'same-user' }, session: {} } } },
  } }
  const auth = createMemberAuth(client)
  for (const channel of ['whatsapp', 'sms', 'email']) {
    const request = { channel, contact: channel === 'email' ? ' MEMBER@EXAMPLE.INVALID ' : '(81) 99999-0001' }
    await auth.requestCode(request)
    assert.equal((await auth.verifyCode({ ...request, token: '111111' })).userId, 'same-user')
  }
  assert.equal(calls[0].options.shouldCreateUser, false)
  assert.equal(calls[0].options.channel, 'whatsapp')
  assert.equal(calls[1].type, 'sms')
  assert.equal(calls[2].options.channel, 'sms')
  assert.equal(calls[4].email, 'member@example.invalid')
  assert.equal(calls[5].type, 'email')
  assert.equal(normalizeContact({ channel: 'sms', contact: '+55 81 99999-0001' }), '+5581999990001')
  await assert.rejects(() => auth.verifyCode({ channel: 'email', contact: 'member@example.invalid', token: '123' }))
})

test('provider failure never falls back to a demo OTP, identity or optimistic verification', async () => {
  const auth = createMemberAuth({ auth: {
    signInWithOtp: async () => ({ error: new Error('sensitive provider payload') }),
    verifyOtp: async () => ({ error: new Error('sensitive provider payload'), data: {} }),
  } })
  await assert.rejects(() => auth.requestCode({ channel: 'email', contact: 'a@example.invalid' }), error => !error.message.includes('sensitive'))
  await assert.rejects(() => auth.verifyCode({ channel: 'email', contact: 'a@example.invalid', token: '123456' }), /inválido ou expirado/)
})

test('Twilio is disabled by default and recipient allowlist is checked before network calls', async () => {
  let requests = 0
  const network = async () => { requests++; return new Response('{}', { status: 201 }) }
  await assert.rejects(() => createTwilioSandbox({}, network).sendWhatsAppCode('+12025550123', '123456'))
  const env = { APP_ENV: 'local', TWILIO_MODE: 'whatsapp-sandbox', TWILIO_ACCOUNT_SID: `AC${'a'.repeat(32)}`, TWILIO_AUTH_TOKEN: 'b'.repeat(32), TWILIO_WHATSAPP_FROM: 'whatsapp:+14155238886', TWILIO_ALLOWED_TEST_NUMBERS: '+12025550123' }
  await assert.rejects(() => createTwilioSandbox({ ...env, APP_ENV: 'production' }, network).sendWhatsAppCode('+12025550123', '123456'))
  await assert.rejects(() => createTwilioSandbox(env, network).sendWhatsAppCode('+12025550124', '123456'))
  assert.equal(requests, 0)
  let captured
  await createTwilioSandbox(env, async (url, options) => { captured = { url, options }; return new Response('{}', { status: 201 }) }).sendWhatsAppCode('+12025550123', '123456')
  assert.match(captured.url, /^https:\/\/api.twilio.com\//)
  assert.equal(captured.options.redirect, 'error')
  assert.equal(captured.options.body.get('To'), 'whatsapp:+12025550123')
})

test('Stripe server transport rejects live keys and unexpected accounts/prices before Checkout', async () => {
  assert.throws(() => createStripeSandbox({ ...stripeEnv, STRIPE_SECRET_KEY: 'sk_live_sensitive' }))
  let writes = 0
  const client = { accounts: { retrieve: async () => ({ id: 'acct_wrong' }) }, prices: { retrieve: async () => ({}) }, checkout: { sessions: { create: async () => { writes++ } } } }
  await assert.rejects(() => createStripeSandbox(stripeEnv, client).createCheckout('cus_fixture', operation))
  client.accounts.retrieve = async () => ({ id: 'acct_fixture' })
  client.prices.retrieve = async () => ({ livemode: true, active: true, unit_amount: 6960, currency: 'brl', recurring: { interval: 'month', interval_count: 1 } })
  await assert.rejects(() => createStripeSandbox(stripeEnv, client).createCheckout('cus_fixture', operation))
  assert.equal(writes, 0)
})

test('Stripe server retries preserve all idempotent request parameters and never grant eligibility', async () => {
  const calls = []
  const client = { accounts: { retrieve: async () => ({ id: 'acct_fixture' }) },
    prices: { retrieve: async () => ({ id: 'price_fixture', livemode: false, active: true, unit_amount: 6960, currency: 'brl', recurring: { interval: 'month', interval_count: 1 } }) },
    checkout: { sessions: { create: async (params, options) => { calls.push({ params, options }); return { livemode: false, url: 'https://checkout.stripe.com/test' } } } } }
  const billing = createStripeSandbox(stripeEnv, client)
  await billing.createCheckout('cus_fixture', operation)
  await billing.createCheckout('cus_fixture', operation)
  assert.deepEqual(calls[0], calls[1])
  assert.equal('payment_method_types' in calls[0].params, false)
  assert.equal('automatic_tax' in calls[0].params, false)
  assert.equal('eligible' in calls[0].params, false)
})

test('browser billing fails closed without session/backend or for a non-Stripe response URL', async () => {
  let invocations = 0
  const client = { auth: { getSession: async () => ({ data: { session: null } }) }, functions: { invoke: async () => { invocations++; return { data: null, error: true } } } }
  const billing = createSandboxBilling(client)
  await assert.rejects(() => billing.createCheckout(operation))
  assert.equal(invocations, 0)
  client.auth.getSession = async () => ({ data: { session: {} } })
  await assert.rejects(() => billing.createCheckout(operation))
  client.functions.invoke = async () => ({ data: { livemode: false, url: 'https://evil.example' }, error: null })
  await assert.rejects(() => billing.createCheckout(operation))
})
