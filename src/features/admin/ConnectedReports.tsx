import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Portal } from '../../integrations/portal'
import type { PublicPartner } from '../../integrations/contracts'
import { purchasesCsv, recifeDate, reportMoney, type PurchaseReport, type ReportFilter } from '../../lib/reports'
import { Button } from '../../components/ui/button'

export function ConnectedReports({ api, viewer, online }: { api: Portal; viewer: boolean; online: boolean }) {
  const today = recifeDate()
  const [filter, setFilter] = useState<ReportFilter>({ from: today.slice(0, 8) + '01', to: today, partnerId: null })
  const [partners, setPartners] = useState<PublicPartner[]>([])
  const [report, setReport] = useState<PurchaseReport | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const generation = useRef(0)
  useEffect(() => {
    let active = true
    api.staffPartners().then(rows => { if (active) setPartners(rows) }).catch(() => { if (active) setError('Não foi possível carregar os parceiros.') })
    return () => { active = false; generation.current++ }
  }, [api])
  function change(next: ReportFilter) {
    generation.current++; setFilter(next); setReport(null); setConfirm(false); setError(''); setNotice('')
  }
  async function query(event: FormEvent) {
    event.preventDefault()
    if (!online || busy) return
    const revision = ++generation.current
    setBusy(true); setError(''); setNotice(''); setReport(null); setConfirm(false)
    try { const result = await api.report(filter); if (revision === generation.current) setReport(result) }
    catch (e) { if (revision === generation.current) setError(e instanceof Error ? e.message : 'Não foi possível gerar o relatório.') }
    finally { setBusy(false) }
  }
  async function download() {
    if (!report || viewer || !online || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api.exportPurchases({ from: report.from, to: report.to, partnerId: report.partnerId })
      const url = URL.createObjectURL(new Blob([purchasesCsv(result)], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url; link.download = `rkmed-compras-${result.from}-${result.to}.csv`
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice(`CSV gerado com ${result.rows.length} registro(s). A exportação foi auditada.`); setConfirm(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível exportar.') }
    finally { setBusy(false) }
  }
  return <section className="surface-card counter-flow">
    <h2>Relatório de compras e economia</h2>
    <p>Período pela data da compra em Recife. Estornos registrados até a consulta são excluídos dos totais, mesmo quando feitos depois do período. Estes valores são compras nos parceiros, não receita de assinaturas.</p>
    <form onSubmit={query}>
      <label className="field-label">Data inicial<input className="input" type="date" required value={filter.from} disabled={busy} onChange={e => change({ ...filter, from: e.target.value })} /></label>
      <label className="field-label">Data final<input className="input" type="date" required value={filter.to} disabled={busy} onChange={e => change({ ...filter, to: e.target.value })} /></label>
      <label className="field-label">Filtrar parceiro<select className="input" value={filter.partnerId || ''} disabled={busy} onChange={e => change({ ...filter, partnerId: e.target.value || null })}>
        <option value="">Todos os parceiros</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <Button type="submit" disabled={busy || !online}>{busy ? 'Processando...' : 'Consultar relatório'}</Button>
    </form>
    {error && <p role="alert" className="inline-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {report && <>
      <p>Consulta: {new Date(report.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Recife' })}</p>
      <dl>
        <div className="dash-row"><dt>Registros no período</dt><dd>{report.totals.recordedCount}</dd></div>
        <div className="dash-row"><dt>Compras válidas</dt><dd>{report.totals.validCount}</dd></div>
        <div className="dash-row"><dt>Compras estornadas</dt><dd>{report.totals.reversedCount}</dd></div>
        <div className="dash-row"><dt>Valor bruto válido</dt><dd>{reportMoney(report.totals.grossCents)}</dd></div>
        <div className="dash-row"><dt>Economia válida</dt><dd>{reportMoney(report.totals.discountCents)}</dd></div>
        <div className="dash-row"><dt>Valor final válido</dt><dd>{reportMoney(report.totals.finalCents)}</dd></div>
      </dl>
      {report.totals.recordedCount === 0 && <p>Nenhuma compra neste período.</p>}
      {!viewer && <Button variant="outline" disabled={busy || !online} onClick={() => setConfirm(true)}>Exportar CSV</Button>}
    </>}
    {confirm && report && <div role="region" aria-label="Confirmar exportação">
      <p>Exportar compras de {report.from} a {report.to}? O arquivo contém nomes, CPF mascarado e valores, incluindo registros estornados. O limite é de 5.000 registros; reduza o período se necessário. Os dados serão consultados novamente no momento da exportação.</p>
      <Button disabled={busy || !online} onClick={() => void download()}>Confirmar exportação</Button>
      <Button variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>Cancelar exportação</Button>
    </div>}
  </section>
}
