import test from 'node:test'
import assert from 'node:assert/strict'
import { createClickSend } from '../../supabase/functions/_shared/providers/clicksend.ts'
import { publicBuildEnvironment } from '../../src/lib/config.ts'
import { createResendSandbox } from '../../supabase/functions/_shared/providers/resend.ts'

const to = '+5581999990001'
const reference = 'a0000000-0000-4000-8000-000000000001'
const env = { APP_ENV: 'sandbox', CLICKSEND_MODE: 'test', CLICKSEND_USERNAME: 'synthetic-user', CLICKSEND_API_KEY: 'synthetic-secret', SMS_ALLOWED_TEST_NUMBERS: to }
const accepted = { response_code: 'SUCCESS', data: { messages: [{ status: 'SUCCESS', message_id: reference, to }] } }

test('ClickSend uses server Basic authentication, one short SMS and an opaque correlation id', async () => {
  let calls = 0
  const sender = createClickSend(env, async (url, options) => {
    calls++
    assert.equal(url, 'https://rest.clicksend.com/v3/sms/send')
    assert.equal(options.method, 'POST')
    assert.equal(options.redirect, 'error')
    assert.equal(options.headers.Authorization, `Basic ${btoa('synthetic-user:synthetic-secret')}`)
    const { messages } = JSON.parse(options.body)
    assert.equal(messages.length, 1)
    assert.equal(messages[0].to, to)
    assert.equal(messages[0].custom_string, reference)
    assert.match(messages[0].body, /123456/)
    assert.ok(messages[0].body.length <= 160)
    return Response.json(accepted)
  })
  assert.deepEqual(await sender.sendCode(to, '123456', reference), { messageId: reference })
  assert.equal(calls, 1)
})

test('ClickSend rejects disabled/live/unlisted requests before calling the provider', async () => {
  let calls = 0
  const transport = async () => { calls++; return Response.json(accepted) }
  for (const change of [{ CLICKSEND_MODE: 'disabled' }, { APP_ENV: 'production' }, { CLICKSEND_USERNAME: '' }, { CLICKSEND_API_KEY: '' }, { SMS_ALLOWED_TEST_NUMBERS: '' }]) {
    await assert.rejects(() => createClickSend({ ...env, ...change }, transport).sendCode(to, '123456', reference))
  }
  await assert.rejects(() => createClickSend(env, transport).sendCode('+5581999990002', '123456', reference))
  await assert.rejects(() => createClickSend(env, transport).sendCode(to, 'invalid', reference))
  assert.equal(calls, 0)
})

test('HTTP 200 alone never means SMS accepted; uncertain sends are not retried or leaked', async () => {
  for (const response of [Response.json({ response_code: 'SUCCESS', data: { messages: [{ status: 'INSUFFICIENT_CREDIT', to, message_id: reference }] } }),
    Response.json({ response_code: 'INVALID_CREDENTIALS', response_msg: 'synthetic-secret' }),
    Response.json({ ...accepted, data: { messages: [{ ...accepted.data.messages[0], to: '+5581999990002' }] } }),
    Response.json({ response_code: 'SUCCESS', data: { messages: [] } }),
    new Response('invalid JSON'), new Response('synthetic-secret', { status: 401 })]) {
    let calls = 0
    await assert.rejects(() => createClickSend(env, async () => { calls++; return response }).sendCode(to, '123456', reference), error => !error.message.includes('synthetic-secret'))
    assert.equal(calls, 1)
  }
  let calls = 0
  await assert.rejects(() => createClickSend(env, async () => { calls++; throw Error('synthetic-secret') }).sendCode(to, '123456', reference), error => !error.message.includes('synthetic-secret'))
  assert.equal(calls, 1)
})

test('hosted build overrides demo/local mode and refuses missing/mismatched remote configuration', () => {
  const values = { VITE_APP_MODE: 'demo', VITE_APP_ENV: 'local', VITE_SUPABASE_URL: 'https://testref.supabase.co', VITE_SUPABASE_PROJECT_REF: 'testref', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic', CLICKSEND_API_KEY: 'private' }
  const result = publicBuildEnvironment(values, 'hosted')
  assert.equal(result.config.mode, 'sandbox')
  assert.equal(result.config.environment, 'sandbox')
  assert.equal('CLICKSEND_API_KEY' in result.env, false)
  assert.throws(() => publicBuildEnvironment({ ...values, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }, 'hosted'))
  assert.throws(() => publicBuildEnvironment({ ...values, VITE_SUPABASE_PUBLISHABLE_KEY: '' }, 'hosted'))
  assert.throws(() => publicBuildEnvironment({ ...values, VITE_CLICKSEND_API_KEY: 'private' }, 'hosted'))
  assert.equal(publicBuildEnvironment({ ...values, VITE_APP_ENV: 'sandbox' }, 'demo').config.mode, 'demo')
})

test('explicit wildcard opens homologation contacts while retaining channel validation and production guards', async () => {
  const other = '+5581999990002'
  let smsCalls = 0
  const sms = createClickSend({ ...env, SMS_ALLOWED_TEST_NUMBERS: '*' }, async () => {
    smsCalls++
    return Response.json({ response_code: 'SUCCESS', data: { messages: [{ status: 'SUCCESS', message_id: reference, to: other }] } })
  })
  assert.equal((await sms.sendCode(other, '123456', reference)).messageId, reference)
  await assert.rejects(() => sms.sendCode('+12025550123', '123456', reference))
  assert.equal(smsCalls, 1)
  let emails = 0
  const emailEnv = { APP_ENV: 'sandbox', RESEND_MODE: 'transactional-sandbox', RESEND_API_KEY: 'synthetic', RESEND_FROM: 'no-reply@example.invalid', RESEND_ALLOWED_TEST_EMAILS: '*' }
  const mail = createResendSandbox(emailEnv, async () => { emails++; return Response.json({ id: reference }) })
  await mail.send('new@example.invalid', 'Código', 'Teste', reference, '123456')
  await assert.rejects(() => mail.send('invalid', 'Código', 'Teste', reference, '123456'))
  await assert.rejects(() => createResendSandbox({ ...emailEnv, APP_ENV: 'production' }).send('new@example.invalid', 'Código', 'Teste', reference))
  assert.equal(emails, 1)
})
