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
