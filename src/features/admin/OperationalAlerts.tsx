import { useEffect, useState } from 'react'
import type { Portal } from '../../integrations/portal'
import type { OperationalConnection, OperationalSummary } from '../../integrations/operational'
import { Button } from '../../components/ui/button'

export function OperationalAlerts({ api, online, openCollections }: { api: Portal; online: boolean; openCollections: () => void }) {
  const [summary, setSummary] = useState<OperationalSummary | null>(null)
  const [connection, setConnection] = useState<OperationalConnection>('connecting')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setSummary(null); setError(''); setConnection('connecting')
    if (!online) return
    let active = true
    let loading = false
    let dirty = false
    let debounce: number | undefined
    async function refresh() {
      if (!active) return
      if (loading) { dirty = true; return }
      loading = true
      try {
        const value = await api.operationalSummary()
        if (active) { setSummary(value); setError('') }
      } catch (e) {
        if (active) { setSummary(null); setError(e instanceof Error ? e.message : 'Não foi possível verificar os alertas.') }
      } finally {
        loading = false
        if (active && dirty) { dirty = false; schedule() }
      }
    }
    function schedule() {
      if (!active || debounce !== undefined) return
      debounce = window.setTimeout(() => { debounce = undefined; void refresh() }, 200)
    }
    const stop = api.watchOperations(schedule, setConnection)
    void refresh()
    const visible = () => { if (document.visibilityState === 'visible') schedule() }
    const fallback = window.setInterval(() => { if (document.visibilityState === 'visible') schedule() }, 30000)
    document.addEventListener('visibilitychange', visible)
    return () => {
      active = false; window.clearTimeout(debounce); window.clearInterval(fallback)
      document.removeEventListener('visibilitychange', visible); stop()
    }
  }, [api, online, attempt])
  const hasAlerts = summary && (summary.paymentFailures > 0 || summary.deliveryFailures > 0 || summary.exhaustedDeliveries > 0 || summary.riskReviews > 0 || summary.webhookFailures > 0)
  return <section className="surface-card counter-flow" aria-label="Alertas operacionais">
    <h2>Alertas operacionais</h2>
    <p role="status">{!online ? 'Conecte-se para verificar os alertas.' : error ? 'Alertas indisponíveis. Verifique sua sessão e conexão.' : !summary ? 'Verificando alertas...' : connection === 'connected' ? 'Alertas conectados em tempo real.' : connection === 'connecting' ? 'Conectando as atualizações em tempo real...' : 'Conexão em tempo real interrompida. Atualização automática a cada 30 segundos enquanto a conexão é restabelecida.'}</p>
    {error && <p role="alert" className="inline-error">{error}</p>}
    {summary && <>
      <p>Última verificação: {new Date(summary.checkedAt).toLocaleString('pt-BR', { timeZone: 'America/Recife' })}</p>
      <div aria-live="polite" aria-atomic="true">
        {!hasAlerts ? <p>Nenhum alerta operacional no momento.</p> : <ul>
          <li>Pagamentos pendentes: <strong data-alert="paymentFailures">{summary.paymentFailures}</strong></li>
          <li>Falhas no envio: <strong data-alert="deliveryFailures">{summary.deliveryFailures}</strong></li>
          <li>Envios com tentativas esgotadas: <strong data-alert="exhaustedDeliveries">{summary.exhaustedDeliveries}</strong></li>
          <li>Sinais para revisão operacional: <strong data-alert="riskReviews">{summary.riskReviews}</strong></li>
          <li>Falhas no processamento de eventos: <strong data-alert="webhookFailures">{summary.webhookFailures}</strong></li>
        </ul>}
      </div>
      <p>As categorias podem se sobrepor. Envio aceito pelo provedor não encerra revisão de risco e não confirma entrega.</p>
    </>}
    <div className="row-actions">
      <Button variant="outline" disabled={!online} onClick={() => setAttempt(value => value + 1)}>Verificar alertas</Button>
      <Button variant="ghost" disabled={!online} onClick={openCollections}>Abrir cobranças e fila</Button>
    </div>
  </section>
}
