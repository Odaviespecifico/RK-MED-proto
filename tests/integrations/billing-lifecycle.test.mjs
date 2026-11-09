import test from 'node:test'
import assert from 'node:assert/strict'
import { checkout, subscriptionSnapshot, processEvent } from '../../supabase/functions/_shared/billing.ts'
const subscription = { id: 'sub_test', livemode: false, status: 'active', cancel_at_period_end: true, items: { data: [{ price: { id: 'price_test', currency: 'brl', unit_amount: 6990, recurring: { interval: 'month' } }, quantity: 1, current_period_end: 1900000000 }] } }
const invoice = { id: 'in_test', livemode: false, status: 'paid', attempted: true, amount_remaining: 0 }
test('RF-PAG: Checkout payment reconciles to the persisted member Customer only after a provider event', async () => {
  const memberId = '00000000-0000-4000-8000-000000000001'
  const operationId = '00000000-0000-4000-8000-000000000002'
  const env = { APP_ENV: 'local', APP_ORIGIN: 'http://127.0.0.1:5174', STRIPE_SECRET_KEY: 'rk_test_synthetic', STRIPE_TEST_ACCOUNT_ID: 'acct_test', STRIPE_PRICE_ID: 'price_test' }
  let savedCustomer = null
  let sessionCustomer = null
  const applied = []
  const db = {
    storage: { from: () => ({ download: async () => ({ data: { size: 1 }, error: null }) }) },
    rpc: async (name, args) => {
      let data = null
      if (name === 'rk_backend_member') data = { id: memberId, name: 'Teste', email: 'member@example.invalid', phone: '+5581999990001', verified: true, consented: true, photoPath: 'test/photo.jpg', customerId: savedCustomer }
      else if (name === 'rk_checkout_begin') data = { status: 'pending', operationId }
      else if (name === 'rk_backend_customer') savedCustomer = args.p_customer
      else if (name === 'rk_checkout_finish') assert.equal(args.p_session, 'cs_test_member')
      else if (name === 'rk_event_record') data = 'pending'
      else if (name === 'rk_sync_claim') data = args.p_customer === savedCustomer ? memberId : null
      else if (name === 'rk_sync_apply') applied.push(args)
      else if (name !== 'rk_event_finish') assert.fail(`Unexpected RPC: ${name}`)
      return { data, error: null }
    },
  }
  let paid = false
  const stripe = {
    accounts: { retrieve: async () => ({ id: 'acct_test' }) },
    prices: { retrieve: async () => ({ ...subscription.items.data[0].price, livemode: false, active: true, recurring: { interval: 'month', interval_count: 1 } }) },
    customers: { create: async () => ({ id: 'cus_member', livemode: false }) },
    checkout: { sessions: {
      create: async params => {
        sessionCustomer = params.customer
        return { id: 'cs_test_member', url: 'https://checkout.stripe.com/test', livemode: false }
      },
      retrieve: async () => ({ customer: sessionCustomer }),
    } },
    subscriptions: { list: async ({ customer }) => ({ has_more: false, data: paid && customer === sessionCustomer ? [{ ...subscription, latest_invoice: 'in_test', created: 1 }] : [] }) },
    invoices: { retrieve: async () => ({ ...invoice, customer: sessionCustomer }) },
  }
  await checkout(db, stripe, env, memberId, operationId)
  assert.equal(savedCustomer, 'cus_member')
  assert.equal(sessionCustomer, savedCustomer)
  assert.deepEqual(applied, [])
  paid = true
  await processEvent(db, stripe, env, { id: 'evt_checkout_member', type: 'checkout.session.completed', livemode: false, created: 1, data: { object: { id: 'cs_test_member' } } })
  assert.equal(applied.length, 1)
  assert.equal(applied[0].p_member, memberId)
  assert.equal(applied[0].p_state, 'active')
})
test('RF-PAG: only paid current invoice grants benefits; failure overrides active and scheduled cancellation', () => {
  assert.equal(subscriptionSnapshot(subscription, invoice, 'price_test').state, 'active')
  const failed = subscriptionSnapshot(subscription, { ...invoice, status: 'open', amount_remaining: 6990 }, 'price_test')
  assert.equal(failed.state, 'past_due'); assert.equal(failed.paidThrough, null)
  assert.equal(subscriptionSnapshot({ ...subscription, status: 'incomplete' }, null, 'price_test').state, 'incomplete')
  assert.equal(subscriptionSnapshot(subscription, invoice, 'price_test').cancel, true)
  assert.throws(() => subscriptionSnapshot({ ...subscription, livemode: true }, invoice, 'price_test'))
  assert.throws(() => subscriptionSnapshot(subscription, invoice, 'price_other'))
})
test('RF-PAG: processed signed event replay does not fetch Stripe or repeat writes', async () => {
  const calls = []
  const db = { rpc: async (name) => { calls.push(name); return { data: 'processed', error: null } } }
  await processEvent(db, {}, {}, { id: 'evt_replayed', type: 'invoice.paid', livemode: false, created: 1, data: { object: { id: 'in_test' } } })
  assert.deepEqual(calls, ['rk_event_record'])
  await assert.rejects(() => processEvent(db, {}, {}, { livemode: true }))
})
test('RF-PAG: late invoice.paid cannot undo a newer unpaid invoice', async () => {
  let currentInvoice = invoice
  const states = []
  const statuses = new Map()
  const db = { rpc: async (name, args) => {
    if (name === 'rk_event_record') return { data: statuses.get(args.p_id) || 'pending', error: null }
    if (name === 'rk_sync_claim') return { data: '00000000-0000-4000-8000-000000000001', error: null }
    if (name === 'rk_sync_apply') states.push(args.p_state)
    if (name === 'rk_event_finish') statuses.set(args.p_id, args.p_error ? 'failed' : 'processed')
    return { data: null, error: null }
  } }
  const stripe = { invoices: { retrieve: async id => id === 'in_old' ? { ...invoice, id, customer: 'cus_test' } : { ...currentInvoice, customer: 'cus_test' } }, subscriptions: { list: async () => ({ has_more: false, data: [{ ...subscription, created: 1, latest_invoice: 'in_current' }] }) } }
  const event = (id, type) => ({ id, type, livemode: false, created: 1, data: { object: { id: 'in_old' } } })
  await processEvent(db, stripe, { STRIPE_PRICE_ID: 'price_test' }, event('evt_first', 'invoice.paid'))
  currentInvoice = { ...invoice, status: 'open', amount_remaining: 6990 }
  await processEvent(db, stripe, { STRIPE_PRICE_ID: 'price_test' }, event('evt_failure', 'invoice.payment_failed'))
  await processEvent(db, stripe, { STRIPE_PRICE_ID: 'price_test' }, event('evt_old_paid', 'invoice.paid'))
  assert.deepEqual(states, ['active', 'past_due', 'past_due'])
})
