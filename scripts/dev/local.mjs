import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

// Never print the status JSON: it contains local privileged credentials.
export function localClients() {
  const status = JSON.parse(execFileSync('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
  const url = new URL(status.API_URL)
  if (url.origin !== 'http://127.0.0.1:54321') throw new Error('Esta ferramenta aceita somente o Supabase Docker local.')
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  return { url: url.origin, key: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY, service: createClient(url.origin, status.SERVICE_ROLE_KEY, options), client: () => createClient(url.origin, status.ANON_KEY, options) }
}
export const fixturePassword = 'RKMED-local-test-2026!'
export async function login(local, email) {
  const client = local.client()
  const { error } = await client.auth.signInWithPassword({ email, password: fixturePassword })
  if (error) throw new Error(`Falha na autenticação da fixture ${email}: ${error.code}`)
  return client
}

// Resolve synthetic establishment identifiers through the same authorized RPC as administration.
export async function establishmentCode(local, partnerClient) {
  const support = await login(local, 'suporte@rkmed.test')
  try {
    const context = await partnerClient.rpc('rk_context')
    const partners = await support.rpc('rk_staff_partners')
    if (context.error || partners.error) throw new Error('Não foi possível consultar o código da fixture local.')
    const code = partners.data.find(p => p.id === context.data.partnerId)?.establishmentCode
    if (!code) throw new Error('Código de estabelecimento da fixture ausente.')
    return code
  } finally { await support.auth.signOut({ scope: 'local' }) }
}
