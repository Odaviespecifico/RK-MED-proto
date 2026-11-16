import type { SupabaseClient } from '@supabase/supabase-js'
import { PublicError } from './http.ts'
import { trustedRpc } from './backend-rpc.ts'

export type Environment = Record<string, string | undefined>

export function runtimeEnvironment(env: Environment) {
  const name = env.APP_ENV
  if (name !== 'local' && name !== 'sandbox' && name !== 'production') throw new PublicError('Ambiente não configurado.')
  const origin = new URL(env.APP_ORIGIN || '')
  const local = origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname)
  if (!(name === 'local' ? local : origin.protocol === 'https:') || origin.origin !== env.APP_ORIGIN) throw new PublicError('Origem do ambiente inválida.')
  if (name === 'production') {
    const ref = env.APP_PROJECT_REF || ''
    const sandbox = env.SANDBOX_SUPABASE_PROJECT_REF || ''
    if (!/^[a-z0-9]+$/.test(ref) || !/^[a-z0-9]+$/.test(sandbox) || ref === sandbox
      || env.SUPABASE_URL !== `https://${ref}.supabase.co`) throw new PublicError('Projeto de produção não isolado da homologação.')
  }
  return name
}

// The database setting also controls legal documents and synthetic provisioning.
// Never run live providers against a database still configured for tests.
export async function assertDatabaseEnvironment(db: SupabaseClient, env: Environment) {
  const expected = runtimeEnvironment(env)
  const actual = await trustedRpc<string>(db, 'rk_backend_environment')
  if (actual !== expected) throw new PublicError('Banco e serviço pertencem a ambientes diferentes.')
}

export function deliveryAllowed(env: Environment, channel: 'sms' | 'email', contact: string) {
  const production = env.APP_ENV === 'production'
  const key = channel === 'sms' ? (production ? 'SMS_ALLOWED_NUMBERS' : 'SMS_ALLOWED_TEST_NUMBERS')
    : (production ? 'RESEND_ALLOWED_EMAILS' : 'RESEND_ALLOWED_TEST_EMAILS')
  const allowed = (env[key] || '').split(',').map(value => value.trim().toLowerCase())
  return allowed.includes('*') || allowed.includes(contact.toLowerCase())
}
