import { stripeLiveMode } from '../_shared/providers/stripe.ts'
import { runtimeEnvironment, assertDatabaseEnvironment } from '../_shared/environment.ts'
import { createClient } from '@supabase/supabase-js'
import { processEvent, reconcile, stripeClient, trustedRpc } from '../_shared/billing.ts'
import { deliverNotifications } from '../_shared/notifications.ts'
import type { QueuedNotification } from '../_shared/notifications.ts'
import { response } from '../_shared/http.ts'
import { sendWedeaShare } from '../_shared/wedea.ts'
const env = Deno.env.toObject()
Deno.serve(async request => {
  if (request.method !== 'POST' || !['local', 'sandbox', 'production'].includes(env.APP_ENV || '') || !env.JOBS_SECRET || env.JOBS_SECRET.length < 32 || request.headers.get('authorization') !== `Bearer ${env.JOBS_SECRET}`) return response({ error: 'Acesso negado' }, 403)
  try {
    runtimeEnvironment(env)
    const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    await assertDatabaseEnvironment(db, env)
    const pending = await trustedRpc<{ customers: string[]; events: { id: string }[]; messages: QueuedNotification[] }>(db, 'rk_backend_pending')
    let stripePromise: ReturnType<typeof stripeClient> | undefined
    const getStripe = () => stripePromise ??= stripeClient(env)
    let failures = await deliverNotifications(db, env, pending.messages, getStripe)
    try {
      const stripe = await getStripe()
      for (const event of pending.events.slice(0, 100)) { try { await processEvent(db, stripe, env, await stripe.events.retrieve(event.id)) } catch { failures++ } }
      for (const customer of pending.customers) { try { await reconcile(db, stripe, customer, env.STRIPE_PRICE_ID!, undefined, stripeLiveMode(env)) } catch { failures++ } }
      const shares = await trustedRpc<string[]>(db, 'rk_wedea_pending')
      for (const invoiceId of shares) { try { await sendWedeaShare(db, stripe, env, invoiceId) } catch { failures++ } }
    } catch { failures++ }
    return response({ completed: true, failures })
  } catch { return response({ error: 'Integrações não configuradas ou processamento pendente' }, 503) }
})
