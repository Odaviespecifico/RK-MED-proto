import test from 'node:test'
import assert from 'node:assert/strict'
import { draftKey, saveRegistrationDraft, readRegistrationDraft, clearRegistrationDrafts } from '../src/lib/registration-draft.ts'

test('drafts isolate users and forms, reject sensitive fields, and expire safely', () => {
  const data = new Map()
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
  const a = draftKey('user-a', 'staff'), b = draftKey('user-b', 'staff'), p = draftKey('user-a', 'partner')
  assert.equal(saveRegistrationDraft(a, 1, { email: 'user@example.test', password: 'secret-value' }, ['email', 'password']), true)
  assert.equal(data.get(a).includes('secret-value'), false)
  assert.equal(readRegistrationDraft(a, ['email'], 2).fields.email, 'user@example.test')
  assert.equal(readRegistrationDraft(b, ['email'], 2), null)
  assert.equal(saveRegistrationDraft(p, 0, { name: 'Partner' }, ['name']), true)
  clearRegistrationDrafts('user-a')
  assert.equal(data.size, 0)
  data.set(a, JSON.stringify({ version: 1, step: 0, updatedAt: Date.now() - 86400001, fields: {} }))
  assert.equal(readRegistrationDraft(a, ['email'], 2), null)
  data.set(a, JSON.stringify({ version: 2, step: 0, updatedAt: Date.now(), fields: {} }))
  assert.equal(readRegistrationDraft(a, ['email'], 2), null)
  data.set(a, JSON.stringify({ version: 1, step: 0, updatedAt: Date.now(), fields: { token: 'secret' } }))
  assert.equal(readRegistrationDraft(a, ['email', 'token'], 2), null)
  data.set(a, '{broken')
  assert.equal(readRegistrationDraft(a, ['email'], 2), null)
  globalThis.localStorage = { setItem() { throw new Error('unavailable') }, getItem() { throw new Error('unavailable') }, removeItem() { throw new Error('unavailable') } }
  assert.equal(saveRegistrationDraft(a, 0, { email: 'test' }, ['email']), false)
  assert.equal(readRegistrationDraft(a, ['email'], 2), null)
})
