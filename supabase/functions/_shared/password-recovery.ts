import type { SupabaseClient } from '@supabase/supabase-js'
import { otpDigest } from './otp-crypto.ts'
import { createResendSandbox } from './providers/resend.ts'

type Environment = Record<string, string | undefined>

// Public responses are identical for unknown, throttled, disabled and accepted accounts.
export async function requestPasswordRecovery(db: SupabaseClient, env: Environment, emailInput: unknown) {
  if (typeof emailInput !== 'string' || emailInput.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) return { accepted: true }
  if (!env.OTP_HMAC_SECRET || env.OTP_HMAC_SECRET.length < 32 || !['local', 'sandbox'].includes(env.APP_ENV || '')) return { accepted: true }
  const email = emailInput.trim().toLowerCase()
  const digest = await otpDigest(env.OTP_HMAC_SECRET, 'password-recovery-email', email)
  const { data: allowed, error: rateError } = await db.rpc('rk_password_recovery_allowed', { p_email_hash: digest })
  if (rateError || allowed !== true) return { accepted: true }
  const destinations = (env.RESEND_ALLOWED_TEST_EMAILS || '').split(',').map(value => value.trim().toLowerCase())
  if (!destinations.includes('*') && !destinations.includes(email)) return { accepted: true }
  try {
    // The application root is the configured Auth site URL; the client moves a
    // successful recovery callback to /redefinir-senha after consuming tokens.
    const generated = await db.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: env.APP_ORIGIN } })
    const link = generated.data.properties?.action_link
    const linkUrl = typeof link === 'string' ? new URL(link) : null
    const authOrigin = new URL(env.SUPABASE_URL!).origin
    if (generated.error || !linkUrl || linkUrl.origin !== authOrigin || (env.APP_ENV === 'local' ? linkUrl.protocol !== 'http:' : linkUrl.protocol !== 'https:')) return { accepted: true }
    await createResendSandbox(env).send(email, 'RKMED — redefinição de senha', 'Recebemos um pedido para redefinir sua senha. Use o botão abaixo. Se você não solicitou, ignore esta mensagem.', `password-recovery/${crypto.randomUUID()}`, undefined, link)
  } catch { /* Do not expose account existence or provider state. */ }
  return { accepted: true }
}
