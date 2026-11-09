import test from 'node:test'
import assert from 'node:assert/strict'
import { portal, PortalConnectionError } from '../../src/integrations/portal.ts'

test('offline fallback distinguishes lost transport from expired sessions and denied permissions', async () => {
  const offline = portal({ rpc: async () => ({ data: null, status: 0, error: { message: 'Failed to fetch' } }) })
  await assert.rejects(offline.context(), PortalConnectionError)
  for (const status of [401, 403, 500]) {
    const denied = portal({ rpc: async () => ({ data: null, status, error: { code: '42501', message: 'Acesso negado' } }) })
    await assert.rejects(denied.context(), error => !(error instanceof PortalConnectionError))
  }
})

test('work entry sends the establishment code and employee code without selecting a partner id', async () => {
  let captured
  const api = portal({ rpc: async (name, params) => { captured = { name, params }; return { data: { role: 'partner' }, status: 200, error: null } } })
  await api.startWork('2468', ' ab12345678 ')
  assert.deepEqual(captured, { name: 'rk_start_work', params: { p_code: '2468', p_establishment_code: 'AB12345678' } })
})
