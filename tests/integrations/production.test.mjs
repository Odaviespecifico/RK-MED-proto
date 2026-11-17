import test from 'node:test'
import assert from 'node:assert/strict'
import { readPublicConfig, publicBuildEnvironment } from '../../src/lib/config.ts'
import { runtimeEnvironment, assertDatabaseEnvironment, deliveryAllowed } from '../../supabase/functions/_shared/environment.ts'
import { createStripeProvider } from '../../supabase/functions/_shared/providers/stripe.ts'
import { createResend } from '../../supabase/functions/_shared/providers/resend.ts'
import { createClickSend } from '../../supabase/functions/_shared/providers/clicksend.ts'
import { processEvent, subscriptionSnapshot } from '../../supabase/functions/_shared/billing.ts'
import { createBilling } from '../../src/integrations/billing.ts'
import { requestPasswordRecovery } from '../../supabase/functions/_shared/password-recovery.ts'
import { deploymentBuild } from '../../scripts/deploy/build.mjs'

// Synthetic configuration and injected transports only: never call live services.
const env = { APP_ENV: 'production', APP_ORIGIN: 'https://members.example.invalid', APP_PROJECT_REF: 'productionref',
  SANDBOX_SUPABASE_PROJECT_REF: 'sandboxref', SUPABASE_URL: 'https://productionref.supabase.co',
  STRIPE_SECRET_KEY: 'rk_live_synthetic', STRIPE_ACCOUNT_ID: 'acct_production', STRIPE_PRICE_ID: 'price_production' }
