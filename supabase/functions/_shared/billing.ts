import { PublicError } from './http.ts'
import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createStripeSandbox } from './providers/stripe.ts'
export type BackendMember = { id: string; name: string; email: string; phone: string; verified: boolean; consented: boolean; photoPath: string | null; customerId: string | null; subscriptionId: string | null; invoiceId: string | null; state: string; blocked: boolean }
export type Environment = Record<string, string | undefined>
export async function trustedRpc<T>(db: SupabaseClient, name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args)
  if (error) throw new PublicError(`Não foi possível concluir ${name.replace(/^rk_/, '')}.`)
  return data as T
}
export async function sandboxStripe(env: Environment) {
  createStripeSandbox(env) // Reject missing/live credentials before any network access.
  const stripe = new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2026-09-30.endive', maxNetworkRetries: 2, timeout: 20_000 })
  const account = await stripe.accounts.retrieve(null)
  if (account.id !== env.STRIPE_TEST_ACCOUNT_ID) throw new PublicError('Conta Stripe incompatível com o sandbox.')
  return stripe
}
export function subscriptionSnapshot(subscription: Stripe.Subscription, invoice: Stripe.Invoice | null, priceId: string) {
  const items = subscription.items.data
  if (subscription.livemode || items.length !== 1 || items[0].price.id !== priceId || items[0].quantity !== 1
    || items[0].price.currency !== 'brl' || items[0].price.unit_amount !== 6960 || items[0].price.recurring?.interval !== 'month') throw new PublicError('Assinatura incompatível com o catálogo de testes.')
  if (invoice?.livemode) throw new PublicError('Fatura incompatível com testes.')
  // An unpaid latest invoice overrides an otherwise active subscription immediately.
  const failed = invoice && invoice.status !== 'paid' && (invoice.attempted || subscription.status === 'past_due' || subscription.status === 'unpaid')
  const state = failed ? 'past_due' : subscription.status === 'active' && invoice?.status === 'paid' ? 'active'
    : ['canceled', 'incomplete_expired'].includes(subscription.status) ? 'canceled'
    : ['past_due', 'unpaid', 'paused'].includes(subscription.status) ? 'past_due' : 'incomplete'
  return { state, paidThrough: invoice?.status === 'paid' ? new Date(items[0].current_period_end * 1000).toISOString() : null,
    cancel: subscription.cancel_at_period_end, invoice: invoice?.id || null, amount: invoice?.amount_remaining ?? 6960 }
}
export async function reconcile(db: SupabaseClient, stripe: Stripe, customer: string, price: string) {
  const owner = crypto.randomUUID()
  const member = await trustedRpc<string | null>(db, 'rk_sync_claim', { p_customer: customer, p_owner: owner })
  if (!member) return
  // Claim BEFORE reading current provider state; concurrent/out-of-order events cannot apply stale snapshots.
  const list = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 })
  if (list.has_more) throw new PublicError('Revisão de assinaturas necessária.')
  const matching = list.data.filter(s => s.items.data.some(item => item.price.id === price)).sort((a, b) => b.created - a.created)
  if (matching.filter(s => !['canceled', 'incomplete_expired'].includes(s.status)).length > 1) throw new PublicError('Mais de uma assinatura encontrada. Revise o sandbox.')
  const subscription = matching.find(s => !['canceled', 'incomplete_expired'].includes(s.status)) || matching[0]
  if (!subscription) throw new PublicError('Assinatura ainda não disponível para sincronização.')
  const invoice = typeof subscription.latest_invoice === 'string' ? await stripe.invoices.retrieve(subscription.latest_invoice) : subscription.latest_invoice
  const snapshot = subscriptionSnapshot(subscription, invoice, price)
  await trustedRpc(db, 'rk_sync_apply', { p_member: member, p_owner: owner, p_subscription: subscription.id,
    p_state: snapshot.state, p_paid_through: snapshot.paidThrough, p_cancel: snapshot.cancel, p_invoice: snapshot.invoice, p_amount: snapshot.amount })
}
export async function checkout(db: SupabaseClient, stripe: Stripe, env: Environment, userId: string, operation: string) {
  const info = await trustedRpc<BackendMember | null>(db, 'rk_backend_member', { p_member: userId })
  if (!info || !info.verified || !info.consented || !info.photoPath) throw new PublicError('Conclua contatos, aceite e foto antes do pagamento.')
  // Require a real Storage object, not only a database path.
  const photo = await db.storage.from('member-photos').download(info.photoPath)
  if (photo.error || !photo.data.size) throw new PublicError('Envie sua foto antes do pagamento.')
  if (info.customerId) {
    const existing = await stripe.subscriptions.list({ customer: info.customerId, status: 'all', limit: 100 })
    if (existing.has_more || existing.data.some(s => !['canceled', 'incomplete_expired'].includes(s.status))) throw new PublicError('Já existe uma assinatura. Atualize seu pagamento em vez de criar outra.')
  }
  const pending = await trustedRpc<{ status: string; url?: string; sessionId?: string; operationId: string }>(db, 'rk_checkout_begin', { p_member: userId, p_operation: operation })
  if (pending.status === 'ready' && pending.url && pending.sessionId) {
    const previous = await stripe.checkout.sessions.retrieve(pending.sessionId)
    if (previous.livemode) throw new PublicError('Checkout fora do sandbox.')
    if (previous.status === 'expired') {
      await trustedRpc(db, 'rk_checkout_expired', { p_operation: pending.operationId })
      throw new PublicError('Checkout expirado. Tente novamente para iniciar uma nova operação.')
    }
    if (previous.status === 'complete') throw new PublicError('Pagamento em processamento. Aguarde a confirmação.')
    return { url: pending.url, livemode: false }
  }
  if (pending.status !== 'pending') throw new PublicError('Operação expirada. Atualize a página.')
  let customer = info.customerId
  if (!customer) {
    const created = await stripe.customers.create({ name: info.name, email: info.email, phone: info.phone.startsWith('+') ? info.phone : `+${info.phone}` }, { idempotencyKey: `rkmed:customer:${userId}` })
    if (created.livemode) throw new PublicError('Customer fora do sandbox.')
    customer = created.id
    await trustedRpc(db, 'rk_backend_customer', { p_member: userId, p_customer: customer })
  }
  const result = await createStripeSandbox(env, stripe).createCheckout(customer, pending.operationId)
  await trustedRpc(db, 'rk_checkout_finish', { p_operation: pending.operationId, p_session: result.sessionId, p_url: result.url })
  return result
}
export const lifecycleEvents = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed'])
export const riskEvents = new Set(['charge.dispute.created', 'charge.refunded', 'radar.early_fraud_warning.created'])
export async function processEvent(db: SupabaseClient, stripe: Stripe, env: Environment, event: Stripe.Event) {
  if (event.livemode) throw new PublicError('Evento de produção recusado.')
  if (!lifecycleEvents.has(event.type) && !riskEvents.has(event.type)) return
  if (!('id' in event.data.object)) throw new PublicError('Evento inválido.')
  const objectId = event.data.object.id
  const status = await trustedRpc<string>(db, 'rk_event_record', { p_id: event.id, p_type: event.type, p_object: objectId, p_created: event.created })
  if (status === 'processed') return
  try {
    let customer: string | null = null
    if (event.type.startsWith('customer.subscription.')) {
      const subscription = await stripe.subscriptions.retrieve(objectId)
      customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    } else if (event.type.startsWith('invoice.')) {
      const invoice = await stripe.invoices.retrieve(objectId)
      customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null
    } else if (event.type.startsWith('checkout.')) {
      const session = await stripe.checkout.sessions.retrieve(objectId)
      customer = typeof session.customer === 'string' ? session.customer : session.customer?.id || null
    } else {
      const chargeId = event.type === 'charge.refunded' ? objectId : (event.data.object as Stripe.Dispute | Stripe.Radar.EarlyFraudWarning).charge
      const charge = await stripe.charges.retrieve(typeof chargeId === 'string' ? chargeId : chargeId.id)
      customer = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id || null
      // Risk never silently grants or revokes entitlement: queue a deduplicated operational review.
      if (customer) await trustedRpc(db, 'rk_backend_risk', { p_customer: customer, p_event: event.id, p_kind: `risk.${event.type}` })
    }
    if (customer && !riskEvents.has(event.type)) await reconcile(db, stripe, customer, env.STRIPE_PRICE_ID!)
    await trustedRpc(db, 'rk_event_finish', { p_id: event.id })
  } catch (error) {
    await trustedRpc(db, 'rk_event_finish', { p_id: event.id, p_error: 'processing_failed' })
    throw error
  }
}
