import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { trustedRpc } from './backend-rpc.ts'
import { PublicError } from './http.ts'

type Share = { invoice_id: string; customer_id: string; subscription_id: string; amount_cents: number;
  status: 'pending' | 'sending' | 'sent' | 'skipped' | 'review'; destination: string | null; charge_id: string | null; use_source: boolean | null }
const id = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id

// Called only for verified invoice.paid events or durable pending ledger entries.
// Refunds, disputes and chargebacks deliberately never reverse these transfers (D27).
export async function sendWedeaShare(db: SupabaseClient, stripe: Stripe, env: Record<string, string | undefined>, invoiceId: string) {
  const share = await trustedRpc<Share | null>(db, 'rk_wedea_get', { p_invoice: invoiceId })
  if (!share || share.status === 'sent' || share.status === 'skipped') return
  if (share.status === 'review') throw new PublicError('Repasse Wedea exige conciliação operacional.')
  const destination = share.destination || env.STRIPE_WEDEA_ACCOUNT_ID
  if (!destination || !/^acct_[A-Za-z0-9]+$/.test(destination) || destination === env.STRIPE_TEST_ACCOUNT_ID) {
    throw new PublicError('Configure a conta conectada Wedea no sandbox.')
  }
  const account = await stripe.v2.core.accounts.retrieve(destination, { include: ['configuration.recipient', 'defaults'] })
  if (account.livemode || account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status !== 'active'
    || account.defaults?.responsibilities?.fees_collector !== 'application'
    || account.defaults?.responsibilities?.losses_collector !== 'application') throw new PublicError('Conta Wedea indisponível para repasses no sandbox.')

  let chargeId = share.charge_id
  let useSource = share.use_source
  if (!chargeId) {
    const payments = await stripe.invoicePayments.list({ invoice: invoiceId, status: 'paid', limit: 100 })
    const payment = payments.data[0]
    if (payments.has_more || payments.data.length !== 1 || payment.livemode || payment.currency !== 'brl'
      || id(payment.invoice) !== invoiceId || !payment.amount_paid || payment.amount_paid <= 0) {
      throw new PublicError('Pagamento da mensalidade exige revisão antes do repasse.')
    }
    chargeId = id(payment.payment.charge) || null
    if (payment.payment.type === 'payment_intent') {
      const intentId = id(payment.payment.payment_intent)
      if (!intentId) throw new PublicError('Pagamento ainda não confirmado.')
      const intent = await stripe.paymentIntents.retrieve(intentId)
      if (intent.livemode || intent.status !== 'succeeded' || intent.currency !== 'brl' || id(intent.customer) !== share.customer_id) {
        throw new PublicError('Pagamento incompatível com o associado.')
      }
      chargeId = id(intent.latest_charge) || null
    }
    if (!chargeId) throw new PublicError('Pagamento sem cobrança Stripe confirmada para repasse.')
    const charge = await stripe.charges.retrieve(chargeId)
    if (charge.livemode || !charge.paid || charge.status !== 'succeeded' || charge.currency !== 'brl'
      || id(charge.customer) !== share.customer_id || charge.transfer || charge.transfer_data || charge.application_fee) {
      throw new PublicError('Cobrança incompatível com o repasse Wedea.')
    }
    // A deeply discounted invoice still owes the fixed share, funded by RKMed's balance.
    useSource = charge.amount >= share.amount_cents
  }
  const owner = crypto.randomUUID()
  const claimed = await trustedRpc<Share | null>(db, 'rk_wedea_claim', { p_invoice: invoiceId, p_owner: owner,
    p_destination: destination, p_charge: chargeId, p_use_source: useSource })
  if (!claimed) throw new PublicError('Repasse Wedea em processamento ou aguardando conciliação.')
  // Durable first-attempt deadline prevents reusing an expired Stripe idempotency key.
  // A lost response retries the exact saved parameters, or stops for review after 23h.
  const transfer = await stripe.transfers.create({ amount: claimed.amount_cents, currency: 'brl',
    destination: claimed.destination!, ...(claimed.use_source ? { source_transaction: claimed.charge_id! } : {}),
    transfer_group: `rkmed:wedea:${invoiceId}`, metadata: { invoice_id: invoiceId, policy: 'wedea-v1' },
  }, { idempotencyKey: `rkmed:wedea:v1:${invoiceId}` })
  if (transfer.livemode || transfer.amount !== claimed.amount_cents || transfer.currency !== 'brl'
    || id(transfer.destination) !== claimed.destination) throw new PublicError('Resposta de repasse incompatível com o sandbox.')
  await trustedRpc(db, 'rk_wedea_complete', { p_invoice: invoiceId, p_owner: owner, p_transfer: transfer.id })
}
