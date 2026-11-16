import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
export const testDefaults = {
  VITE_APP_MODE: 'sandbox', VITE_APP_ENV: 'local', VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_PROJECT_REF: '',
  VITE_FACE_DETECTION_MIN_CONFIDENCE: '0.8', VITE_GOOGLE_MAPS_EMBED_KEY: '',
  APP_ENV: 'local', APP_ORIGIN: 'http://127.0.0.1:5174',
  STRIPE_TEST_ENV: 'local', STRIPE_TEST_ORIGIN: 'http://127.0.0.1:4242',
  STRIPE_SECRET_KEY: '', STRIPE_TEST_ACCOUNT_ID: '', STRIPE_PRICE_ID: '', STRIPE_WEBHOOK_SECRET: '',
  STRIPE_CLI_WEBHOOK_SECRET: '', STRIPE_WEDEA_ACCOUNT_ID: '', STRIPE_PORTAL_CONFIGURATION_ID: '',
  OTP_HMAC_SECRET: '', JOBS_SECRET: '',
  SMS_ALLOWED_TEST_NUMBERS: '', CLICKSEND_MODE: 'disabled', CLICKSEND_USERNAME: '', CLICKSEND_API_KEY: '',
  RESEND_MODE: 'disabled', RESEND_API_KEY: '', RESEND_FROM: '', RESEND_ALLOWED_TEST_EMAILS: '', OPERATIONS_TEST_EMAIL: '',
}
// Standalone sandbox tools are not part of the hosted application's runtime.
const testToolKeys = new Set(['STRIPE_TEST_ENV', 'STRIPE_TEST_ORIGIN', 'STRIPE_CLI_WEBHOOK_SECRET'])
export const prodDefaults = Object.fromEntries(Object.keys(testDefaults).filter(key => !testToolKeys.has(key)).map(key => [key, '']))
delete prodDefaults.STRIPE_TEST_ACCOUNT_ID
delete prodDefaults.SMS_ALLOWED_TEST_NUMBERS
delete prodDefaults.RESEND_ALLOWED_TEST_EMAILS
delete prodDefaults.OPERATIONS_TEST_EMAIL
Object.assign(prodDefaults, { STRIPE_ACCOUNT_ID: '', APP_PROJECT_REF: '', SANDBOX_SUPABASE_PROJECT_REF: '',
  VITE_SANDBOX_SUPABASE_PROJECT_REF: '', VITE_APP_ORIGIN: '',
  SMS_ALLOWED_NUMBERS: '', RESEND_ALLOWED_EMAILS: '', OPERATIONS_EMAIL: '', VITE_APP_MODE: 'sandbox', VITE_APP_ENV: 'production', APP_ENV: 'production',
  VITE_FACE_DETECTION_MIN_CONFIDENCE: '0.8', CLICKSEND_MODE: 'disabled', RESEND_MODE: 'disabled' })

export function environmentPath(environment, root = projectRoot) {
  if (!['test', 'stage', 'prod'].includes(environment)) throw new Error('Escolha o ambiente test, stage ou prod.')
  return resolve(root, `.env.${environment}`)
}
export function readEnvironment(environment, overrides = process.env, root = projectRoot) {
  const file = environmentPath(environment, root)
  if (environment === 'stage' && !existsSync(file)) throw new Error('Configure .env.stage antes de iniciar o ambiente stage.')
  const values = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {}
  return { ...values, ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)) }
}
export function serializeEnvironment(values) {
  return Object.entries(values).map(([key, value]) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error('Nome de variável de ambiente inválido.')
    const quote = ['"', "'", '`'].find(candidate => !String(value).includes(candidate))
    if (!quote) throw new Error(`Não foi possível serializar ${key} sem alterar seu valor.`)
    return `${key}=${quote}${value}${quote}`
  }).join('\n') + '\n'
}
export function ensureEnvironmentFiles(root = projectRoot) {
  for (const [environment, defaults] of [['test', testDefaults], ['prod', prodDefaults]]) {
    const file = environmentPath(environment, root)
    if (!existsSync(file)) writeFileSync(file, '# RKMED: somente VITE_* é público. Arquivo privado, não versionar.\n' + serializeEnvironment(defaults), { mode: 0o600, flag: 'wx' })
    chmodSync(file, 0o600)
  }
}
