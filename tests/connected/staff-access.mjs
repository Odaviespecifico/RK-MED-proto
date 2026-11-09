import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { localClients, login } from '../../scripts/dev/local.mjs'
import { manageStaff, verifiedSessionId } from '../../supabase/functions/_shared/staff-access.ts'
const local = localClients()
const admin = await login(local, 'admin@rkmed.test')
const email = `staff-${randomUUID()}@rkmed.test`
const password = 'Synthetic-only-Password-2026!'
const nextPassword = 'Synthetic-replacement-2026!'
const actor = '00000000-0000-4000-8000-000000000005'
const session = verifiedSessionId((await admin.auth.getSession()).data.session.access_token)
let target
try {
  assert.equal((await admin.rpc('rk_context')).error, null)
  await manageStaff(local.service, actor, session, { email, password, role: 'viewer', operationId: randomUUID() })
  const accounts = await admin.rpc('rk_staff_accounts', { p_query: email })
  assert.equal(accounts.error, null); target = accounts.data.items[0].id
  const client = local.client()
  assert.equal((await client.auth.signInWithPassword({ email, password })).error, null)
  assert.equal((await client.rpc('rk_context')).error, null)
  const operationId = randomUUID()
  const body = { staffAction: 'password', userId: target, password: nextPassword, revision: 1, reason: 'Recuperação sintética de teste', operationId }
  assert.equal((await manageStaff(local.service, actor, session, body)).passwordUpdated, true)
  assert.equal((await manageStaff(local.service, actor, session, body)).passwordUpdated, true)
  assert.match((await client.rpc('rk_context')).error.message, /Entre novamente/)
  assert.ok((await local.client().auth.signInWithPassword({ email, password })).error)
  const fresh = local.client()
  assert.equal((await fresh.auth.signInWithPassword({ email, password: nextPassword })).error, null)
  assert.equal((await fresh.rpc('rk_context')).error, null)
  assert.equal((await admin.rpc('rk_update_staff_access', { p_user: target, p_role: 'support', p_partner: null, p_active: false, p_revision: 2, p_reason: 'Desativação de teste' })).error, null)
  assert.match((await fresh.rpc('rk_context')).error.message, /desativado/)
  const audit = await admin.rpc('rk_staff_access_audit', { p_user: target })
  assert.ok(audit.data.some(a => a.action === 'staff.password.succeeded'))
  assert.ok(!JSON.stringify(audit.data).includes(nextPassword))
  console.log('Gestão real local: criação, troca de senha, replay, bloqueio de sessões e auditoria aprovados.')
} finally {
  if (target) {
    execFileSync('docker', ['exec', '-i', 'supabase_db_rkmed', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: `delete from private.staff_password_operations where target_id='${target}';`, stdio: ['pipe', 'pipe', 'pipe'] })
    const removed = await local.service.auth.admin.deleteUser(target)
    assert.equal(removed.error, null)
  }
  await admin.auth.signOut({ scope: 'local' })
}
