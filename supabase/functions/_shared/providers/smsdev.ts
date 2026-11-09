import { PublicError } from '../http.ts'

type Environment = Record<string, string | undefined>
export type SmsTransport = { sendCode(to: string, code: string, reference: string): Promise<{ messageId: string }> }

// Delivery only: no OTP issuance, validation, expiry or retry decisions here.
export function createSmsDev(env: Environment, transport: typeof fetch = fetch): SmsTransport {
  return {
    async sendCode(to, code, reference) {
      const allowed = (env.SMS_ALLOWED_TEST_NUMBERS || '').split(',').map(v => v.trim())
      if (!['local', 'sandbox'].includes(env.APP_ENV || '') || env.SMSDEV_MODE !== 'test'
        || !env.SMSDEV_API_KEY || !allowed.includes(to)) throw new PublicError('Envio SMS não configurado ou destinatário não autorizado.')
      if (!/^\+55\d{10,11}$/.test(to) || !/^\d{6}$/.test(code) || !/^[a-f0-9-]{36}$/.test(reference)) throw new PublicError('Mensagem de verificação inválida.')
      const msg = `RKMED: seu codigo e ${code}. Valido por 5 minutos. Nao compartilhe.`
      let status = 0
      let providerCode = ''
      try {
        const result = await transport('https://api.smsdev.com.br/v1/send', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{ key: env.SMSDEV_API_KEY, type: 9, number: Number(to.slice(1)), msg, refer: reference }]),
        })
        status = result.status
        if (!result.ok) throw new Error(`HTTP ${status}`)
        let payload: unknown
        try { payload = await result.json() } catch { throw new Error('Invalid JSON') }
        const item = Array.isArray(payload) && payload.length === 1 ? payload[0] : !Array.isArray(payload) ? payload : null
        if (!item || item.situacao !== 'OK' || String(item.codigo) !== '1' || !/^\d+$/.test(String(item.id || ''))) {
          providerCode = item ? `${item.situacao}/${item.codigo}` : 'unexpected'
          throw new Error('Rejected')
        }
        return { messageId: String(item.id) }
      } catch (error) {
        // No automatic retries: refer is correlation, not a provider idempotency guarantee.
        // Log only the provider status/code; descriptions may contain full phone numbers.
        console.error('smsdev:send:failed', status, providerCode, error instanceof Error ? error.message : 'unknown')
        throw new PublicError('Não foi possível confirmar o envio do SMS. Aguarde antes de solicitar outro código.')
      }
    },
  }
}
