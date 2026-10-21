import test from 'node:test'
import assert from 'node:assert/strict'
import { subscriptionSnapshot, processEvent } from '../../supabase/functions/_shared/billing.ts'
const subscription = { id: 'sub_test', livemode: false, status: 'active', cancel_at_period_end: true, items: { data: [{ price: { id: 'price_test', currency: 'brl', unit_amount: 6960, recurring: { interval: 'month' } }, quantity: 1, current_period_end: 1900000000 }] } }
const invoice = { id: 'in_test', livemode: false, status: 'paid', attempted: true, amount_remaining: 0 }
test('RF-PAG: only paid current invoice grants benefits; failure overrides active and scheduled cancellation', () => {
  assert.equal(subscriptionSnapshot(subscription, invoice, 'price_test').state, 'active')
  const failed = subscriptionSnapshot(subscription, { ...invoice, status: 'open', amount_remaining: 6960 }, 'price_test')
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
  currentInvoice = { ...invoice, status: 'open', amount_remaining: 6960 }
  await processEvent(db, stripe, { STRIPE_PRICE_ID: 'price_test' }, event('evt_failure', 'invoice.payment_failed'))
  await processEvent(db, stripe, { STRIPE_PRICE_ID: 'price_test' }, event('evt_old_paid', 'invoice.paid'))
  assert.deepEqual(states, ['active', 'past_due', 'past_due'])
})
