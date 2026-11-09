import { startMemberSession } from '../_shared/session-bridge.ts'
import { createClient } from '@supabase/supabase-js'
import { trustedRpc } from '../_shared/backend-rpc.ts'
import { boundedBody, PublicError, response } from '../_shared/http.ts'
import { createOtpService } from '../_shared/otp-service.ts'
import type { OtpIdentity, OtpPurpose, OtpChannel } from '../_shared/otp-service.ts'
import { createClickSend } from '../_shared/providers/clicksend.ts'
import { createResendSandbox } from '../_shared/providers/resend.ts'
const env = Deno.env.toObject()
Deno.serve(async request => {
  const origin = env.APP_ORIGIN
  if (!origin || request.headers.get('origin') !== origin) return response({ error: 'Origem não permitida.' }, 403)
  if (request.method === 'OPTIONS') return response({}, 200, origin)
  if (request.method !== 'POST' || !['local','sandbox'].includes(env.APP_ENV || '')) return response({ error: 'Operação indisponível.' }, 405, origin)
  try {
    if (!env.OTP_HMAC_SECRET || env.OTP_HMAC_SECRET.length < 32) return response({ error: 'Verificação não configurada.' }, 503, origin)
    const body = JSON.parse(await boundedBody(request, 2048))
    if (!['request','verify'].includes(body.action) || !['email','sms'].includes(body.channel) || !['login','signup','attach'].includes(body.purpose)) throw new PublicError('Solicitação inválida.')
    const channel = body.channel as OtpChannel
    const purpose = body.purpose as OtpPurpose
    const contact = typeof body.contact === 'string' ? (channel === 'email' ? body.contact.trim().toLowerCase() : body.contact) : ''
    // Check delivery configuration before allocating a challenge; never leak secrets/provider errors.
    const allowed = ((channel === 'sms' ? env.SMS_ALLOWED_TEST_NUMBERS : env.RESEND_ALLOWED_TEST_EMAILS) || '').split(',').map(v => v.trim().toLowerCase())
    if (!allowed.includes('*') && !allowed.includes(contact.toLowerCase())) throw new PublicError('Contato não autorizado no ambiente de testes.')
    const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    let actorId: string | null = null
    if (purpose === 'attach') {
      const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
      const client = createClient(env.SUPABASE_URL!,env.SUPABASE_ANON_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}})
      const { data, error } = await client.auth.getUser(token)
      const context = await client.rpc('rk_context')
      if (error || !data.user?.email_confirmed_at || context.error || !['member','pending'].includes(context.data?.role)) return response({ error: 'Confirme seu e-mail antes de verificar o celular.' },403,origin)
      actorId = data.user.id
    }
    const identity = (value: string, type: OtpChannel) => trustedRpc<OtpIdentity | null>(db,'rk_otp_identity',{p_contact:value,p_channel:type})
    const service = createOtpService(env.OTP_HMAC_SECRET, {
      identity,
      begin: args => trustedRpc(db,'rk_otp_begin',{p_id:args.id,p_contact_hash:args.contactHash,p_channel:args.channel,p_purpose:args.purpose,p_user:args.userId,p_actor:args.actorId,p_code_hash:args.codeHash}),
      delivered: (id,provider,success) => trustedRpc(db,'rk_otp_sent',{p_id:id,p_provider:provider,p_success:success}),
      consume: args => trustedRpc(db,'rk_otp_consume',{p_id:args.id,p_contact_hash:args.contactHash,p_channel:args.channel,p_purpose:args.purpose,p_actor:args.actorId,p_code_hash:args.codeHash}),
      send: async (type,to,code,id) => {
        if (type === 'sms') return (await createClickSend(env).sendCode(to,code,id)).messageId
        await createResendSandbox(env).send(to,'Seu código RKMED',`Seu código RKMED é ${code}. Válido por 5 minutos. Não compartilhe.`,id,code)
        return id
      },
      complete: async args => {
        if (args.purpose === 'attach') {
          const owner = await db.auth.admin.getUserById(args.actorId!)
          if (owner.error || !owner.data.user.email_confirmed_at) throw new PublicError('Conta indisponível.')
          const attached = await db.auth.admin.updateUserById(args.actorId!,{phone:args.contact.slice(1),phone_confirm:true})
          if (attached.error) throw new PublicError('Não foi possível vincular o celular. Solicite outro código.')
          return { verified: true, userId: args.actorId }
        }
        let user = args.identity
        if (args.purpose === 'signup') {
          if (user) {
            if (!user.emailVerified) {
              const confirmed = await db.auth.admin.updateUserById(user.id,{email_confirm:true})
              if (confirmed.error) throw new PublicError('Conta indisponível.')
            }
          } else {
            const created = await db.auth.admin.createUser({email:args.contact,email_confirm:true})
            if (created.error || !created.data.user) throw new PublicError('Não foi possível concluir. Entre com seu acesso existente.')
            user = {id:created.data.user.id,email:args.contact,emailVerified:true,phoneVerified:false}
          }
        }
        if (!user?.email) throw new PublicError('Conta indisponível.')
        const sessionClient = createClient(env.SUPABASE_URL!,env.SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
        return startMemberSession(db,sessionClient,user)
      },
    })
    const result = body.action === 'request' ? await service.request(contact,channel,purpose,actorId)
      : await service.verify(body.challengeId,contact,channel,purpose,actorId,body.token)
    return response(result,200,origin)
  } catch (error) { return response({error:error instanceof PublicError ? error.message : 'Não foi possível concluir a verificação. Tente novamente.'},400,origin) }
})
