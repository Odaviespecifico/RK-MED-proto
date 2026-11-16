import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { localClients, login } from '../../scripts/dev/local.mjs'
const local = localClients()
const admin = await login(local, 'admin@rkmed.test')
const prefix = `Employee concurrency ${randomUUID()}`
const created = []
try {
  await admin.rpc('rk_context')
  const results = await Promise.allSettled(Array.from({ length: 3 }, (_, i) => admin.rpc('rk_create_partner_employee', { p_partner: '10000000-0000-4000-8000-000000000001', p_name: `${prefix} ${i}` })))
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.data) created.push(result.value.data)
  }
  assert.equal(created.length, 3)
  assert.equal(new Set(created.map(item => item.code)).size, 3)
  assert.ok(created.every(item => /^\d{4}$/.test(item.code) && item.code !== '2468'))
  const other = await admin.rpc('rk_partner_employees', { p_partner: '10000000-0000-4000-8000-000000000002' })
  assert.equal(other.error, null)
  assert.ok(!other.data.some(item => item.name.startsWith(prefix)))
  console.log('PASS: três cadastros concorrentes emitiram códigos distintos de quatro dígitos; outro parceiro não recebe os funcionários.')
} finally {
  // Remove only this local run's employees. Audit records remain append-only.
  for (const item of created) {
    assert.match(item.id, /^[a-f0-9-]{36}$/)
    execFileSync('docker', ['exec', 'supabase_db_rkmed', 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-c', `delete from private.employees where id='${item.id}' and name like 'Employee concurrency %';`], { stdio: 'pipe' })
  }
  await admin.auth.signOut({ scope: 'local' })
}
