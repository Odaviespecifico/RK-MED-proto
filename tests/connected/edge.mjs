import assert from 'node:assert/strict'
import { localClients, login } from '../../scripts/dev/local.mjs'
const local = localClients()
const client = await login(local, 'diretoria@rkmed.test')
try {
  const { data: { session } } = await client.auth.getSession()
  const headers = { Origin: 'http://127.0.0.1:5174', 'Content-Type': 'application/json', apikey: local.key }
  const call = (body, authorization) => fetch(`${local.url}/functions/v1/rkmed-api`, { method: 'POST', headers: { ...headers, ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })
  assert.equal((await call({ action: 'staff' })).status, 401)
  assert.equal((await call({ action: 'staff' }, session.access_token)).status, 403)
  assert.equal((await call({ action: 'collection' }, session.access_token)).status, 403)
  const webhook = await fetch(`${local.url}/functions/v1/stripe-webhook`, { method: 'POST', body: '{}', signal: AbortSignal.timeout(60000) })
  assert.ok([400, 503].includes(webhook.status))
  const removedChannel = await fetch(`${local.url}/functions/v1/phone-code`, {
    method: 'POST', headers,
    body: JSON.stringify({ action: 'request', contact: '+12025550123', channel: 'whatsapp', purpose: 'login' }),
    signal: AbortSignal.timeout(60000),
  })
  assert.ok([400, 503].includes(removedChannel.status), 'Removed channel must never produce a successful delivery')
  console.log('PASS: Edge Functions locais rejeitam usuário ausente, diretoria privilegiada e webhook sem configuração/assinatura.')
} finally { await client.auth.signOut() }
