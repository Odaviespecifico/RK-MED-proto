import type { SupabaseClient } from '@supabase/supabase-js'
import { PublicError } from './http.ts'

export async function trustedRpc<T>(db: SupabaseClient, name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args)
  if (error) throw new PublicError(`Não foi possível concluir ${name.replace(/^rk_/, '')}.`)
  return data as T
}
