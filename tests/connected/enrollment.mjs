import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import jpeg from 'jpeg-js'
import { localClients, login } from '../../scripts/dev/local.mjs'
const local = localClients()
const client = await login(local, 'novo@rkmed.test')
async function rpc(name, args) { const { data, error } = await client.rpc(name, args); assert.equal(error, null, `${name}: ${error?.message}`); return data }
try {
  const initial = await rpc('rk_context')
  const docs = await rpc('rk_documents')
  const params = { p_name: 'Beatriz Teste Local', p_cpf: '52998224725', p_birth: '1990-01-01', p_versions: docs.map(d => d.version) }
  if (initial.role === 'pending') {
    const denied = await client.rpc('rk_enroll', params)
    assert.ok(denied.error, 'E-mail sozinho não pode concluir cadastro')
    const changed = await client.auth.updateUser({ phone: '+12025550123' })
    assert.equal(changed.error, null, `Telefone local: ${changed.error?.message}`)
    const confirmed = await client.auth.verifyOtp({ phone: '+12025550123', token: '482913', type: 'phone_change' })
    assert.equal(confirmed.error, null, `Verificação local: ${confirmed.error?.message}`)
    assert.ok((await client.rpc('rk_enroll', { ...params, p_versions: [] })).error, 'Sem aceite não pode cadastrar')
    await rpc('rk_enroll', params)
  }
  const context = await rpc('rk_context')
  assert.equal(context.role, 'member'); assert.equal(context.member.eligible, false); assert.equal(context.member.billingState, 'incomplete')
  assert.equal(context.member.cpf, '***.***.***-25')
  const original = jpeg.decode(await readFile(new URL('../fixtures/face-portrait.jpg', import.meta.url)))
  const rgba = new Uint8Array(600 * 600 * 4)
  for (let y = 0; y < 600; y++) for (let x = 0; x < 600; x++) { const p = (Math.floor(y * original.height / 600) * original.width + Math.floor(x * original.width / 600)) * 4; rgba.set(original.data.subarray(p, p + 4), (y * 600 + x) * 4) }
  const photo = `data:image/jpeg;base64,${Buffer.from(jpeg.encode({ data: rgba, width: 600, height: 600 }, 90).data).toString('base64')}`
  const { data: { session } } = await client.auth.getSession()
  const call = body => fetch(`${local.url}/functions/v1/rkmed-api`, { method: 'POST', headers: { Origin: 'http://127.0.0.1:5174', apikey: local.key, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })
  const uploaded = await call({ action: 'photo', photo })
  assert.equal(uploaded.status, 200, `Foto Edge: ${await uploaded.text()}`)
  const card = await rpc('rk_context')
  assert.equal(card.member.photoPath, `${context.userId}/photo.jpg`)
  assert.equal((await client.storage.from('member-photos').download(card.member.photoPath)).error, null)
  const checkout = await call({ action: 'checkout', operationId: crypto.randomUUID() })
  if (checkout.status === 200) {
    const body = await checkout.json()
    assert.equal(body.livemode, false)
    assert.match(body.url, /^https:\/\/checkout\.stripe\.com\//)
  } else {
    assert.equal(checkout.status, 400, 'Checkout sem provedor configurado deve ser recusado explicitamente')
  }
  assert.equal((await rpc('rk_context')).member.eligible, false)
  console.log('PASS: mesma identidade com e-mail+telefone, aceites versionados, CPF protegido, foto validada pela Edge real e cadastro inativo sem confirmação de pagamento.')
} finally { await client.auth.signOut() }
