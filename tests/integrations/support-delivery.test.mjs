import test from 'node:test'
import assert from 'node:assert/strict'
import { deliverNotifications } from '../../supabase/functions/_shared/notifications.ts'
import { createResendSandbox } from '../../supabase/functions/_shared/providers/resend.ts'

const item = { id: 'message-id', memberId: 'member-id', reference: 'ticket-id', kind: 'support.answer', key: 'support.answer:ticket-id' }
const env = { APP_ORIGIN: 'https://rkmed.example' }
test('support replies use the verified member email and are delivered without any Stripe calls', async () => {
  const calls = []; let sent
  const db = { rpc: async (name, args) => {
    calls.push({ name, args })
    return { error: null, data: name === 'rk_backend_claim_delivery' ? true : name === 'rk_backend_support_reply' ? { email: 'member@example.invalid', response: 'Sua solicitação foi resolvida.' } : null }
  } }
  const failures = await deliverNotifications(db, env, [item], async () => { throw Error('Stripe must not be called') }, async (...args) => { sent = args; return { messageId: 'accepted-id' } })
  assert.equal(failures, 0)
  assert.equal(sent[0], 'member@example.invalid')
  assert.equal(sent[1], 'RKMED — resposta do suporte')
  assert.match(sent[2], /Sua solicitação foi resolvida/)
  assert.match(sent[2], /https:\/\/rkmed.example\/app\/conta/)
  assert.equal(sent[3], 'outbox/message-id')
  assert.deepEqual(calls.find(c => c.name === 'rk_backend_support_reply').args, { p_request: 'ticket-id', p_member: 'member-id' })
  assert.equal(calls.at(-1).args.p_provider, 'accepted-id')
  assert.equal(calls.at(-1).args.p_success, true)
})

test('failed/uncertain support sends are retried with identical provider idempotency keys and never marked sent', async () => {
  const completed = []; const keys = []
  const db = { rpc: async (name, args) => {
    if (name === 'rk_backend_complete_delivery') completed.push(args)
    return { error: null, data: name === 'rk_backend_claim_delivery' ? true : name === 'rk_backend_support_reply' ? { email: 'member@example.invalid', response: 'Resposta estável' } : null }
  } }
  for (let n = 0; n < 2; n++) assert.equal(await deliverNotifications(db, env, [item], async () => {}, async (_to, _subject, _text, key) => { keys.push(key); throw Error('private provider error') }), 1)
  assert.deepEqual(keys, ['outbox/message-id', 'outbox/message-id'])
  assert.ok(completed.every(c => c.p_success === false && c.p_provider === null))
})

test('another worker lease or a mismatched support ownership response never sends an email', async () => {
  let sends = 0
  for (const claim of [false, true]) {
    const db = { rpc: async name => ({ error: null, data: name === 'rk_backend_claim_delivery' ? claim : null }) }
    assert.equal(await deliverNotifications(db, env, [item], async () => {}, async () => { sends++; return { messageId: 'id' } }), claim ? 1 : 0)
  }
  assert.equal(sends, 0)
})

test('email transport requires a provider receipt even after HTTP 200', async () => {
  const settings = { APP_ENV: 'sandbox', RESEND_MODE: 'transactional-sandbox', RESEND_API_KEY: 'synthetic-key', RESEND_FROM: 'rkmed@example.invalid', RESEND_ALLOWED_TEST_EMAILS: '*' }
  await assert.rejects(() => createResendSandbox(settings, async () => Response.json({})).send('m@example.invalid', 'Resposta', 'Teste', 'op'))
  assert.deepEqual(await createResendSandbox(settings, async () => Response.json({ id: 'accepted-id' })).send('m@example.invalid', 'Resposta', 'Teste', 'op'), { messageId: 'accepted-id' })
})
