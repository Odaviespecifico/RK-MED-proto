import { createClient } from '@supabase/supabase-js'
import { processEvent, reconcile, sandboxStripe, trustedRpc } from '../_shared/billing.ts'
import type { BackendMember } from '../_shared/billing.ts'
import { createResendSandbox } from '../_shared/providers/resend.ts'
import { response } from '../_shared/http.ts'
const env = Deno.env.toObject()
Deno.serve(async request => {
  if (request.method !== 'POST' || !['local', 'sandbox'].includes(env.APP_ENV || '') || !env.JOBS_SECRET || env.JOBS_SECRET.length < 32 || request.headers.get('authorization') !== `Bearer ${env.JOBS_SECRET}`) return response({ error: 'Acesso negado' }, 403)
  try {
    const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const stripe = await sandboxStripe(env)
    const pending = await trustedRpc<{ customers: string[]; events: { id: string }[]; messages: { id: string; memberId: string; key: string; kind: string; reference: string | null }[] }>(db, 'rk_backend_pending')
    let failures = 0
    for (const event of pending.events.slice(0, 100)) { try { await processEvent(db, stripe, env, await stripe.events.retrieve(event.id)) } catch { failures++ } }
    for (const customer of pending.customers) { try { await reconcile(db, stripe, customer, env.STRIPE_PRICE_ID!) } catch { failures++ } }
    for (const item of pending.messages.slice(0, 100)) {
      const owner = crypto.randomUUID()
      if (!await trustedRpc<boolean>(db, 'rk_backend_claim_delivery', { p_id: item.id, p_owner: owner })) continue
      let success = false
      try {
        const info = await trustedRpc<BackendMember | null>(db, 'rk_backend_member', { p_member: item.memberId })
        if (!info) throw new Error('Missing member')
        let text = `A situação da sua assinatura RKMED foi atualizada. Acesse ${env.APP_ORIGIN}/app/cobranca para consultar pagamento e benefícios.`
        let to = info.email
        if (item.kind.startsWith('risk.')) { to = env.OPERATIONS_TEST_EMAIL || ''; text = `Revisão operacional necessária para o cadastro ${info.id}. Consulte a fila interna do ambiente de testes.` }
        if (item.kind === 'collection.link') {
          if (!item.reference) throw new Error('Missing invoice')
          const invoice = await stripe.invoices.retrieve(item.reference)
          const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
          if (customer !== info.customerId || invoice.livemode) throw new Error('Invoice scope')
          if (invoice.status === 'paid' || invoice.status === 'void') success = true
          else { if (!invoice.hosted_invoice_url || invoice.status !== 'open') throw new Error('Invoice unavailable'); text = `Consulte sua fatura RKMED e atualize seu pagamento: ${invoice.hosted_invoice_url}` }
        }
        if (!success) await createResendSandbox(env).send(to, item.kind.startsWith('risk.') ? 'RKMED — revisão operacional' : 'RKMED — sua assinatura', text, `outbox/${item.id}`)
        success = true
      } catch { failures++ }
      await trustedRpc(db, 'rk_backend_complete_delivery', { p_id: item.id, p_owner: owner, p_success: success })
    }
    return response({ completed: true, failures })
  } catch { return response({ error: 'Integrações não configuradas ou processamento pendente' }, 503) }
})
