import { createClient } from '@supabase/supabase-js'
import { checkout, reconcile, sandboxStripe, trustedRpc } from '../_shared/billing.ts'
import type { BackendMember } from '../_shared/billing.ts'
import { sanitizePhoto } from '../_shared/photo.ts'
import { StripeSandboxError } from '../_shared/providers/stripe.ts'
import { PublicError, boundedBody, response } from '../_shared/http.ts'

const env = Deno.env.toObject()
Deno.serve(async request => {
  const origin = env.APP_ORIGIN
  if (!origin || request.headers.get('origin') !== origin) return response({ error: 'Origem não permitida.' }, 403)
  if (request.method === 'OPTIONS') return response({}, 200, origin)
  if (request.method !== 'POST' || !['local', 'sandbox'].includes(env.APP_ENV || '')) return response({ error: 'Operação indisponível.' }, 405, origin)
  try {
    const authorization = request.headers.get('authorization') || ''
    if (!/^Bearer [^ ]+$/.test(authorization)) return response({ error: 'Entre novamente.' }, 401, origin)
    const client = createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await client.auth.getUser(authorization.slice(7))
    if (error || !data.user) return response({ error: 'Entre novamente.' }, 401, origin)
    const { data: context, error: denied } = await client.rpc('rk_context')
    if (denied || !context) return response({ error: 'Sessão expirada ou acesso negado.' }, 403, origin)
    const body = JSON.parse(await boundedBody(request, 7 * 1024 * 1024))
    if (!['checkout', 'portal', 'cancel', 'collection', 'staff', 'photo'].includes(body.action)) return response({ error: 'Ação não disponível.' }, 400, origin)
    const staff = ['admin', 'support'].includes(context.role)
    if ((['checkout', 'portal', 'cancel', 'photo'].includes(body.action) && context.role !== 'member') || (body.action === 'collection' && !staff) || (body.action === 'staff' && context.role !== 'admin')) return response({ error: 'Acesso negado.' }, 403, origin)
    const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    await trustedRpc(db, 'rk_backend_rate', { p_actor: data.user.id, p_action: body.action })
    if (body.action === 'photo') {
      if (typeof body.photo !== 'string' || !body.photo.startsWith('data:image/jpeg;base64,')) throw new PublicError('Foto inválida.')
      const raw = atob(body.photo.slice('data:image/jpeg;base64,'.length))
      const cleaned = await sanitizePhoto(Uint8Array.from(raw, c => c.charCodeAt(0)), path => Deno.readFile(path))
      const upload = await db.storage.from('member-photos').upload(`${data.user.id}/photo.jpg`, cleaned, { contentType: 'image/jpeg', upsert: true })
      if (upload.error) throw new PublicError('Não foi possível salvar a foto. Tente novamente.')
      await trustedRpc(db, 'rk_backend_photo', { p_member: data.user.id })
      return response({ saved: true }, 200, origin)
    }
    if (body.action === 'staff') {
      if (!['admin', 'support', 'viewer', 'partner'].includes(body.role) || typeof body.email !== 'string' || typeof body.password !== 'string' || body.password.length < 12) throw new PublicError('Dados de acesso inválidos. Use senha com pelo menos 12 caracteres.')
      const created = await db.auth.admin.createUser({ email: body.email.trim(), password: body.password, email_confirm: true })
      if (created.error || !created.data.user) throw new PublicError('Não foi possível criar o acesso. Verifique os dados.')
      try { await trustedRpc(db, 'rk_backend_role', { p_user: created.data.user.id, p_role: body.role, p_partner: body.role === 'partner' ? body.partnerId : null }) }
      catch (error) { await db.auth.admin.deleteUser(created.data.user.id); throw error }
      return response({ created: true }, 200, origin)
    }
    const operation = body.operationId
    if (typeof operation !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operation)) throw new PublicError('Operação inválida.')
    const stripe = await sandboxStripe(env)
    if (body.action === 'checkout') return response(await checkout(db, stripe, env, data.user.id, operation), 200, origin)
    const info = await trustedRpc<BackendMember | null>(db, 'rk_backend_member', { p_member: body.action === 'collection' ? body.memberId : data.user.id })
    if (!info?.customerId) throw new PublicError('Cobrança ainda não configurada para este cadastro.')
    if (body.action === 'portal') {
      if (!env.STRIPE_PORTAL_CONFIGURATION_ID) throw new PublicError('Configure o portal de pagamentos do sandbox.')
      const config = await stripe.billingPortal.configurations.retrieve(env.STRIPE_PORTAL_CONFIGURATION_ID)
      if (!config.active || config.livemode || (config.features.subscription_cancel.enabled && config.features.subscription_cancel.mode !== 'at_period_end') || config.features.subscription_update.enabled) throw new PublicError('Configuração do portal incompatível com este plano.')
      const session = await stripe.billingPortal.sessions.create({ customer: info.customerId, configuration: config.id, return_url: `${origin}/app/cobranca` }, { idempotencyKey: `rkmed:portal:${operation}` })
      return response({ url: session.url, livemode: false }, 200, origin)
    }
    if (body.action === 'cancel') {
      if (!info.subscriptionId) throw new PublicError('Assinatura não encontrada.')
      const subscription = await stripe.subscriptions.retrieve(info.subscriptionId)
      if (subscription.livemode || subscription.customer !== info.customerId) throw new PublicError('Assinatura inválida.')
      await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true }, { idempotencyKey: `rkmed:cancel:${operation}` })
      await reconcile(db, stripe, info.customerId, env.STRIPE_PRICE_ID!)
      return response({ canceledAtPeriodEnd: true }, 200, origin)
    }
    if (!['link', 'retry'].includes(body.collectionAction) || body.invoiceId !== info.invoiceId) throw new PublicError('Fatura não disponível. Atualize a lista.')
    const invoice = await stripe.invoices.retrieve(body.invoiceId)
    const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
    if (invoice.livemode || customer !== info.customerId || invoice.status !== 'open' || invoice.amount_remaining !== body.amount || invoice.currency !== 'brl') throw new PublicError('Fatura alterada, paga ou não disponível. Atualize os dados antes de cobrar.')
    if (body.collectionAction === 'retry') {
      const payments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 100 })
      if (payments.has_more) throw new PublicError('Revise o histórico da fatura antes de cobrar novamente.')
      for (const payment of payments.data) {
        const intent = payment.payment.payment_intent
        if (!intent || payment.status === 'canceled') continue
        const current = typeof intent === 'string' ? await stripe.paymentIntents.retrieve(intent) : intent
        if (current.livemode || !['requires_payment_method', 'canceled'].includes(current.status)) throw new PublicError('Pagamento em processamento ou aguardando ação do cliente. Atualize a fatura antes de tentar novamente.')
      }
    }
    const previous = await trustedRpc<{ status: string }>(db, 'rk_collection_begin', { p_operation: operation, p_member: info.id, p_actor: data.user.id, p_invoice: invoice.id, p_action: body.collectionAction })
    if (previous.status === 'succeeded') return response({ completed: true }, 200, origin)
    try {
      if (body.collectionAction === 'retry') {
        await stripe.invoices.pay(invoice.id, {}, { idempotencyKey: `rkmed:invoice:${invoice.id}:${operation}` })
        await reconcile(db, stripe, info.customerId, env.STRIPE_PRICE_ID!)
      } else {
        if (!invoice.hosted_invoice_url) throw new PublicError('Link da fatura indisponível.')
        await trustedRpc(db, 'rk_backend_collection_link', { p_member: info.id, p_invoice: invoice.id, p_operation: operation })
      }
      await trustedRpc(db, 'rk_collection_finish', { p_operation: operation, p_success: true })
      return response({ completed: true, ...(body.collectionAction === 'link' ? { queued: true } : {}) }, 200, origin)
    } catch (error) { await trustedRpc(db, 'rk_collection_finish', { p_operation: operation, p_success: false }); throw error }
  } catch (error) {
    // Deliberately omit raw provider errors, request bodies, CPF, tokens and credentials.
    const known = error instanceof PublicError || error instanceof StripeSandboxError ? error.message : 'Integração indisponível. Verifique o sandbox e tente novamente.'
    return response({ error: known }, 400, origin)
  }
})
