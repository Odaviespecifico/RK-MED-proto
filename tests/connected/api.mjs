import assert from 'node:assert/strict'
import { localClients, login } from '../../scripts/dev/local.mjs'
const local = localClients()
async function rpc(client, name, params) { const { data, error } = await client.rpc(name, params); assert.equal(error, null, `${name}: ${error?.message}`); return data }
const [member, partner, other, support, viewer] = await Promise.all(['ana@rkmed.test', 'parceiro@rkmed.test', 'outro-parceiro@rkmed.test', 'suporte@rkmed.test', 'diretoria@rkmed.test'].map(email => login(local, email)))
try {
  const context = await rpc(member, 'rk_context')
  assert.equal(context.role, 'member'); assert.equal(context.member.cpf, '***.***.***-09')
  assert.equal((await member.rpc('rk_backend_member', { p_member: context.userId })).error?.code, '42501')
  assert.equal((await member.rpc('rk_admin_members')).error?.code, '42501')
  assert.equal((await viewer.rpc('rk_set_block', { p_member: context.userId, p_blocked: true, p_reason: 'Teste negado' })).error?.code, '42501')
  const profiles = await rpc(viewer, 'rk_admin_members')
  assert.ok(profiles.every(m => m.email === null && m.phone === null && m.invoiceId === null && /^\*{3}/.test(m.cpf)))
  const ownPhoto = await member.storage.from('member-photos').createSignedUrl(context.member.photoPath, 60)
  assert.equal(ownPhoto.error, null, `Foto própria: ${ownPhoto.error?.message}`)
  const wrongPhoto = await other.storage.from('member-photos').createSignedUrl(context.member.photoPath, 60)
  assert.ok(wrongPhoto.error, 'Foto não pode ser acessada por outro parceiro')
  await rpc(partner, 'rk_start_work', { p_code: '2468' })
  const validation = await rpc(partner, 'rk_validate_member', { p_lookup: context.member.cardToken, p_method: 'qr' })
  assert.equal(validation.eligible, true)
  const photo = await partner.storage.from('member-photos').createSignedUrl(validation.photoPath, 60)
  assert.equal(photo.error, null, `Foto do atendimento: ${photo.error?.message}`)
  const quote = await rpc(partner, 'rk_quote', { p_receipt: validation.receipt, p_gross: 20000 })
  assert.deepEqual(quote, { grossCents: 20000, discountBps: 2000, discountCents: 4000, finalCents: 16000 })
  const args = { p_receipt: validation.receipt, p_gross: quote.grossCents, p_quote_bps: quote.discountBps, p_operation: crypto.randomUUID() }
  const duplicates = await Promise.all(Array.from({ length: 8 }, () => rpc(partner, 'rk_commit_purchase', args)))
  assert.equal(new Set(duplicates.map(r => r.id)).size, 1)
  assert.equal(duplicates.filter(r => !r.duplicate).length, 1)
  assert.ok((await rpc(member, 'rk_purchases')).some(r => r.id === duplicates[0].id))
  assert.ok(!(await rpc(other, 'rk_purchases')).some(r => r.id === duplicates[0].id))
  const reversal = await rpc(support, 'rk_reverse_purchase', { p_purchase: duplicates[0].id, p_reason: 'Correção do teste HTTP local' })
  assert.ok(reversal)
  assert.equal(await rpc(support, 'rk_reverse_purchase', { p_purchase: duplicates[0].id, p_reason: 'Correção do teste HTTP local' }), reversal)
  console.log('PASS: Auth real local, RPCs, CPF mascarado, perfis, Storage privado, 8 commits concorrentes e estorno idempotente.')
} finally {
  await partner.rpc('rk_end_work')
  await Promise.all([member, partner, other, support, viewer].map(client => client.auth.signOut()))
}
