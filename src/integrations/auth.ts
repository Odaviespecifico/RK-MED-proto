import type { SupabaseClient } from '@supabase/supabase-js'
import { IntegrationError, type MemberAuth, type OtpRequest } from './contracts.ts'

export function normalizeContact({ contact, channel }: OtpRequest) {
  if (channel !== 'email' && channel !== 'sms') throw new IntegrationError('Escolha SMS ou e-mail para receber o código.')
  if (channel === 'email') {
    const email = contact.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new IntegrationError('Informe um e-mail válido.')
    return email
  }
  const digits = contact.replace(/\D/g, '')
  const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits
  if (!/^55\d{10,11}$/.test(phone)) throw new IntegrationError('Informe um celular brasileiro com DDD.')
  return `+${phone}`
}

// Challenge IDs live only in memory. Supabase stores/refreshes the resulting session;
// it never issues or verifies the code typed by the member.
export function createMemberAuth(client: SupabaseClient, purpose: 'login' | 'signup' | 'attach' = 'login'): MemberAuth {
  const challenges = new Map<string, { id: string; expiresAt: number }>()
  async function invoke(body: Record<string, unknown>) {
    const { data, error } = await client.functions.invoke('phone-code', { body })
    if (error || data?.error || !data) {
      let message = data?.error
      if (error?.context instanceof Response) {
        try { message = (await error.context.clone().json()).error } catch { /* Use the safe fallback below. */ }
      }
      const messages = new Set(['Código inválido, expirado ou já utilizado. Solicite outro código.', 'Aguarde antes de solicitar outro código. Limite de tentativas atingido.', 'Não foi possível confirmar o envio. Aguarde antes de solicitar outro código.'])
      throw new IntegrationError(messages.has(message) ? message : body.action === 'request' ? 'Não foi possível enviar o código. Aguarde um minuto e tente novamente.' : 'Não foi possível confirmar o código. Confira os números ou solicite outro código.')
    }
    return data
  }
  return {
    async requestCode(request) {
      const contact = normalizeContact(request)
      const result = await invoke({ action: 'request', contact, channel: request.channel, purpose })
      if (typeof result.challengeId !== 'string' || !/^[a-f0-9-]{36}$/.test(result.challengeId)) throw new IntegrationError('Solicitação de código inválida.')
      challenges.set(JSON.stringify([request.channel, contact]), { id: result.challengeId, expiresAt: Date.now() + 5 * 60 * 1000 })
    },
    async verifyCode(request) {
      const contact = normalizeContact(request)
      const key = JSON.stringify([request.channel, contact])
      const challenge = challenges.get(key)
      if (!challenge || !/^\d{6}$/.test(request.token)) throw new IntegrationError('Solicite um código válido antes de confirmar.')
      if (Date.now() >= challenge.expiresAt) { challenges.delete(key); throw new IntegrationError('Este código expirou. Solicite outro código para continuar.') }
      const challengeId = challenge.id
      const result = await invoke({ action: 'verify', contact, channel: request.channel, purpose, challengeId, token: request.token })
      if (typeof result.userId !== 'string') throw new IntegrationError('Verificação inválida.')
      if (purpose !== 'attach') {
        if (!result.session?.access_token || !result.session?.refresh_token) throw new IntegrationError('Não foi possível iniciar a sessão.')
        const { data, error } = await client.auth.setSession(result.session)
        if (error || data.user?.id !== result.userId) throw new IntegrationError('Não foi possível iniciar a sessão.')
      } else if (!result.verified) throw new IntegrationError('Não foi possível confirmar o celular.')
      challenges.delete(key)
      return { userId: result.userId }
    },
  }
}
