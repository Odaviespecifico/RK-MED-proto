import type { SupabaseClient, User } from '@supabase/supabase-js'
import { PublicError } from './http.ts'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export type TestPartnerResult = { partnerId: string; name: string; email: string; employeeName: string; establishmentCode: string; isTest: true }
type Reservation = { status: 'pending'; operationId: string; authUserId: string } | { status: 'succeeded'; result: TestPartnerResult } | { status: 'busy' }

// A reserved Auth UUID and server-owned marker reconcile an uncertain create response.
// Authorization is always private.roles; the marker never grants access.
export async function createTestPartner(db: SupabaseClient, actor: string, session: string, body: Record<string, unknown>, environment: string) {
  if (!['local', 'sandbox'].includes(environment)) throw new PublicError('Cadastro de teste indisponível neste ambiente.')
  const details: Record<string, string | number> = {}
  for (const [field, min, max] of [['name', 2, 160], ['segment', 1, 160], ['address', 1, 500], ['employeeName', 2, 160]] as const) {
    const value = body[field]
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new PublicError('Preencha os dados do estabelecimento e funcionário.')
    details[field] = value.trim()
  }
  if (!Number.isSafeInteger(body.discountBps) || Number(body.discountBps) < 0 || Number(body.discountBps) > 10000) throw new PublicError('Desconto inválido.')
  details.discountBps = Number(body.discountBps)
  if (typeof body.email !== 'string' || body.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) throw new PublicError('Informe um e-mail válido.')
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw new PublicError('Use uma senha entre 12 e 128 caracteres.')
  if (typeof body.employeeCode !== 'string' || !/^[0-9]{4,12}$/.test(body.employeeCode)) throw new PublicError('Use um código de funcionário com 4 a 12 dígitos.')
  if (typeof body.operationId !== 'string' || !uuid.test(body.operationId)) throw new PublicError('Operação inválida.')
  const email = body.email.trim().toLowerCase()
  const owner = crypto.randomUUID()
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await db.rpc(name, args)
    if (error) throw new PublicError(error.code === 'P0001' && error.message.length < 240 ? error.message : 'Não foi possível concluir. Tente novamente para verificar o cadastro.')
    return data as T
  }
  const reserved = await rpc<Reservation>('rk_backend_test_partner_begin', { p_actor: actor, p_session: session, p_operation: body.operationId,
    p_owner: owner, p_email: email, p_details: details, p_code: body.employeeCode })
  if (reserved.status === 'succeeded') return reserved.result
  if (reserved.status === 'busy') throw new PublicError('Cadastro em andamento. Aguarde e tente novamente com os mesmos dados.')
  try {
    const existing = await db.auth.admin.getUserById(reserved.authUserId)
    let user: User | null = existing.data.user
    if (existing.error && existing.error.status !== 404) throw new PublicError('Não foi possível verificar a conta. Tente novamente.')
    if (!user) {
      const created = await db.auth.admin.createUser({ id: reserved.authUserId, email, password: body.password, email_confirm: true,
        app_metadata: { rkmed_test_partner_operation: reserved.operationId } })
      user = created.data.user
      if (created.error || !user) {
        // A timeout may happen after Auth committed; never delete or adopt by email.
        const recovered = await db.auth.admin.getUserById(reserved.authUserId)
        user = recovered.data.user
        if (recovered.error || !user) throw new PublicError('Não foi possível criar a conta. Confira o e-mail e a senha e tente novamente.')
      }
    }
    if (user.id !== reserved.authUserId || user.email?.toLowerCase() !== email || user.app_metadata.rkmed_test_partner_operation !== reserved.operationId) throw new PublicError('Não foi possível verificar o vínculo da conta. Procure a administração.')
    return await rpc<TestPartnerResult>('rk_backend_test_partner_finish', { p_actor: actor, p_session: session, p_operation: reserved.operationId, p_owner: owner })
  } finally {
    // This cannot undo a committed finish. Pending identities remain reserved and
    // blocked by private.actor until a retry completes the atomic domain creation.
    try { await db.rpc('rk_backend_test_partner_release', { p_actor: actor, p_operation: reserved.operationId, p_owner: owner }) } catch { /* The bounded lease also permits later recovery. */ }
  }
}
