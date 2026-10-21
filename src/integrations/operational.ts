import type { SupabaseClient } from '@supabase/supabase-js'

export type OperationalSummary = {
  checkedAt: string; paymentFailures: number; deliveryFailures: number
  exhaustedDeliveries: number; riskReviews: number; webhookFailures: number
}
export type OperationalConnection = 'connecting' | 'connected' | 'interrupted'

export function watchOperations(client: SupabaseClient, changed: () => void, state: (value: OperationalConnection) => void) {
  let active = true
  const channel = client.channel(`rkmed-operations-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rk_operational_signal', filter: 'id=eq.1' }, () => { if (active) changed() })
    .subscribe(status => {
      if (!active) return
      state(status === 'SUBSCRIBED' ? 'connected' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'interrupted' : 'connecting')
      if (status === 'SUBSCRIBED') changed() // Re-query on reconnect; signals are not a durable event log.
    })
  return () => { active = false; void client.removeChannel(channel) }
}
