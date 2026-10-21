import { createClient } from '@supabase/supabase-js'
import { trustedRpc } from '../_shared/billing.ts'
import { boundedBody, response } from '../_shared/http.ts'
const env = Deno.env.toObject()
Deno.serve(async request => {
  const origin = env.APP_ORIGIN
  if (!origin || request.headers.get('origin') !== origin) return response({ error: 'Origem não permitida' }, 403)
  if (request.method === 'OPTIONS') return response({}, 200, origin)
  if (request.method !== 'POST' || !['local', 'sandbox'].includes(env.APP_ENV || '') || env.TWILIO_MODE !== 'whatsapp-sandbox') return response({ error: 'Entrega de teste não configurada.' }, 503, origin)
  try {
    const body = JSON.parse(await boundedBody(request, 2048))
    const phone = body.phone
    if (typeof phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(phone) || !['whatsapp', 'sms'].includes(body.channel)
      || !(env.TWILIO_ALLOWED_TEST_NUMBERS || '').split(',').map(value => value.trim()).includes(phone)) return response({ error: 'Número não autorizado no sandbox.' }, 400, origin)
    const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const authorization = request.headers.get('authorization') || ''
    const client = createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false }, ...(body.purpose === 'attach' ? { global: { headers: { Authorization: authorization } } } : {}) })
    if (body.purpose === 'attach') {
      const { data, error } = await client.auth.getUser(authorization.replace(/^Bearer /, ''))
      const { data: context, error: denied } = await client.rpc('rk_context')
      if (error || !data.user?.email_confirmed_at || denied || !context || !['pending', 'member'].includes(context.role)) return response({ error: 'Confirme seu e-mail antes de verificar o celular.' }, 403, origin)
    } else if (body.purpose !== 'login') return response({ error: 'Solicitação inválida.' }, 400, origin)
    await trustedRpc(db, 'rk_phone_prepare', { p_phone: phone, p_channel: body.channel })
    // Supabase owns OTP generation, challenge expiry/attempts and identity linkage.
    const { error } = body.purpose === 'attach' ? await client.auth.updateUser({ phone })
      : await client.auth.signInWithOtp({ phone, options: { shouldCreateUser: false, channel: 'sms' } })
    if (error) return response({ error: 'Não foi possível enviar. Aguarde 60 segundos e tente novamente.' }, 400, origin)
    return response({ sent: true }, 200, origin)
  } catch { return response({ error: 'Não foi possível enviar. Confira o contato e aguarde antes de reenviar.' }, 400, origin) }
})
