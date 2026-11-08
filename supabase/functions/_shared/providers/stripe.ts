import Stripe from 'stripe'

type Environment = Record<string, string | undefined>
export class StripeSandboxError extends Error {}

// Server-only transport. Authorization, dual contact/consent gates and durable idempotency
// must be enforced by the future Edge Function before calling createCheckout.
export function createStripeSandbox(env: Environment, transport?: Pick<Stripe, 'accounts' | 'prices' | 'checkout'>) {
  if (!['local', 'sandbox'].includes(env.APP_ENV || '') || !/^(rk_test_|sk_test_|rkcs_test_)[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY || '')
    || !/^acct_[A-Za-z0-9]+$/.test(env.STRIPE_TEST_ACCOUNT_ID || '') || !/^price_[A-Za-z0-9]+$/.test(env.STRIPE_PRICE_ID || '')) {
    throw new StripeSandboxError('Configure somente credenciais, conta e preço do sandbox Stripe.')
  }
  let origin: URL
  try { origin = new URL(env.APP_ORIGIN || '') } catch { throw new StripeSandboxError('Origem do ambiente inválida.') }
  const local = origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname)
  if (!(env.APP_ENV === 'local' ? local : origin.protocol === 'https:') || origin.username || origin.password
    || origin.pathname !== '/' || origin.search || origin.hash) throw new StripeSandboxError('Origem de retorno inválida.')
  const client = transport ?? new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2026-09-30.endive', maxNetworkRetries: 2, timeout: 20_000 })
  return {
    async createCheckout(customerId: string, operationId: string): Promise<{ url: string; sessionId: string; livemode: false }> {
      if (!/^cus_[A-Za-z0-9]+$/.test(customerId) || !/^[0-9a-f-]{36}$/i.test(operationId)) throw new StripeSandboxError('Operação de teste inválida.')
      const account = await client.accounts.retrieve(null)
      if (account.id !== env.STRIPE_TEST_ACCOUNT_ID) throw new StripeSandboxError('A conta não corresponde ao sandbox configurado.')
      const price = await client.prices.retrieve(env.STRIPE_PRICE_ID!)
      if (price.livemode !== false || !price.active || price.currency !== 'brl' || price.unit_amount !== 6960
        || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) throw new StripeSandboxError('Preço de sandbox incompatível.')
      const session = await client.checkout.sessions.create({
        mode: 'subscription', customer: customerId, line_items: [{ price: price.id, quantity: 1 }],
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
        success_url: `${origin.origin}/app/cobranca?checkout=processing`, cancel_url: `${origin.origin}/app/cobranca`,
      }, { idempotencyKey: `${env.STRIPE_TEST_ACCOUNT_ID}:${operationId}` })
      if (session.livemode !== false || !session.url) throw new StripeSandboxError('Resposta de Checkout incompatível com testes.')
      return { url: session.url, sessionId: session.id, livemode: false }
    },
  }
}
