import { PublicError } from './http.ts'
import { generateOtp, otpDigest } from './otp-crypto.ts'

export type OtpPurpose = 'login' | 'signup' | 'attach'
export type OtpChannel = 'email' | 'sms'
export type OtpIdentity = { id: string; email: string; emailVerified: boolean; phoneVerified: boolean }
export type OtpDependencies = {
  identity(contact: string, channel: OtpChannel): Promise<OtpIdentity | null>
  begin(args: { id: string; contactHash: string; channel: OtpChannel; purpose: OtpPurpose; userId: string | null; actorId: string | null; codeHash: string }): Promise<boolean>
  delivered(id: string, providerId: string | null, success: boolean): Promise<void>
  consume(args: { id: string; contactHash: string; channel: OtpChannel; purpose: OtpPurpose; actorId: string | null; codeHash: string }): Promise<{ userId: string | null } | null>
  send(channel: OtpChannel, contact: string, code: string, id: string): Promise<string>
  complete(args: { identity: OtpIdentity | null; contact: string; channel: OtpChannel; purpose: OtpPurpose; actorId: string | null }): Promise<unknown>
}
const invalid = () => new PublicError('Código inválido, expirado ou já utilizado. Solicite outro código.')
export function createOtpService(secret: string, deps: OtpDependencies) {
  function validate(contact: string, channel: OtpChannel, purpose: OtpPurpose, actorId: string | null) {
    if (!['email','sms'].includes(channel) || !['login','signup','attach'].includes(purpose)
      || (purpose === 'signup' && channel !== 'email') || (purpose === 'attach' && (channel !== 'sms' || !actorId))) throw new PublicError('Solicitação inválida.')
    if (channel === 'sms' ? !/^\+55\d{10,11}$/.test(contact) : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new PublicError('Contato inválido.')
  }
  return {
    async request(contact: string, channel: OtpChannel, purpose: OtpPurpose, actorId: string | null) {
      validate(contact, channel, purpose, actorId)
      const identity = await deps.identity(contact, channel)
      const id = crypto.randomUUID()
      const code = generateOtp()
      const contactHash = await otpDigest(secret, 'contact', contact)
      const accepted = await deps.begin({ id, contactHash, channel, purpose,
        userId: purpose === 'attach' ? actorId : identity?.id || null,
        actorId: purpose === 'attach' ? actorId : null, codeHash: await otpDigest(secret, id, code) })
      if (!accepted) throw new PublicError('Aguarde antes de solicitar outro código. Limite de tentativas atingido.')
      // Unknown/unverified logins have the same public response, but no usable code.
      const canSend = purpose !== 'login' || !!(identity?.emailVerified && (channel === 'email' || identity.phoneVerified))
      if (!canSend || (purpose === 'attach' && identity && identity.id !== actorId)) {
        await deps.delivered(id, null, false)
        return { challengeId: id, retryAfter: 60 }
      }
      try {
        const providerId = await deps.send(channel, contact, code, id)
        await deps.delivered(id, providerId, true)
      } catch {
        await deps.delivered(id, null, false)
        throw new PublicError('Não foi possível confirmar o envio. Aguarde antes de solicitar outro código.')
      }
      return { challengeId: id, retryAfter: 60 }
    },
    async verify(id: string, contact: string, channel: OtpChannel, purpose: OtpPurpose, actorId: string | null, code: string) {
      validate(contact, channel, purpose, actorId)
      if (!/^[a-f0-9-]{36}$/.test(id) || !/^\d{6}$/.test(code)) throw invalid()
      const result = await deps.consume({ id, contactHash: await otpDigest(secret, 'contact', contact), channel, purpose,
        actorId: purpose === 'attach' ? actorId : null, codeHash: await otpDigest(secret, id, code) })
      if (!result) throw invalid()
      const identity = await deps.identity(contact, channel)
      if (purpose === 'login' && (!identity || identity.id !== result.userId || !identity.emailVerified || (channel === 'sms' && !identity.phoneVerified))) throw invalid()
      if (purpose === 'attach' && result.userId !== actorId) throw invalid()
      return deps.complete({ identity, contact, channel, purpose, actorId })
    },
  }
}
