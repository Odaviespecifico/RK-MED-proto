import { authStorage, authStorageKey } from './auth-storage'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PublicConfig } from '../lib/config'

let current: { signature: string; client: SupabaseClient } | undefined

export function createSupabase(config: PublicConfig) {
  if (config.mode !== 'sandbox') throw new Error('Cliente real indisponível neste modo.')
  const signature = JSON.stringify([config.supabaseUrl, config.supabaseKey, config.environment, config.projectRef])
  if (current?.signature === signature) return current.client
  const storageKey = authStorageKey(config.environment, config.projectRef)
  // Migrate an outstanding legacy recovery verifier even before it is used.
  void authStorage.getItem(`${storageKey}-code-verifier`)
  const client = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
      flowType: 'pkce', storage: authStorage, storageKey,
    },
  })
  current = { signature, client }
  return client
}
