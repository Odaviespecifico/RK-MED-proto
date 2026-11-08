import { useEffect, useState } from 'react'
import { ArrowRight, CircleAlert, ShoppingBag, TrendingUp, Users, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { AdminOverview, Portal } from '../../integrations/portal'
import { brl, shortDate } from '../../lib/format'
import { reportMoney } from '../../lib/reports'

export function ConnectedOverview({ api, online, go, revision }: { api: Portal; online: boolean; go: (path: string) => void; revision: number }) {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!online) return
    let active = true
    setLoading(true); setError('')
    api.adminOverview().then(value => { if (active) setData(value) })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Não foi possível carregar o resumo da operação.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, online, revision])
  if (!online) return <p className="member-note" role="status">Conecte-se para consultar o resumo da operação.</p>
  if (loading && !data) return <p role="status">Carregando resumo...</p>
  if (error && !data) return <p role="alert" className="inline-error">{error}</p>
  if (!data) return null
  return <>
    {error && <p role="alert" className="inline-error">{error}</p>}
    <div className="admin-stats">
      <div className="admin-stat"><span className="stat-top"><span>ASSOCIADOS ATIVOS</span><Users size={19} /></span><strong>{data.activeMembers}</strong><small><TrendingUp size={14} /> Assinaturas disponíveis</small></div>
      <div className="admin-stat"><span className="stat-top"><span>COMPRAS REGISTRADAS</span><ShoppingBag size={19} /></span><strong>{data.purchases}</strong><small><ArrowRight size={14} /> Em parceiros credenciados</small></div>
      <div className="admin-stat"><span className="stat-top"><span>ECONOMIA GERADA</span><Wallet size={19} /></span><strong>{reportMoney(data.savingsCents)}</strong><small><TrendingUp size={14} /> Para os associados</small></div>
      <div className="admin-stat alert-stat"><span className="stat-top"><span>ATENÇÃO NECESSÁRIA</span><CircleAlert size={19} /></span><strong>{data.pastDue}</strong><small>Assinatura pendente · {data.openSupport} suporte(s) aberto(s)</small></div>
    </div>
    <div className="admin-dashboard-grid">
      <div className="surface-card"><div className="small-section-head"><h3>Últimas compras</h3><button onClick={() => go('/admin/compras')}>Ver todas <ArrowRight size={16} /></button></div>{data.recentPurchases.length ? data.recentPurchases.map(p => <div className="dash-row" key={p.id}><span className="purchase-icon"><ShoppingBag size={18} /></span><span><b>{p.memberName}</b><small>{p.partnerName} · {shortDate(p.createdAt)}</small></span><strong>{brl(p.grossCents)}</strong></div>) : <p className="empty-copy">Nenhuma compra registrada.</p>}</div>
      <div className="surface-card attention-card"><div className="small-section-head"><h3>Precisam de atenção</h3><button onClick={() => go('/admin/cobrancas')}>Ver cobranças <ArrowRight size={16} /></button></div>{data.attentionMembers.length ? data.attentionMembers.map(m => <div className="attention-row" key={m.id}><CircleAlert size={18} /><span><b>{m.name}</b><small>Pagamento pendente{m.paidThrough ? ` · referência ${shortDate(m.paidThrough)}` : ''}</small></span></div>) : <p className="empty-copy">Nenhuma assinatura pendente.</p>}<div className="attention-note"><CircleAlert size={17} /> Verifique a situação antes de enviar uma cobrança.</div></div>
    </div>
    {data.openSupport > 0 && <section className="surface-card counter-flow"><div className="small-section-head"><h3>Suporte</h3><Button variant="outline" onClick={() => go('/admin/suporte')}>Abrir suporte</Button></div><p>{data.openSupport} mensagem(ns) aguardando resposta da equipe.</p></section>}
  </>
}
