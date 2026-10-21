type Environment = Record<string, string | undefined>
type Transport = typeof fetch

export class TwilioSandboxError extends Error {}

// Delivery only. The future signed Supabase Auth hook must own OTP issuance/expiry and audit.
// No public endpoint uses this adapter yet; do not invoke it from a browser.
export function createTwilioSandbox(env: Environment, transport: Transport = fetch) {
  return {
    async sendSmsCode(to: string, code: string): Promise<void> {
      const allowed = (env.TWILIO_ALLOWED_TEST_NUMBERS || '').split(',').map(value => value.trim())
      const sid = env.TWILIO_ACCOUNT_SID || ''
      const token = env.TWILIO_AUTH_TOKEN || ''
      if (!['local', 'sandbox'].includes(env.APP_ENV || '') || env.TWILIO_MODE !== 'whatsapp-sandbox' || !allowed.includes(to)
        || !/^\+[1-9]\d{7,14}$/.test(to) || !/^\+[1-9]\d{7,14}$/.test(env.TWILIO_SMS_FROM || '') || !/^\d{6}$/.test(code)
        || !/^AC[a-f0-9]{32}$/i.test(sid) || !/^[a-f0-9]{32}$/i.test(token)) throw new TwilioSandboxError('SMS de teste não configurado ou destinatário não permitido.')
      let result: Response
      try { result = await transport(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: env.TWILIO_SMS_FROM!, To: to, Body: `Seu código RKMED é ${code}` }),
      }) } catch { throw new TwilioSandboxError('Não foi possível entregar o SMS de teste.') }
      if (!result.ok) throw new TwilioSandboxError('Twilio recusou o SMS de teste.')
    },
    async sendWhatsAppCode(to: string, code: string): Promise<void> {
      if (!['local', 'sandbox'].includes(env.APP_ENV || '') || env.TWILIO_MODE !== 'whatsapp-sandbox') {
        throw new TwilioSandboxError('Entrega Twilio desabilitada neste ambiente.')
      }
      const allowed = (env.TWILIO_ALLOWED_TEST_NUMBERS || '').split(',').map(value => value.trim()).filter(Boolean)
      if (!/^\+[1-9]\d{7,14}$/.test(to) || !allowed.includes(to) || !/^\d{6}$/.test(code)) {
        throw new TwilioSandboxError('Destinatário ou código de teste não permitido.')
      }
      const sid = env.TWILIO_ACCOUNT_SID || ''
      const token = env.TWILIO_AUTH_TOKEN || ''
      if (!/^AC[a-f0-9]{32}$/i.test(sid) || !/^[a-f0-9]{32}$/i.test(token)
        || env.TWILIO_WHATSAPP_FROM !== 'whatsapp:+14155238886') {
        throw new TwilioSandboxError('Configure as credenciais e o remetente oficial do WhatsApp Sandbox.')
      }
      let response: Response
      try {
        response = await transport(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
          headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ From: env.TWILIO_WHATSAPP_FROM, To: `whatsapp:${to}`, Body: `Seu código RKMED é ${code}` }),
        })
      } catch { throw new TwilioSandboxError('Não foi possível entregar a mensagem de teste.') }
      if (!response.ok) throw new TwilioSandboxError('Twilio recusou a mensagem. Confira o sandbox e o número autorizado.')
    },
  }
}
