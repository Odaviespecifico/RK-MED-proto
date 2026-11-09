import { randomUUID } from 'node:crypto';
import { AMOUNT, assertTestObject, SandboxError } from './config.mjs';

function assertPrice(price) {
  assertTestObject(price);
  if (!price.active || price.currency !== 'brl' || price.unit_amount !== AMOUNT
    || price.type !== 'recurring' || price.recurring?.interval !== 'month'
    || price.recurring.interval_count !== 1) {
    throw new SandboxError('O preço de teste existente diverge de R$ 69,90/BRL/mês. Revise o catálogo no sandbox.');
  }
  return price;
}

export async function ensureCatalog(stripe, config) {
  const productId = `rkmed_gold_test_${config.environment}`;
  let product;
  try { product = await stripe.products.retrieve(productId); }
  catch (error) {
    if (error.statusCode !== 404) throw error;
    product = await stripe.products.create({
      id: productId, name: 'RKMED Linha Gold — TESTE',
      metadata: { rkmed_environment: config.environment, rkmed_fixture: 'catalog-v1' },
    }, { idempotencyKey: `${config.accountId}:${productId}:v1` });
  }
  assertTestObject(product);
  if (!product.active || product.metadata?.rkmed_environment !== config.environment
    || product.metadata?.rkmed_fixture !== 'catalog-v1') {
    throw new SandboxError('Produto de teste existente não pertence a este catálogo/ambiente.');
  }
  const lookupKey = `${productId}_brl_6990_month_v1`;
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 2 });
  if (found.data.length > 1) throw new SandboxError('Mais de um preço encontrado para o catálogo de testes.');
  const price = found.data[0] || await stripe.prices.create({
    product: product.id, currency: 'brl', unit_amount: AMOUNT,
    recurring: { interval: 'month' }, lookup_key: lookupKey,
    metadata: { rkmed_environment: config.environment },
  }, { idempotencyKey: `${config.accountId}:${lookupKey}` });
  assertPrice(price);
  if ((typeof price.product === 'string' ? price.product : price.product.id) !== product.id) {
    throw new SandboxError('O preço encontrado pertence a outro produto.');
  }
  return { product, price };
}

function metadata(config, runId) {
  return { rkmed_environment: config.environment, rkmed_fixture: 'synthetic-only', rkmed_run: runId };
}

export async function createCheckout(stripe, config) {
  const { price } = await ensureCatalog(stripe, config);
  const runId = randomUUID();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription', line_items: [{ price: price.id, quantity: 1 }],
    ui_mode: 'hosted_page',
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: true },
    automatic_tax: { enabled: false },
    allow_promotion_codes: true,
    payment_method_collection: 'always',
    submit_type: 'auto',
    name_collection: { individual: { enabled: true } },
    saved_payment_method_options: { payment_method_save: 'enabled' },
    integration_identifier: 'hosted_mobile_app_0001',
    origin_context: 'mobile_app',
    success_url: `${config.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.origin}/cancel`,
  }, { idempotencyKey: `${config.accountId}:checkout:${runId}` });
  return assertTestObject(session);
}

// Separate synthetic draft for exercising Invoicing, never a member debt or a partner purchase.
export async function createDraftInvoice(stripe, config) {
  const runId = randomUUID();
  const data = metadata(config, runId);
  const request = step => ({ idempotencyKey: `${config.accountId}:invoice:${runId}:${step}` });
  const customer = assertTestObject(await stripe.customers.create({
    name: 'RKMED TESTE — cliente fictício de Invoicing', metadata: data,
  }, request('customer')));
  const invoice = assertTestObject(await stripe.invoices.create({
    customer: customer.id, currency: 'brl', collection_method: 'send_invoice',
    days_until_due: 3, auto_advance: false, pending_invoice_items_behavior: 'exclude', metadata: data,
    description: 'Rascunho sintético isolado — não representa dívida de associado',
  }, request('draft')));
  assertTestObject(await stripe.invoiceItems.create({
    customer: customer.id, invoice: invoice.id, currency: 'brl', amount: AMOUNT,
    description: 'Item de teste RKMED — R$ 69,90', metadata: data,
  }, request('item')));
  return assertTestObject(await stripe.invoices.retrieve(invoice.id));
}
