import { Webhook } from 'standardwebhooks'
import { createResendSandbox } from '../_shared/providers/resend.ts'
import { boundedBody, response } from '../_shared/http.ts'
const env = Deno.env.toObject()
Deno.serve(async request => {
  if (request.method !== 'POST' || !env.AUTH_EMAIL_HOOK_SECRET) return response({ error: { http_code: 503, message: 'Entrega não configurada' } }, 503)
  try {
    const body = await boundedBody(request, 16384)
    const payload = new Webhook(env.AUTH_EMAIL_HOOK_SECRET.replace(/^v1,whsec_/, '')).verify(body, Object.fromEntries(request.headers)) as { user: { email: string }; email_data: { token: string; email_action_type: string } }
    if (!/^\d{6}$/.test(payload.email_data.token)) throw new Error('Unsupported token')
    await createResendSandbox(env).send(payload.user.email, 'Seu código de acesso RKMED', `Seu código de acesso é ${payload.email_data.token}. Se você não solicitou, ignore esta mensagem.`, request.headers.get('webhook-id')!)
    return response({})
  } catch { return response({ error: { http_code: 400, message: 'Não foi possível entregar o código de teste.' } }, 400) }
})
