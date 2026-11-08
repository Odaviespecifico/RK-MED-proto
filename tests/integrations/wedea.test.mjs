import test from 'node:test'
import assert from 'node:assert/strict'
import { sendWedeaShare } from '../../supabase/functions/_shared/wedea.ts'
import { processEvent } from '../../supabase/functions/_shared/billing.ts'

function fixture(overrides = {}) {
  const share = { invoice_id: 'in_test', customer_id: 'cus_test', subscription_id: 'sub_test',
    amount_cents: 1587, status: 'pending', destination: null, charge_id: null, use_source: null, ...overrides }
  const calls = []
  let transferError = false
  const db = { rpc: async (name, args) => {
    calls.push({ name, args })
    let data = null
    if (name === 'rk_wedea_get') data = { ...share }
    else if (name === 'rk_wedea_claim') {
      if (!share.owner) {
        Object.assign(share, { status: 'sending', owner: args.p_owner, destination: args.p_destination,
          charge_id: args.p_charge, use_source: args.p_use_source })
        data = { ...share }
      }
    } else if (name === 'rk_wedea_complete') {
      assert.equal(args.p_owner, share.owner)
      Object.assign(share, { status: 'sent', transfer_id: args.p_transfer })
    } else assert.fail(name)
    return { data, error: null }
  } }
  const charge = { id: 'ch_test', paid: true, status: 'succeeded', amount: 6960, currency: 'brl', customer: 'cus_test', livemode: false }
  const stripe = {
    v2: { core: { accounts: { retrieve: async () => ({ livemode: false,
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: 'active' } } } } },
      defaults: { responsibilities: { fees_collector: 'application', losses_collector: 'application' } },
    }) } } },
    invoicePayments: { list: async () => ({ has_more: false, data: [{ invoice: 'in_test', amount_paid: 6960, currency: 'brl', livemode: false,
      payment: { type: 'payment_intent', payment_intent: 'pi_test' } }] }) },
    paymentIntents: { retrieve: async () => ({ livemode: false, status: 'succeeded', currency: 'brl', customer: 'cus_test', latest_charge: 'ch_test' }) },
    charges: { retrieve: async () => charge },
    transfers: { create: async (params, options) => {
      calls.push({ name: 'transfer', params, options })
      if (transferError) throw new Error('Response lost')
      return { id: 'tr_test', livemode: false, amount: params.amount, currency: params.currency, destination: params.destination }
    } },
  }
  const env = { STRIPE_WEDEA_ACCOUNT_ID: 'acct_wedea', STRIPE_TEST_ACCOUNT_ID: 'acct_rkmed' }
  return { share, db, stripe, env, calls, charge, loseResponse: () => { transferError = true }, restore: () => { transferError = false; share.owner = null } }
}

test('D27: fixed BRL transfer, immutable destination, invoice idempotency and completed replay', async () => {
  const f = fixture()
  await sendWedeaShare(f.db, f.stripe, f.env, 'in_test')
  const sent = f.calls.find(c => c.name === 'transfer')
  assert.deepEqual(sent.params, { amount: 1587, currency: 'brl', destination: 'acct_wedea', source_transaction: 'ch_test',
    transfer_group: 'rkmed:wedea:in_test', metadata: { invoice_id: 'in_test', policy: 'wedea-v1' } })
  assert.equal(sent.options.idempotencyKey, 'rkmed:wedea:v1:in_test')
  assert.equal(f.share.transfer_id, 'tr_test')
  await sendWedeaShare(f.db, f.stripe, { ...f.env, STRIPE_WEDEA_ACCOUNT_ID: 'acct_changed' }, 'in_test')
  assert.equal(f.calls.filter(c => c.name === 'transfer').length, 1)
})

test('D27: below-threshold, zero-invoice and manual-review decisions never send money', async () => {
  for (const status of ['skipped', 'review']) {
    const f = fixture({ status, amount_cents: status === 'skipped' ? 0 : 1587 })
    if (status === 'review') await assert.rejects(() => sendWedeaShare(f.db, f.stripe, f.env, 'in_test'))
    else await sendWedeaShare(f.db, f.stripe, f.env, 'in_test')
    assert.deepEqual(f.calls.map(c => c.name), ['rk_wedea_get'])
  }
})

test('D27: lost transfer response retries identical parameters and saved destination', async () => {
  const f = fixture()
  f.loseResponse()
  await assert.rejects(() => sendWedeaShare(f.db, f.stripe, f.env, 'in_test'))
  f.restore()
  await sendWedeaShare(f.db, f.stripe, { ...f.env, STRIPE_WEDEA_ACCOUNT_ID: 'acct_changed' }, 'in_test')
  const attempts = f.calls.filter(c => c.name === 'transfer')
  assert.equal(attempts.length, 2)
  assert.deepEqual(attempts[0], attempts[1])
})

