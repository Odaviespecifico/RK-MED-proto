import { PublicError } from '../http.ts'

type Environment = Record<string, string | undefined>

// ClickSend transports messages only. RKMED owns challenges, expiry and verification.
export function createClickSend(env: Environment, transport: typeof fetch = fetch) {
  return {
    async sendCode(to: string, code: string, reference: string): Promise<{ messageId: string }> {
      const allowed = (env.SMS_ALLOWED_TEST_NUMBERS || '').split(',').map(value => value.trim())
      if (!['local', 'sandbox'].includes(env.APP_ENV || '') || env.CLICKSEND_MODE !== 'test'
        || !env.CLICKSEND_USERNAME || !env.CLICKSEND_API_KEY || (!allowed.includes('*') && !allowed.includes(to))) {
        throw new PublicError('Envio SMS não configurado ou destinatário não autorizado.')
      }
      if (!/^\+55\d{10,11}$/.test(to) || !/^\d{6}$/.test(code) || !/^[a-f0-9-]{36}$/.test(reference)) {
        throw new PublicError('Mensagem de verificação inválida.')
      }
      try {
        const result = await transport('https://rest.clicksend.com/v3/sms/send', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
          headers: { Authorization: `Basic ${btoa(`${env.CLICKSEND_USERNAME}:${env.CLICKSEND_API_KEY}`)}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ source: 'sdk', to,
            body: `RKMED: seu codigo e ${code}. Valido por 5 minutos. Nao compartilhe.`, custom_string: reference }] }),
        })
        if (!result.ok) throw new Error('HTTP failure')
        const payload = await result.json()
        const messages = payload?.data?.messages
        const message = Array.isArray(messages) && messages.length === 1 ? messages[0] : null
        if (payload?.response_code !== 'SUCCESS' || message?.status !== 'SUCCESS'
          || typeof message.message_id !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(message.message_id)
          || message.to !== to) throw new Error('Message rejected')
        return { messageId: message.message_id }
      } catch {
        // No retries: custom_string correlates requests; it does not deduplicate sends.
        // Never log provider payloads, which contain the recipient and OTP.
        throw new PublicError('Não foi possível confirmar o envio do SMS. Aguarde antes de solicitar outro código.')
      }
    },
  }
}
