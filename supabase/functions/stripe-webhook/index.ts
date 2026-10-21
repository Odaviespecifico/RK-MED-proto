import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { processEvent, sandboxStripe } from '../_shared/billing.ts'
import { boundedBody, response } from '../_shared/http.ts'
const env = Deno.env.toObject()
Deno.serve(async request => {
  if (request.method !== 'POST' || !['local', 'sandbox'].includes(env.APP_ENV || '') || !env.STRIPE_WEBHOOK_SECRET) return response({ error: 'Indisponível' }, 503)
  let event: Stripe.Event
  try {
    const verifier = new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2026-09-30.endive' })
    event = await verifier.webhooks.constructEventAsync(await boundedBody(request, 1024 * 1024), request.headers.get('stripe-signature') || '', env.STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider())
    if (event.livemode) throw new Error('Live event rejected')
  } catch { return response({ error: 'Assinatura inválida' }, 400) }
  try {
    const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    await processEvent(db, await sandboxStripe(env), env, event)
    return response({ received: true })
  } catch { return response({ error: 'Processamento pendente' }, 503) }
})
