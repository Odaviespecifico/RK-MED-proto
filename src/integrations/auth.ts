import type { SupabaseClient } from '@supabase/supabase-js'
import { IntegrationError, type MemberAuth, type OtpRequest } from './contracts.ts'

export function normalizeContact({ contact, channel }: OtpRequest) {
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

// Supabase owns OTP identity/challenge/session. Twilio is configured server-side as transport.
export function createMemberAuth(client: SupabaseClient, phoneGateway = false): MemberAuth {
  return {
    async requestCode(request) {
      const contact = normalizeContact(request)
      if (request.channel !== 'email' && phoneGateway) {
        const { data, error } = await client.functions.invoke('phone-code', { body: { phone: contact, channel: request.channel, purpose: 'login' } })
        if (error || data?.error) throw new IntegrationError('Não foi possível enviar o código. Aguarde e confira o sandbox Twilio.')
        return
      }
      const { error } = await client.auth.signInWithOtp(request.channel === 'email'
        ? { email: contact, options: { shouldCreateUser: false } }
        : { phone: contact, options: { shouldCreateUser: false, channel: request.channel } })
      if (error) throw new IntegrationError('Não foi possível enviar o código. Confira o contato e a configuração do ambiente de testes.')
    },
    async verifyCode(request) {
      const contact = normalizeContact(request)
      if (!/^\d{6}$/.test(request.token)) throw new IntegrationError('Informe o código de seis dígitos recebido.')
      const { data, error } = await client.auth.verifyOtp(request.channel === 'email'
        ? { email: contact, token: request.token, type: 'email' }
        : { phone: contact, token: request.token, type: 'sms' })
      if (error || !data.session || !data.user) throw new IntegrationError('Código inválido ou expirado. Solicite um novo código.')
      return { userId: data.user.id }
    },
  }
}
