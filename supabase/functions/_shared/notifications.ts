import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { trustedRpc } from './backend-rpc.ts'
import type { BackendMember, Environment } from './billing.ts'
import { createResendSandbox } from './providers/resend.ts'

export type QueuedNotification = { id: string; memberId: string; key: string; kind: string; reference: string | null }
type Send = (to: string, subject: string, text: string, operation: string) => Promise<{ messageId: string }>

// Delivery is independent of billing availability. Claimed immutable replies retain
// the same provider idempotency key on every automatic/manual retry.
export async function deliverNotifications(db: SupabaseClient, env: Environment, messages: QueuedNotification[], getStripe: () => Promise<Stripe>, send: Send = createResendSandbox(env).send) {
  let failures = 0
  for (const item of messages.slice(0, 100)) {
    const owner = crypto.randomUUID()
    if (!await trustedRpc<boolean>(db, 'rk_backend_claim_delivery', { p_id: item.id, p_owner: owner })) continue
    let success = false
    let provider: string | null = null
    try {
      let text: string
      let to: string
      let subject: string
      if (item.kind === 'support.answer') {
        if (!item.reference) throw new Error('Missing support reference')
        const reply = await trustedRpc<{ email: string; response: string } | null>(db, 'rk_backend_support_reply', { p_request: item.reference, p_member: item.memberId })
        if (!reply?.email || !reply.response) throw new Error('Support response unavailable')
        to = reply.email; subject = 'RKMED — resposta do suporte'
        text = `A equipe RKMED respondeu sua solicitação:\n\n${reply.response}\n\nConsulte seu histórico de atendimento: ${env.APP_ORIGIN}/app/conta`
      } else {
        const info = await trustedRpc<BackendMember | null>(db, 'rk_backend_member', { p_member: item.memberId })
        if (!info) throw new Error('Missing member')
        to = info.email; subject = 'RKMED — sua assinatura'
        text = `A situação da sua assinatura RKMED foi atualizada. Acesse ${env.APP_ORIGIN}/app/cobranca para consultar pagamento e benefícios.`
        if (item.kind.startsWith('risk.')) {
          to = env.OPERATIONS_TEST_EMAIL || ''; subject = 'RKMED — revisão operacional'
          text = `Revisão operacional necessária para o cadastro ${info.id}. Consulte a fila interna do ambiente de testes.`
        }
        if (item.kind === 'collection.link') {
          if (!item.reference) throw new Error('Missing invoice')
          const stripe = await getStripe()
          const invoice = await stripe.invoices.retrieve(item.reference)
          const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
          if (customer !== info.customerId || invoice.livemode) throw new Error('Invoice scope')
          if (invoice.status === 'paid' || invoice.status === 'void') success = true
          else {
            if (!invoice.hosted_invoice_url || invoice.status !== 'open') throw new Error('Invoice unavailable')
            text = `Consulte sua fatura RKMED e atualize seu pagamento: ${invoice.hosted_invoice_url}`
          }
        }
      }
      if (!success) provider = (await send(to, subject, text, `outbox/${item.id}`)).messageId
      success = true
    } catch { failures++ }
    await trustedRpc(db, 'rk_backend_complete_delivery', { p_id: item.id, p_owner: owner, p_success: success, p_provider: provider })
  }
  return failures
}
