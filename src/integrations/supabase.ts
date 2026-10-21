import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PublicConfig } from '../lib/config'

let current: { signature: string; client: SupabaseClient } | undefined

export function createSupabase(config: PublicConfig) {
  if (config.mode !== 'sandbox') throw new Error('Cliente real indisponível no modo de demonstração.')
  const signature = JSON.stringify([config.supabaseUrl, config.supabaseKey, config.environment, config.projectRef])
  if (current?.signature === signature) return current.client
  const client = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
      flowType: 'pkce', storageKey: `rkmed-auth-${config.environment}-${config.projectRef || 'local'}`,
    },
  })
  current = { signature, client }
  return client
}