const publicEnv = { VITE_APP_MODE: 'sandbox', VITE_APP_ENV: 'production', VITE_APP_ORIGIN: env.APP_ORIGIN,
  VITE_SUPABASE_PROJECT_REF: env.APP_PROJECT_REF, VITE_SANDBOX_SUPABASE_PROJECT_REF: env.SANDBOX_SUPABASE_PROJECT_REF,
  VITE_SUPABASE_URL: env.SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' }
const operation = 'a0000000-0000-4000-8000-000000000001'

test('production build requires explicit isolated configuration and rejects preview/test build paths', () => {
  assert.equal(deploymentBuild({ VERCEL_ENV: 'production' }), 'build:hosted')
  assert.equal(deploymentBuild({ VERCEL_ENV: 'production', RKMED_DEPLOY_ENV: 'production' }), 'build:prod')
  assert.throws(() => deploymentBuild({ VERCEL_ENV: 'preview', RKMED_DEPLOY_ENV: 'production' }))
  assert.throws(() => deploymentBuild({ RKMED_DEPLOY_ENV: 'invalid' }))
  assert.equal(readPublicConfig(publicEnv).environment, 'production')
  assert.equal(publicBuildEnvironment(publicEnv, 'prod').config.environment, 'production')
  for (const mode of ['hosted', 'sandbox', 'demo']) assert.throws(() => publicBuildEnvironment(publicEnv, mode))
  assert.throws(() => publicBuildEnvironment({ ...publicEnv, VERCEL_ENV: 'preview' }, 'prod'))
  assert.throws(() => publicBuildEnvironment({ ...publicEnv, VITE_APP_ENV: 'sandbox' }, 'prod'))
  for (const change of [{ VITE_APP_MODE: 'demo' }, { VITE_SANDBOX_SUPABASE_PROJECT_REF: 'productionref' },
    { VITE_SANDBOX_SUPABASE_PROJECT_REF: '' }, { VITE_APP_ORIGIN: 'http://members.example.invalid' },
    { VITE_SUPABASE_URL: 'https://sandboxref.supabase.co' }, { VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_synthetic' }]) {
    assert.throws(() => readPublicConfig({ ...publicEnv, ...change }))
  }
})

test('production services attest database environment and reject homologation projects before provider calls', async () => {
  assert.equal(runtimeEnvironment(env), 'production')
  for (const change of [{ APP_ENV: '' }, { APP_ORIGIN: 'http://localhost:5174' }, { APP_PROJECT_REF: 'sandboxref' },
    { SANDBOX_SUPABASE_PROJECT_REF: '' }, { SUPABASE_URL: 'https://sandboxref.supabase.co' }]) assert.throws(() => runtimeEnvironment({ ...env, ...change }))
  const db = value => ({ rpc: async name => { assert.equal(name, 'rk_backend_environment'); return { data: value, error: null } } })
  await assertDatabaseEnvironment(db('production'), env)
  for (const value of ['local', 'sandbox', null]) await assert.rejects(() => assertDatabaseEnvironment(db(value), env))
  await assert.rejects(() => assertDatabaseEnvironment({ rpc: async () => ({ error: {} }) }, env))
})

test('Stripe live Checkout validates account, price and result; test/live keys never cross environments', async () => {
  let calls = 0
  const price = { id: env.STRIPE_PRICE_ID, livemode: true, active: true, currency: 'brl', unit_amount: 6990, recurring: { interval: 'month', interval_count: 1 } }
  const stripe = { accounts: { retrieve: async () => ({ id: env.STRIPE_ACCOUNT_ID }) }, prices: { retrieve: async () => price },
    checkout: { sessions: { create: async (params, options) => {
      calls++; assert.equal(params.customer, 'cus_production'); assert.equal(params.line_items[0].price, env.STRIPE_PRICE_ID)
      assert.equal(params.success_url, `${env.APP_ORIGIN}/cadastro/pagamento?checkout=processing`)
      assert.equal(options.idempotencyKey, `${env.STRIPE_ACCOUNT_ID}:${operation}`)
      return { id: 'cs_synthetic', url: 'https://checkout.stripe.com/synthetic', livemode: true }
    } } } }
  assert.equal((await createStripeProvider(env, stripe).createCheckout('cus_production', operation)).livemode, true)
  price.livemode = false
  await assert.rejects(() => createStripeProvider(env, stripe).createCheckout('cus_production', operation))
  assert.equal(calls, 1)
  for (const change of [{ STRIPE_SECRET_KEY: 'rk_test_synthetic' }, { APP_ENV: 'sandbox' }, { STRIPE_ACCOUNT_ID: '' }]) {
    assert.throws(() => createStripeProvider({ ...env, ...change }, stripe))
  }
  price.livemode = true
  stripe.accounts.retrieve = async () => ({ id: 'acct_other' })
  await assert.rejects(() => createStripeProvider(env, stripe).createCheckout('cus_production', operation))
  stripe.accounts.retrieve = async () => ({ id: env.STRIPE_ACCOUNT_ID })
  stripe.checkout.sessions.create = async () => ({ livemode: false, url: 'https://checkout.stripe.com/test' })
  await assert.rejects(() => createStripeProvider(env, stripe).createCheckout('cus_production', operation))
})

test('browser Checkout enforces configured test/live mode and Stripe destination', async () => {
  let result = { livemode: true, url: 'https://checkout.stripe.com/synthetic' }
  const client = { auth: { getSession: async () => ({ data: { session: {} } }) }, functions: { invoke: async () => ({ data: result }) } }
  assert.ok((await createBilling(client, 'production').createCheckout(operation)).url)
  await assert.rejects(() => createBilling(client, 'sandbox').createCheckout(operation))
  result = { ...result, livemode: false }
  await assert.rejects(() => createBilling(client, 'production').createCheckout(operation))
  result = { livemode: true, url: 'https://example.invalid' }
  await assert.rejects(() => createBilling(client, 'production').createCheckout(operation))
})

test('live payment lifecycle reconciles current provider state, deduplicates and rejects test resources/events', async () => {
  const price = { id: env.STRIPE_PRICE_ID, currency: 'brl', unit_amount: 6990, recurring: { interval: 'month' } }
  const subscription = { id: 'sub_synthetic', livemode: true, status: 'active', created: 1, cancel_at_period_end: false,
    latest_invoice: 'in_current', items: { data: [{ quantity: 1, price, current_period_end: 1900000000 }] } }
  let invoice = { id: 'in_current', customer: 'cus_synthetic', livemode: true, status: 'paid', attempted: true, amount_remaining: 0 }
  const stripe = { invoices: { retrieve: async () => invoice }, subscriptions: { list: async () => ({ has_more: false, data: [subscription] }) } }
  const states = [], statuses = new Set()
  const db = { rpc: async (name, args) => {
    if (name === 'rk_event_record') return { data: statuses.has(args.p_id) ? 'processed' : 'pending' }
    if (name === 'rk_sync_claim') return { data: 'member_synthetic' }
    if (name === 'rk_sync_apply') states.push(args.p_state)
    if (name === 'rk_wedea_get') return { data: null }
    if (name === 'rk_event_finish' && !args.p_error) statuses.add(args.p_id)
    return { data: null }
  } }
  const event = (id, live = true) => ({ id, livemode: live, type: 'invoice.paid', created: 1, data: { object: { id: invoice.id } } })
  await processEvent(db, stripe, env, event('evt_paid'))
  await processEvent(db, stripe, env, event('evt_paid'))
  invoice = { ...invoice, status: 'open', amount_remaining: 6990 }
  await processEvent(db, stripe, env, event('evt_late'))
  assert.deepEqual(states, ['active', 'past_due'])
  await assert.rejects(() => processEvent(db, stripe, env, event('evt_test', false)))
  invoice.livemode = false
  await assert.rejects(() => processEvent(db, stripe, env, event('evt_wrong_object')))
  assert.deepEqual(states, ['active', 'past_due'])
  assert.throws(() => subscriptionSnapshot(subscription, invoice, env.STRIPE_PRICE_ID, true))
})

test('production messaging requires production mode and its own recipient policy; test wildcards cannot authorize it', async () => {
  const email = 'member@example.invalid', phone = '+5581999990001'
  let requests = 0
  const transport = async url => { requests++; return Response.json(url.includes('clicksend')
    ? { response_code: 'SUCCESS', data: { messages: [{ status: 'SUCCESS', message_id: operation, to: phone }] } } : { id: operation }) }
  const mailEnv = { ...env, RESEND_MODE: 'transactional-production', RESEND_API_KEY: 'synthetic', RESEND_FROM: 'sender@example.invalid', RESEND_ALLOWED_TEST_EMAILS: '*' }
  const smsEnv = { ...env, CLICKSEND_MODE: 'production', CLICKSEND_USERNAME: 'synthetic', CLICKSEND_API_KEY: 'synthetic', SMS_ALLOWED_TEST_NUMBERS: '*' }
  assert.equal(deliveryAllowed(mailEnv, 'email', email), false)
  await assert.rejects(() => createResend(mailEnv, transport).send(email, 'Código', 'Texto', operation))
  await assert.rejects(() => createClickSend(smsEnv, transport).sendCode(phone, '123456', operation))
  assert.equal(requests, 0)
  await createResend({ ...mailEnv, RESEND_ALLOWED_EMAILS: '*' }, transport).send(email, 'Código', 'Texto', operation)
  await createClickSend({ ...smsEnv, SMS_ALLOWED_NUMBERS: '*' }, transport).sendCode(phone, '123456', operation)
  assert.equal(requests, 2)
  await assert.rejects(() => createResend({ ...mailEnv, RESEND_ALLOWED_EMAILS: '*', RESEND_MODE: 'transactional-sandbox' }, transport).send(email, 'Código', 'Texto', operation))
  await assert.rejects(() => createClickSend({ ...smsEnv, SMS_ALLOWED_NUMBERS: '*', CLICKSEND_MODE: 'test' }, transport).sendCode(phone, '123456', operation))
  assert.equal(requests, 2)
})

test('production password recovery uses production recipient policy and preserves generic response', async () => {
  let links = 0
  const db = { rpc: async () => ({ data: true }), auth: { admin: { generateLink: async () => { links++; return { error: {} } } } } }
  const settings = { ...env, OTP_HMAC_SECRET: 'synthetic-only-secret'.repeat(3), RESEND_ALLOWED_TEST_EMAILS: '*' }
  assert.deepEqual(await requestPasswordRecovery(db, settings, 'member@example.invalid'), { accepted: true })
  assert.equal(links, 0)
  assert.deepEqual(await requestPasswordRecovery(db, { ...settings, RESEND_ALLOWED_EMAILS: '*' }, 'member@example.invalid'), { accepted: true })
  assert.equal(links, 1)
})