test('D27: concurrent workers cannot both acquire a transfer lease', async () => {
  const f = fixture()
  const results = await Promise.allSettled([sendWedeaShare(f.db, f.stripe, f.env, 'in_test'), sendWedeaShare(f.db, f.stripe, f.env, 'in_test')])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(f.calls.filter(c => c.name === 'transfer').length, 1)
})

test('D27: missing recipient, wrong customer, live account and inactive capability reject transfers', async () => {
  for (const failure of ['missing', 'customer', 'live', 'inactive', 'already-split']) {
    const f = fixture()
    if (failure === 'missing') f.env.STRIPE_WEDEA_ACCOUNT_ID = ''
    if (failure === 'customer') f.charge.customer = 'cus_other'
    if (failure === 'live') f.stripe.v2.core.accounts.retrieve = async () => ({ livemode: true })
    if (failure === 'inactive') f.stripe.v2.core.accounts.retrieve = async () => ({ livemode: false })
    if (failure === 'already-split') f.charge.transfer_data = { destination: 'acct_other' }
    await assert.rejects(() => sendWedeaShare(f.db, f.stripe, f.env, 'in_test'))
    assert.equal(f.calls.some(c => c.name === 'transfer'), false)
  }
})

test('D27: discounted charge below the fixed share uses RKMed balance without reducing Wedea share', async () => {
  const f = fixture()
  f.charge.amount = 1000
  await sendWedeaShare(f.db, f.stripe, f.env, 'in_test')
  const sent = f.calls.find(c => c.name === 'transfer')
  assert.equal(sent.params.amount, 1587)
  assert.equal('source_transaction' in sent.params, false)
})

test('D27: refund and dispute events queue risk review without touching Wedea transfers', async () => {
  for (const type of ['charge.refunded', 'charge.dispute.created']) {
    const calls = []
    const db = { rpc: async name => { calls.push(name); return { data: name === 'rk_event_record' ? 'pending' : null, error: null } } }
    const stripe = { charges: { retrieve: async () => ({ customer: 'cus_test' }) } }
    await processEvent(db, stripe, {}, { id: 'evt_risk', type, livemode: false, created: 1,
      data: { object: { id: type === 'charge.refunded' ? 'ch_test' : 'dp_test', charge: 'ch_test' } } })
    assert.deepEqual(calls, ['rk_event_record', 'rk_backend_risk', 'rk_event_finish'])
  }
})

test('D27: paid renewal reconciles and reserves atomically before transfer; missing config cannot undo benefits', async () => {
  const f = fixture()
  const rpc = f.db.rpc
  const statuses = new Map()
  const syncs = []
  f.db.rpc = async (name, args) => {
    if (name === 'rk_event_record') return { data: statuses.get(args.p_id) || 'pending', error: null }
    if (name === 'rk_sync_claim') return { data: '00000000-0000-4000-8000-000000000001', error: null }
    if (name === 'rk_sync_apply_wedea') { syncs.push(args); return { data: null, error: null } }
    if (name === 'rk_event_finish') { statuses.set(args.p_id, args.p_error ? 'failed' : 'processed'); return { data: null, error: null } }
    return rpc(name, args)
  }
  const invoice = { id: 'in_test', customer: 'cus_test', status: 'paid', livemode: false, currency: 'brl', amount_paid: 6960,
    amount_remaining: 0, parent: { subscription_details: { subscription: 'sub_test' } } }
  f.stripe.invoices = { retrieve: async () => invoice }
  f.stripe.subscriptions = { list: async () => ({ has_more: false, data: [{ id: 'sub_test', customer: 'cus_test', livemode: false,
    status: 'active', created: 1, cancel_at_period_end: false, latest_invoice: 'in_test', items: { data: [{ quantity: 1,
      current_period_end: 1900000000, price: { id: 'price_test', currency: 'brl', unit_amount: 6960, recurring: { interval: 'month' } } }] } }] }) }
  const event = { id: 'evt_paid', type: 'invoice.paid', livemode: false, created: 1, data: { object: { id: 'in_test' } } }
  const env = { ...f.env, STRIPE_PRICE_ID: 'price_test', STRIPE_WEDEA_ACCOUNT_ID: '' }
  await assert.rejects(() => processEvent(f.db, f.stripe, env, event))
  assert.equal(syncs[0].p_sync.p_state, 'active')
  assert.equal(syncs[0].p_paid_invoice, 'in_test')
  assert.equal(syncs[0].p_paid_amount, 6960)
  assert.equal(statuses.get('evt_paid'), 'failed')
  await processEvent(f.db, f.stripe, { ...env, STRIPE_WEDEA_ACCOUNT_ID: 'acct_wedea' }, event)
  assert.equal(statuses.get('evt_paid'), 'processed')
  await processEvent(f.db, f.stripe, env, event)
  assert.equal(f.calls.filter(c => c.name === 'transfer').length, 1)
})
