import type { SupabaseClient } from '@supabase/supabase-js'
import { PublicError } from './http.ts'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function verifiedSessionId(token: string) {
  try {
    const value = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id
    if (typeof value === 'string' && uuid.test(value)) return value
  } catch { /* The caller verifies the JWT with getUser before extracting this claim. */ }
  throw new PublicError('Entre novamente para administrar acessos.')
}

export async function manageStaff(db: SupabaseClient, actor: string, session: string, body: Record<string, unknown>) {
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await db.rpc(name, args)
    if (error) throw new PublicError((error.code === 'P0001' || (error.code === '42501' && error.message === 'Acesso negado')) && error.message.length < 240
      ? error.message : 'Não foi possível administrar este acesso. Atualize a lista e tente novamente.')
    return data as T
  }
  const action = body.staffAction || 'create'
  if (!['create', 'password'].includes(String(action))) throw new PublicError('Ação de acesso inválida.')
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw new PublicError('Use uma senha entre 12 e 128 caracteres.')
  const operation = typeof body.operationId === 'string' ? body.operationId : crypto.randomUUID()
  if (!uuid.test(operation)) throw new PublicError('Operação inválida.')
  await rpc('rk_backend_staff_authorize', { p_actor: actor, p_session: session })
  if (action === 'create') {
    if (!['admin', 'support', 'viewer', 'partner'].includes(String(body.role)) || typeof body.email !== 'string'
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) throw new PublicError('Informe e-mail e perfil válidos.')
    const partner = body.role === 'partner' ? body.partnerId : null
    if (body.role === 'partner' && (typeof partner !== 'string' || !uuid.test(partner))) throw new PublicError('Selecione o estabelecimento do parceiro.')
    const created = await db.auth.admin.createUser({ email: body.email.trim().toLowerCase(), password: body.password, email_confirm: true })
    if (created.error || !created.data.user) throw new PublicError('Não foi possível criar o acesso. Verifique se o e-mail já está cadastrado.')
    try {
      await rpc('rk_backend_staff_provision', { p_actor: actor, p_session: session, p_user: created.data.user.id,
        p_role: body.role, p_partner: partner, p_operation: operation })
    } catch (error) { await db.auth.admin.deleteUser(created.data.user.id); throw error }
    return { created: true }
  }
  if (typeof body.userId !== 'string' || !uuid.test(body.userId) || !Number.isSafeInteger(body.revision)
    || typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.trim().length > 1000) throw new PublicError('Informe acesso e motivo válidos.')
  const owner = crypto.randomUUID()
  const state = await rpc<{ status: string }>('rk_backend_staff_password_begin', { p_actor: actor, p_session: session,
    p_user: body.userId, p_revision: body.revision, p_reason: body.reason.trim(), p_operation: operation, p_owner: owner })
  if (state.status === 'succeeded') return { passwordUpdated: true }
  if (state.status !== 'pending') throw new PublicError('Já existe uma redefinição em andamento. Aguarde e atualize a lista.')
  let success = false
  try {
    const result = await db.auth.admin.updateUserById(body.userId, { password: body.password })
    if (result.error) throw new PublicError('Não foi possível redefinir a senha. Atualize a lista e tente novamente.')
    success = true
  } finally {
    await rpc('rk_backend_staff_password_finish', { p_operation: operation, p_owner: owner, p_success: success })
  }
  return { passwordUpdated: true }
}
