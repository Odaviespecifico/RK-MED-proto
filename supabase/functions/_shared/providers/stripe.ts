import Stripe from 'stripe'

type Environment = Record<string, string | undefined>
export class StripeSandboxError extends Error {}

export const stripeLiveMode = (env: Environment) => env.APP_ENV === 'production'
export const stripeAccountId = (env: Environment) => stripeLiveMode(env) ? env.STRIPE_ACCOUNT_ID : env.STRIPE_TEST_ACCOUNT_ID
export function assertStripeMode(value: { livemode?: boolean }, live: boolean) {
  if (value.livemode !== live) throw new StripeSandboxError('Objeto Stripe pertence a outro ambiente.')
}

// Server-only transport. The gateway enforces authorization, verified contacts,
// approved consents and durable idempotency before opening Checkout.
export function createStripeProvider(env: Environment, transport?: Pick<Stripe, 'accounts' | 'prices' | 'checkout'>) {
  const live = stripeLiveMode(env)
  const keyPattern = live ? /^(rk_live_|sk_live_)[A-Za-z0-9]+$/ : /^(rk_test_|sk_test_|rkcs_test_)[A-Za-z0-9]+$/
  const accountId = stripeAccountId(env)
  if (!['local', 'sandbox', 'production'].includes(env.APP_ENV || '') || !keyPattern.test(env.STRIPE_SECRET_KEY || '')
    || !/^acct_[A-Za-z0-9]+$/.test(accountId || '') || !/^price_[A-Za-z0-9]+$/.test(env.STRIPE_PRICE_ID || '')) {
    throw new StripeSandboxError('Configure credenciais, conta e preço Stripe do ambiente correto.')
  }
  let origin: URL
  try { origin = new URL(env.APP_ORIGIN || '') } catch { throw new StripeSandboxError('Origem do ambiente inválida.') }
  const local = origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname)
  if (!(env.APP_ENV === 'local' ? local : origin.protocol === 'https:') || origin.username || origin.password
    || origin.pathname !== '/' || origin.search || origin.hash) throw new StripeSandboxError('Origem de retorno inválida.')
  const client = transport ?? new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2026-09-30.endive', maxNetworkRetries: 2, timeout: 20_000 })
  return {
    async createCheckout(customerId: string, operationId: string): Promise<{ url: string; sessionId: string; livemode: boolean }> {
      if (!/^cus_[A-Za-z0-9]+$/.test(customerId) || !/^[0-9a-f-]{36}$/i.test(operationId)) throw new StripeSandboxError('Operação inválida.')
      const account = await client.accounts.retrieve(null)
      if (account.id !== accountId) throw new StripeSandboxError('A conta Stripe não corresponde ao ambiente configurado.')
      const price = await client.prices.retrieve(env.STRIPE_PRICE_ID!)
      if (price.livemode !== live || !price.active || price.currency !== 'brl' || price.unit_amount !== 6990
        || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) throw new StripeSandboxError('Preço Stripe incompatível.')
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
        success_url: `${origin.origin}/app/cobranca?checkout=processing`, cancel_url: `${origin.origin}/app/cobranca?checkout=canceled`,
      }, { idempotencyKey: `${accountId}:${operationId}` })
      if (session.livemode !== live || !session.url) throw new StripeSandboxError('Resposta de Checkout incompatível com o ambiente.')
      return { url: session.url, sessionId: session.id, livemode: live }
    },
  }
}

// Legacy test callers stay incapable of opening a live Checkout.
export function createStripeSandbox(env: Environment, transport?: Pick<Stripe, 'accounts' | 'prices' | 'checkout'>) {
  if (stripeLiveMode(env)) throw new StripeSandboxError('Use o adaptador comercial explícito para produção.')
  return createStripeProvider(env, transport)
}
