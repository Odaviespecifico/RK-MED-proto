import test from 'node:test'
import assert from 'node:assert/strict'
import { manageStaff, verifiedSessionId } from '../../supabase/functions/_shared/staff-access.ts'

const actor = 'a0000000-0000-4000-8000-000000000001'
const session = 'a0000000-0000-4000-8000-000000000002'
const user = 'a0000000-0000-4000-8000-000000000003'
const operation = 'a0000000-0000-4000-8000-000000000004'
const password = 'Synthetic-only-Password-2026!'
const body = { staffAction: 'password', userId: user, revision: 1, reason: 'Recuperação solicitada', password, operationId: operation }

test('staff operations authorize the live administrator session before changing credentials', async () => {
  let writes = 0
  const db = { rpc: async () => ({ error: { code: '42501', message: 'Acesso negado' } }), auth: { admin: { updateUserById: async () => { writes++ }, createUser: async () => { writes++ } } } }
  await assert.rejects(() => manageStaff(db, actor, session, body), /Acesso negado/)
  await assert.rejects(() => manageStaff(db, actor, session, { ...body, staffAction: 'create', email: 'staff@example.invalid', role: 'support' }), /Acesso negado/)
  assert.equal(writes, 0)
})

test('password reset records only metadata, revokes application access first, and audits the provider result', async () => {
  const calls = []
  const db = { rpc: async (name, args) => { calls.push({ name, args }); return { error: null, data: name === 'rk_backend_staff_password_begin' ? { status: 'pending' } : null } }, auth: { admin: { updateUserById: async (id, args) => { calls.push({ name: 'Auth', id, args }); return { error: null } } } } }
  assert.deepEqual(await manageStaff(db, actor, session, body), { passwordUpdated: true })
  assert.deepEqual(calls.map(c => c.name), ['rk_backend_staff_authorize', 'rk_backend_staff_password_begin', 'Auth', 'rk_backend_staff_password_finish'])
  assert.equal(calls[2].args.password, password)
  assert.equal(calls.at(-1).args.p_success, true)
  assert.ok(!JSON.stringify(calls.filter(c => c.name !== 'Auth')).includes(password))
})

test('completed and concurrent password operations never repeat provider writes', async () => {
  let writes = 0
  for (const status of ['succeeded', 'busy']) {
    const db = { rpc: async name => ({ error: null, data: name === 'rk_backend_staff_password_begin' ? { status } : null }), auth: { admin: { updateUserById: async () => { writes++ } } } }
    if (status === 'succeeded') assert.equal((await manageStaff(db, actor, session, body)).passwordUpdated, true)
    else await assert.rejects(() => manageStaff(db, actor, session, body), /andamento/)
  }
  assert.equal(writes, 0)
})

test('provider errors are redacted and failed reset/provision operations are accounted for', async () => {
  const calls = []; let deleted
  const db = { rpc: async (name, args) => {
    calls.push({ name, args })
    return name === 'rk_backend_staff_provision' ? { error: { code: '42501', message: 'Acesso negado' } } : { error: null, data: { status: 'pending' } }
  }, auth: { admin: {
    updateUserById: async () => ({ error: new Error(password) }),
    createUser: async () => ({ error: null, data: { user: { id: user } } }),
    deleteUser: async id => { deleted = id },
  } } }
  await assert.rejects(() => manageStaff(db, actor, session, body), e => !e.message.includes(password))
  assert.equal(calls.at(-1).args.p_success, false)
  await assert.rejects(() => manageStaff(db, actor, session, { ...body, staffAction: 'create', email: 'new@example.invalid', role: 'support' }))
  assert.equal(deleted, user)
})

test('session extraction accepts only a managed session identifier, not role metadata', () => {
  assert.equal(verifiedSessionId(`x.${btoa(JSON.stringify({ session_id: session, role: 'authenticated' }))}.x`), session)
  assert.throws(() => verifiedSessionId(`x.${btoa(JSON.stringify({ role: 'admin' }))}.x`))
})
