import type { SupabaseClient } from '@supabase/supabase-js'
import { PublicError } from './http.ts'

// This adapter exchanges an already verified RKMED identity for a managed,
// rotating Supabase session. No member OTP is passed to Supabase or generated here.
export async function startMemberSession(db: SupabaseClient, sessionClient: SupabaseClient, user: { id: string; email: string }) {
  const link = await db.auth.admin.generateLink({ type: 'magiclink', email: user.email })
  if (link.error || link.data.user.id !== user.id || !link.data.properties.hashed_token) throw new PublicError('Não foi possível iniciar a sessão. Solicite outro código.')
  const redeemed = await sessionClient.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' })
  if (redeemed.error || !redeemed.data.session || redeemed.data.user?.id !== user.id) throw new PublicError('Não foi possível iniciar a sessão. Solicite outro código.')
  return { userId: user.id, session: { access_token: redeemed.data.session.access_token, refresh_token: redeemed.data.session.refresh_token } }
}
