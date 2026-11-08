import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import Stripe from 'stripe';
import { readConfig, verifyAccount, assertTestObject, AMOUNT } from '../../scripts/stripe/config.mjs';
import { ensureCatalog, createCheckout, createDraftInvoice } from '../../scripts/stripe/fixtures.mjs';
import { receiveEvent, webhookServer } from '../../scripts/stripe/webhook.mjs';

const stripe = new Stripe('offline-test-helper');
const config = readConfig({ STRIPE_WEBHOOK_SECRET: 'whsec_syntheticTestOnly', STRIPE_TEST_ACCOUNT_ID: 'acct_fixture' });
const price = { id: 'price_fixture', product: 'rkmed_gold_test_local', livemode: false, active: true,
  currency: 'brl', unit_amount: AMOUNT, type: 'recurring', recurring: { interval: 'month', interval_count: 1 } };
const product = { id: price.product, active: true, livemode: false,
  metadata: { rkmed_environment: 'local', rkmed_fixture: 'catalog-v1' } };

function catalogClient(overrides = {}) {
  return { products: { retrieve: async () => product },
    prices: { list: async () => ({ data: [price] }) }, ...overrides };
}
function payload(overrides = {}) {
  return JSON.stringify({ id: 'evt_fixture', object: 'event', type: 'invoice.paid',
    created: Math.floor(Date.now() / 1000), livemode: false,
    data: { object: { id: 'in_fixture', customer_email: 'must-not-be-stored@example.invalid',
      metadata: { cpf: 'must-not-be-stored' } } }, ...overrides });
}
function signature(body, options = {}) {
  return stripe.webhooks.generateTestHeaderString({ payload: body, secret: config.webhookSecret, ...options });
}
function directory(t) {
  const path = mkdtempSync(join(tmpdir(), 'rkmed-stripe-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

test('RF-PAG: rejects live, publishable and malformed keys without reflecting secrets', () => {
  for (const key of ['sk_live_sensitive', 'rk_live_sensitive', 'pk_test_sensitive', 'invalid']) {
    assert.throws(() => readConfig({ STRIPE_SECRET_KEY: key }), error => !error.message.includes(key));
  }
  for (const key of ['rk_test_synthetic', 'sk_test_synthetic', 'rkcs_test_synthetic']) {
    assert.equal(readConfig({ STRIPE_SECRET_KEY: key }).key, key);
  }
});

test('RF-PAG: refuses production, external return URLs and missing account binding', () => {
  assert.throws(() => readConfig({ STRIPE_TEST_ENV: 'production' }));
  for (const origin of ['https://example.com', 'http://localhost.evil.test', 'http://127.0.0.1/path', 'http://user@localhost']) {
    assert.throws(() => readConfig({ STRIPE_TEST_ORIGIN: origin }));
  }
  assert.throws(() => readConfig({ STRIPE_SECRET_KEY: 'rk_test_synthetic' }, { requireKey: true }));
  assert.throws(() => readConfig({}, { requireWebhook: true }));
});

test('RF-PAG: verifies expected sandbox account before mutations', async () => {
  await assert.rejects(() => verifyAccount({ accounts: { retrieve: async () => ({ id: 'acct_other' }) } }, config));
  await verifyAccount({ accounts: { retrieve: async () => ({ id: config.accountId }) } }, config);
  assert.throws(() => assertTestObject({ livemode: true }));
  assert.throws(() => assertTestObject({}));
});

test('RF-PAG: reuses existing catalog without creating another product or price', async () => {
  const result = await ensureCatalog(catalogClient(), config);
  assert.equal(result.price.id, 'price_fixture');
});

test('RF-PAG: rejects wrong amount, currency, period, inactive/live and unrelated products', async () => {
  for (const change of [{ unit_amount: 6990 }, { currency: 'usd' }, { active: false }, { livemode: true },
    { recurring: { interval: 'year', interval_count: 1 } }, { recurring: { interval: 'month', interval_count: 2 } },
    { product: 'prod_other' }]) {
    const client = catalogClient({ prices: { list: async () => ({ data: [{ ...price, ...change }] }) } });
    await assert.rejects(() => ensureCatalog(client, config));
  }
});

test('RF-PAG: creates missing catalog with stable idempotency keys', async () => {
  const writes = [];
  const client = {
    products: { retrieve: async () => { throw Object.assign(new Error(), { statusCode: 404 }); },
      create: async (params, options) => { writes.push({ params, options }); return product; } },
    prices: { list: async () => ({ data: [] }),
      create: async (params, options) => { writes.push({ params, options }); return price; } },
  };
  await ensureCatalog(client, config);
  await ensureCatalog(client, config);
  assert.equal(writes[0].options.idempotencyKey, writes[2].options.idempotencyKey);
  assert.equal(writes[1].options.idempotencyKey, writes[3].options.idempotencyKey);
  assert.equal(writes[1].params.unit_amount, 6960);
});

test('RF-PAG: Checkout uses server-selected recurring price and Checkout Studio settings', async () => {
  let captured;
  await createCheckout(catalogClient({ checkout: { sessions: {
    create: async (params, options) => { captured = { params, options }; return { id: 'cs_test_fixture', livemode: false }; },
  } } }), config);
  assert.equal(captured.params.mode, 'subscription');
  assert.deepEqual(captured.params.line_items, [{ price: 'price_fixture', quantity: 1 }]);
  assert.equal('payment_method_types' in captured.params, false);
  assert.deepEqual(captured.params.automatic_tax, { enabled: false });
  assert.equal(captured.params.ui_mode, 'hosted_page');
  assert.equal(captured.params.billing_address_collection, 'auto');
  assert.deepEqual(captured.params.phone_number_collection, { enabled: true });
  assert.equal(captured.params.allow_promotion_codes, true);
  assert.equal(captured.params.payment_method_collection, 'always');
  assert.equal(captured.params.submit_type, 'auto');
  assert.deepEqual(captured.params.name_collection, { individual: { enabled: true } });
  assert.deepEqual(captured.params.saved_payment_method_options, { payment_method_save: 'enabled' });
  assert.equal(captured.params.integration_identifier, 'hosted_mobile_app_0001');
  assert.equal(captured.params.origin_context, 'mobile_app');
  assert.match(captured.params.success_url, /^http:\/\/127\.0\.0\.1:4242\/success/);
  assert.match(captured.options.idempotencyKey, /^acct_fixture:checkout:/);
});

test('RF-PAG: Invoicing creates only a separate synthetic draft; no send, finalize or pay', async () => {
  const calls = [];
  const object = id => ({ id, livemode: false });
  await createDraftInvoice({
    customers: { create: async (params) => { calls.push(['customer', params]); return object('cus_fixture'); } },
    invoices: {
      create: async (params) => { calls.push(['draft', params]); return { ...object('in_fixture'), status: 'draft' }; },
      retrieve: async () => ({ ...object('in_fixture'), status: 'draft', total: 6960 }),
    },
    invoiceItems: { create: async (params) => { calls.push(['item', params]); return object('ii_fixture'); } },
  }, config);
  assert.equal(calls[1][1].auto_advance, false);
  assert.equal(calls[1][1].pending_invoice_items_behavior, 'exclude');
  assert.equal(calls[2][1].invoice, 'in_fixture');
  assert.equal(calls[2][1].amount, 6960);
  assert.equal('email' in calls[0][1], false);
});

test('RF-PAG: webhook persists minimal receipt and deduplicates across restarts', t => {
  const dir = directory(t);
  const body = payload();
  assert.equal(receiveEvent(stripe, config, body, signature(body), dir).result, 'recorded');
  assert.equal(receiveEvent(new Stripe('another-offline-helper'), config, body, signature(body), dir).result, 'duplicate');
  assert.equal(readdirSync(dir).length, 1);
  const saved = readFileSync(join(dir, 'evt_fixture.json'), 'utf8');
  assert.equal(saved.includes('must-not-be-stored'), false);
  assert.deepEqual(Object.keys(JSON.parse(saved)).sort(), ['id', 'type', 'created', 'livemode', 'environment', 'objectId'].sort());
});

test('RF-PAG: webhook rejects tampered, expired, wrong-secret and live payloads', t => {
  const dir = directory(t);
  const body = payload();
  assert.equal(receiveEvent(stripe, config, body + ' ', signature(body), dir).status, 400);
  assert.equal(receiveEvent(stripe, config, body, signature(body, { timestamp: 1 }), dir).status, 400);
  assert.equal(receiveEvent(stripe, config, body, signature(body, { secret: 'whsec_other' }), dir).status, 400);
  const live = payload({ livemode: true });
  assert.equal(receiveEvent(stripe, config, live, signature(live), dir).status, 400);
  assert.equal(readdirSync(dir).length, 0);
});

test('RF-PAG: ignores unrelated events and refuses path traversal IDs', t => {
  const dir = directory(t);
  for (const type of ['customer.updated', 'payment_intent.created']) {
    const body = payload({ type });
    assert.equal(receiveEvent(stripe, config, body, signature(body), dir).result, 'ignored');
  }
  const body = payload({ id: '../../outside' });
  assert.equal(receiveEvent(stripe, config, body, signature(body), dir).status, 400);
  assert.equal(readdirSync(dir).length, 0);
});

test('RF-PAG: out-of-order lifecycle receipts never infer eligibility from arrival order', t => {
  const dir = directory(t);
  for (const [id, type, created] of [['evt_newer', 'invoice.paid', 100], ['evt_older', 'invoice.payment_failed', 50]]) {
    const body = payload({ id, type, created });
    assert.equal(receiveEvent(stripe, config, body, signature(body), dir).result, 'recorded');
  }
  for (const file of readdirSync(dir)) assert.equal('eligible' in JSON.parse(readFileSync(join(dir, file))), false);
});

test('RF-PAG: HTTP receiver verifies raw body, rejects missing signatures, and return page cannot activate', async t => {
  const dir = directory(t);
  const server = webhookServer(config, dir);
  t.after(() => { server.closeAllConnections(); server.close(); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const result = await fetch(`${url}/success?session_id=cs_test_arbitrary`);
  assert.match((await result.json()).result, /Nenhum benefício/);
  assert.equal(readdirSync(dir).length, 0);
  assert.equal((await fetch(`${url}/webhook`, { method: 'POST', body: '{}' })).status, 400);
  const body = payload();
  const send = () => fetch(`${url}/webhook`, { method: 'POST', body, headers: { 'Stripe-Signature': signature(body) } });
  const responses = await Promise.all([send(), send()]);
  assert.deepEqual((await Promise.all(responses.map(r => r.json()))).map(r => r.result).sort(), ['duplicate', 'recorded']);
  const large = await fetch(`${url}/webhook`, { method: 'POST', body: 'x'.repeat(1024 * 1024 + 1), headers: { 'Stripe-Signature': 'invalid' } });
  assert.equal(large.status, 413);
});
