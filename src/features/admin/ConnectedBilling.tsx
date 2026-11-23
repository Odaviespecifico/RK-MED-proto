import { useEffect, useState } from 'react'
import { ArrowRight, CircleAlert, CreditCard, Landmark, ReceiptText, TrendingUp, Users } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'
import type { AdminBillingOverview, Portal } from '../../integrations/portal'
import { shortDate } from '../../lib/format'
import { reportMoney } from '../../lib/reports'
import { buildRevenueBars, buildStatusDonut, wedeaProgress, wedeaStatusLabel } from '../../lib/billing-metrics'

const PERIODS = [3, 6, 12] as const

export function ConnectedBilling({ api, online, viewer, go, revision }: { api: Portal; online: boolean; viewer: boolean; go: (path: string) => void; revision: number }) {
  const [months, setMonths] = useState<number>(6)
  const [data, setData] = useState<AdminBillingOverview | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!online) return
    let active = true
    setLoading(true); setError('')
    api.adminBilling(months)
      .then(value => {
        if (!active) return
        setData(value)
        setSelectedMonth(value.monthlySeries[value.monthlySeries.length - 1]?.month ?? null)
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os dados de faturamento.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, online, months, revision])

  if (!online) return <p className="member-note" role="status">Conecte-se para consultar os dados de faturamento.</p>
  if (loading && !data) return <section className="admin-loading" role="status" aria-label="Carregando faturamento"><span>Carregando dados de faturamento</span><div>{[0, 1, 2, 3].map(item => <i key={item} />)}</div></section>
  if (error && !data) return <p role="alert" className="inline-error">{error}</p>
  if (!data) return null

  const bars = buildRevenueBars(data.monthlySeries)
  const activeBar = bars.find(bar => bar.month === selectedMonth) ?? bars[bars.length - 1] ?? null
  const donut = buildStatusDonut(data.statusBreakdown)
  const wedea = wedeaProgress(data.activePayingMembers, data.wedeaThreshold)
  const hasRevenue = data.paidInvoicesCount > 0

  return <div className="billing-dashboard">
    {error && <p role="alert" className="inline-error">{error}</p>}
    <div className="billing-toolbar">
      <div>
        <small>Assinatura mensal oficial: {reportMoney(String(data.priceCents))} · Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Recife' })}</small>
      </div>
      <div className="billing-period-group" role="group" aria-label="Período do faturamento">
        {PERIODS.map(option => <button key={option} type="button" className={months === option ? 'selected' : ''} aria-pressed={months === option} disabled={loading} onClick={() => setMonths(option)}>Últimos {option} meses</button>)}
      </div>
    </div>

    <div className="admin-stats">
      <div className="admin-stat">
        <span className="stat-top"><span>MRR ESTIMADO</span><TrendingUp size={19} /></span>
        <strong>{reportMoney(data.estimatedMrrCents)}</strong>
        <small><Users size={14} /> {data.activePayingMembers} pagante(s) ativo(s) × {reportMoney(String(data.priceCents))}</small>
      </div>
      <div className="admin-stat">
        <span className="stat-top"><span>RECEITA BRUTA ({data.months}M)</span><CreditCard size={19} /></span>
        <strong>{reportMoney(data.grossRevenueCents)}</strong>
        <small><ReceiptText size={14} /> {data.paidInvoicesCount} fatura(s) · ticket médio {reportMoney(data.avgInvoiceCents)}</small>
      </div>
      <div className="admin-stat">
        <span className="stat-top"><span>LÍQUIDO RKMED ({data.months}M)</span><Landmark size={19} /></span>
        <strong>{reportMoney(data.netRkmedCents)}</strong>
        <small>Antes de tarifas Stripe · taxas operacionais {reportMoney(data.wedeaShareCents)}</small>
      </div>
      <div className="admin-stat alert-stat">
        <span className="stat-top"><span>EM ABERTO (INADIMPLÊNCIA)</span><CircleAlert size={19} /></span>
        <strong>{reportMoney(data.pastDueAmountCents)}</strong>
        <small>{data.statusBreakdown.pastDue} assinatura(s) pendente(s)</small>
      </div>
    </div>

    <div className="billing-charts-grid">
      <section className="surface-card billing-chart-card" aria-labelledby="billing-monthly-title">
        <div className="small-section-head">
          <div>
            <h2 id="billing-monthly-title">Evolução mensal do faturamento</h2>
            <p className="billing-subtitle">Receita confirmada via Stripe por mês (horário de Recife), separando líquido RKMED e taxas operacionais.</p>
          </div>
          <div className="billing-legend" aria-hidden="true">
            <span><i className="legend-dot legend-net" /> Líquido RKMED</span>
            <span><i className="legend-dot legend-wedea" /> Taxas operacionais</span>
          </div>
        </div>
        {hasRevenue ? <>
          <div className="billing-bar-chart" role="list" aria-label="Faturamento por mês">
            {bars.map(bar => <button key={bar.month} type="button" role="listitem" className={activeBar?.month === bar.month ? 'billing-bar-col selected' : 'billing-bar-col'} aria-pressed={activeBar?.month === bar.month} onClick={() => setSelectedMonth(bar.month)}>
              <span className="billing-bar-track" aria-hidden="true">
                {bar.wedeaPct > 0 && <span className="billing-bar-wedea" style={{ height: `${Math.max(bar.wedeaPct, 2)}%` }} />}
                {bar.netPct > 0 && <span className="billing-bar-net" style={{ height: `${Math.max(bar.netPct, 2)}%` }} />}
              </span>
              <span className="billing-bar-label">{bar.label}</span>
              <small className="billing-bar-count">{bar.invoices} fat.</small>
            </button>)}
          </div>
          {activeBar && <div className="billing-month-detail" aria-live="polite">
            <strong>{activeBar.label}</strong>
            <span>Bruto: <b>{reportMoney(activeBar.grossCents)}</b></span>
            <span>Líquido RKMED: <b>{reportMoney(activeBar.netCents)}</b></span>
            <span>Taxas operacionais: <b>{reportMoney(activeBar.wedeaCents)}</b></span>
            <span>Faturas pagas: <b>{activeBar.invoices}</b></span>
          </div>}
        </> : <EmptyState icon={CreditCard} title="Sem faturas pagas no período" description="Assim que os primeiros pagamentos de mensalidade forem confirmados pela Stripe, a evolução mensal aparecerá aqui." />}
      </section>

      <section className="surface-card billing-chart-card" aria-labelledby="billing-status-title">
        <div className="small-section-head">
          <div>
            <h2 id="billing-status-title">Distribuição das assinaturas</h2>
            <p className="billing-subtitle">Situação atual da base de assinaturas registradas.</p>
          </div>
          {!viewer && data.statusBreakdown.pastDue > 0 && <button type="button" onClick={() => go('/admin/cobrancas')}>Ver cobranças <ArrowRight size={15} /></button>}
        </div>
        {donut.total > 0 ? <div className="billing-donut-layout">
          <div className="billing-donut-wrap">
            <svg viewBox="0 0 148 148" className="billing-donut-svg" role="img" aria-label={`Distribuição de ${donut.total} assinaturas`}>
              <circle cx="74" cy="74" r="58" fill="none" stroke="#ece7de" strokeWidth="18" />
              {donut.segments.filter(segment => segment.count > 0).map(segment => <circle key={segment.key} cx="74" cy="74" r="58" fill="none" stroke={segment.color} strokeWidth="18" strokeDasharray={segment.dashArray} strokeDashoffset={segment.dashOffset} transform="rotate(-90 74 74)" />)}
            </svg>
            <div className="billing-donut-center">
              <strong>{donut.total}</strong>
              <small>assinaturas</small>
            </div>
          </div>
          <ul className="billing-status-list">
            {donut.segments.map(segment => <li key={segment.key}>
              <span><i className="legend-dot" style={{ background: segment.color }} /> {segment.label}</span>
              <b>{segment.count} <small>({segment.percent}%)</small></b>
            </li>)}
            {data.statusBreakdown.blocked > 0 && <li className="billing-blocked-note"><span>Bloqueio administrativo</span><b>{data.statusBreakdown.blocked}</b></li>}
          </ul>
        </div> : <EmptyState icon={Users} title="Nenhuma assinatura cadastrada" description="A distribuição por situação aparecerá aqui conforme os associados realizarem o cadastro." />}
      </section>
    </div>

    <div className="billing-bottom-grid">
      <section className="surface-card counter-flow" aria-labelledby="billing-wedea-title">
        <div className="small-section-head">
          <h2 id="billing-wedea-title">Taxas operacionais</h2>
          <span className={`status-badge ${wedea.eligible ? 'status-active' : 'status-blocked'}`}><span className="status-dot" />{wedea.eligible ? 'Taxa ativa' : 'Abaixo de 201 ativos'}</span>
        </div>
        <p className="billing-subtitle">Regra vigente: taxa operacional fixa de {reportMoney(String(data.wedeaShareUnitCents))} por fatura paga somente quando houver mais de {data.wedeaThreshold} pagantes ativos. Reembolsos e tarifas ficam com a RKMED.</p>
        <div className="billing-progress-block">
          <div className="billing-progress-head">
            <span>Base pagante ativa: <b>{wedea.active} / {wedea.target}</b></span>
            <small>{wedea.eligible ? 'Faixa atingida' : `Faltam ${wedea.remaining} para ativar`}</small>
          </div>
          <div className="billing-progress-track" role="progressbar" aria-valuenow={wedea.active} aria-valuemin={0} aria-valuemax={wedea.target} aria-label="Progresso para ativação das taxas operacionais">
            <span style={{ width: `${wedea.percent}%` }} />
          </div>
        </div>
        <dl className="billing-wedea-summary">
          <div className="dash-row"><dt>Taxas processadas ({data.months}M)</dt><dd>{data.wedea.sentCount} · {reportMoney(data.wedea.sentCents)}</dd></div>
          <div className="dash-row"><dt>Taxas pendentes</dt><dd>{data.wedea.pendingCount} · {reportMoney(data.wedea.pendingCents)}</dd></div>
          <div className="dash-row"><dt>Em revisão operacional</dt><dd>{data.wedea.reviewCount} · {reportMoney(data.wedea.reviewCents)}</dd></div>
          <div className="dash-row"><dt>Faturas isentas (≤ 200)</dt><dd>{data.wedea.skippedCount}</dd></div>
        </dl>
      </section>

      <section className="surface-card counter-flow" aria-labelledby="billing-invoices-title">
        <div className="small-section-head">
          <h2 id="billing-invoices-title">Últimas faturas pagas</h2>
          <small>Confirmadas via webhook</small>
        </div>
        {data.recentInvoices.length ? <div className="billing-invoices-list">
          {data.recentInvoices.map(item => <div className="dash-row" key={item.invoiceId}>
            <span>
              <b>{item.memberName}</b>
              <small>{shortDate(item.createdAt)} · {wedeaStatusLabel(item.wedeaStatus)}</small>
            </span>
            <span className="billing-invoice-amounts">
              <strong>{reportMoney(item.paidAmountCents)}</strong>
              {item.wedeaAmountCents !== '0' && <small>Taxa operacional {reportMoney(item.wedeaAmountCents)}</small>}
            </span>
          </div>)}
        </div> : <EmptyState icon={ReceiptText} title="Nenhuma fatura paga registrada" description="As faturas conciliadas pela Stripe aparecerão aqui em ordem mais recente." />}
      </section>
    </div>
  </div>
}
