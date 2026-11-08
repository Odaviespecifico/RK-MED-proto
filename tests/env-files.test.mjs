import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { ensureEnvironmentFiles, readEnvironment, serializeEnvironment, environmentPath } from '../scripts/env/files.mjs'

function isolated(run) {
  const root = mkdtempSync(join(tmpdir(), 'rkmed-env-'))
  try { run(root) } finally { rmSync(root, { recursive: true, force: true }) }
}
test('environment initialization preserves configured files and keeps production credentials separate', () => isolated(root => {
  const configured = 'STRIPE_SECRET_KEY="rk_test_synthetic_only"\n'
  writeFileSync(join(root, '.env.test'), configured)
  ensureEnvironmentFiles(root)
  assert.equal(readFileSync(join(root, '.env.test'), 'utf8'), configured)
  const prod = readEnvironment('prod', {}, root)
  assert.equal(prod.APP_ENV, 'production')
  assert.equal(prod.STRIPE_SECRET_KEY, '')
  assert.equal(statSync(join(root, '.env.test')).mode & 0o777, 0o600)
  assert.equal(statSync(join(root, '.env.prod')).mode & 0o777, 0o600)
}))
test('test and prod read exactly their own file, ignoring legacy automatic dotenv files', () => isolated(root => {
  writeFileSync(join(root, '.env.test'), 'APP_ENV=local\nPRIVATE_KEY=test-only\n')
  writeFileSync(join(root, '.env.prod'), 'APP_ENV=production\nPRIVATE_KEY=prod-only\n')
  writeFileSync(join(root, '.env.local'), 'LEGACY_KEY=must-not-load\n')
  assert.deepEqual(readEnvironment('test', {}, root), { APP_ENV: 'local', PRIVATE_KEY: 'test-only' })
  assert.deepEqual(readEnvironment('prod', {}, root), { APP_ENV: 'production', PRIVATE_KEY: 'prod-only' })
  assert.throws(() => environmentPath('staging', root))
}))
test('secret-store variables override files without importing undefined values', () => isolated(root => {
  writeFileSync(join(root, '.env.test'), 'PRIVATE_KEY=file-key\nKEEP=present\n')
  assert.deepEqual(readEnvironment('test', { PRIVATE_KEY: 'ci-key', KEEP: undefined }, root), { PRIVATE_KEY: 'ci-key', KEEP: 'present' })
}))
test('consolidation preserves literal dollar signs, hashes, quotes, equals signs and multiline secrets', () => {
  const values = { SECRET: '$secret#literal=value', DOUBLE_QUOTE: 'a"b', SINGLE_QUOTE: "a'b", NEWLINE: 'first\nsecond', EMPTY: '' }
  assert.deepEqual(parseEnv(serializeEnvironment(values)), values)
})
