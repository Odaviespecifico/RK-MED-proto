import { Webhook } from 'standardwebhooks'
import { createClient } from '@supabase/supabase-js'
import { createTwilioSandbox } from '../_shared/providers/twilio.ts'
import { trustedRpc } from '../_shared/billing.ts'
import { boundedBody, response } from '../_shared/http.ts'
const env = Deno.env.toObject()
Deno.serve(async request => {
  if (request.method !== 'POST' || !env.AUTH_SMS_HOOK_SECRET || !['local', 'sandbox'].includes(env.APP_ENV || '')) return response({ error: { http_code: 503, message: 'Entrega não configurada' } }, 503)
  try {
    const raw = await boundedBody(request, 16384)
    const payload = new Webhook(env.AUTH_SMS_HOOK_SECRET.replace(/^v1,whsec_/, '')).verify(raw, Object.fromEntries(request.headers)) as { user: { phone: string }; sms: { otp: string } }
    const to = `+${payload.user.phone.replace(/^\+/, '')}`
    const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const channel = await trustedRpc<string>(db, 'rk_phone_claim', { p_phone: to })
    const twilio = createTwilioSandbox(env)
    if (channel === 'sms') await twilio.sendSmsCode(to, payload.sms.otp)
    else await twilio.sendWhatsAppCode(to, payload.sms.otp)
    return response({})
  } catch { return response({ error: { http_code: 400, message: 'Não foi possível entregar o código de teste.' } }, 400) }
})
