import type { SupabaseClient } from '@supabase/supabase-js'
import { IntegrationError } from './contracts.ts'

// Contract for the future authenticated Edge Function. No browser-selected price/member/role.
export function createSandboxBilling(client: SupabaseClient) {
  return {
    async createCheckout(operationId: string): Promise<{ url: string }> {
      if (!/^[0-9a-f-]{36}$/i.test(operationId)) throw new IntegrationError('Operação de pagamento inválida.')
      const { data: session, error: authError } = await client.auth.getSession()
      if (authError || !session.session) throw new IntegrationError('Entre antes de abrir o pagamento.')
      const { data, error } = await client.functions.invoke('rkmed-api', { body: { action: 'checkout', operationId } })
      if (error || !data || data.livemode !== false || typeof data.url !== 'string') {
        throw new IntegrationError('O pagamento ainda não está disponível. Nenhum benefício foi ativado.')
      }
      let url: URL
      try { url = new URL(data.url) } catch { throw new IntegrationError('Resposta de pagamento inválida.') }
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) {
        throw new IntegrationError('Destino de pagamento inválido.')
      }
      return { url: url.href }
    },
  }
}
