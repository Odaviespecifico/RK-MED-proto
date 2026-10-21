type Environment = Record<string, string | undefined>
export function createResendSandbox(env: Environment, transport: typeof fetch = fetch) {
  return {
    async send(to: string, subject: string, text: string, operation: string) {
      const allowed = (env.RESEND_ALLOWED_TEST_EMAILS || '').split(',').map(email => email.trim().toLowerCase())
      if (!['local', 'sandbox'].includes(env.APP_ENV || '') || env.RESEND_MODE !== 'transactional-sandbox'
        || !env.RESEND_API_KEY || !env.RESEND_FROM || !allowed.includes(to.toLowerCase()) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Entrega de e-mail de teste não configurada ou destinatário não autorizado.')
      const result = await transport('https://api.resend.com/emails', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `rkmed/${operation}` },
        body: JSON.stringify({ from: env.RESEND_FROM, to: [to], subject, text: `${text}\n\nEsse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.` }) })
      if (!result.ok) throw new Error('Entrega de e-mail recusada. Verifique a configuração do sandbox.')
    },
  }
}
