import { Inbox, LoaderCircle } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'
import { StaffAccess } from './StaffAccess'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import type { AdminMember, Portal, PortalContext } from '../../integrations/portal'
import type { PublicPartner } from '../../integrations/contracts'
import { brl } from '../../lib/format'
import { ConnectedPartners } from './ConnectedPartners'
import { ConnectedReports } from './ConnectedReports'
import { ConnectedOverview } from './ConnectedOverview'
import { ConnectedSupport } from './ConnectedSupport'
import { OperationalAlerts } from './OperationalAlerts'
import { PurchaseHistory } from '../partner/PurchaseHistory'
import { MemberDirectory } from './MemberDirectory'

export function ConnectedAdmin({ api, context, refresh, online, tab, openCollections, go }: { api: Portal; context: PortalContext; partners: PublicPartner[]; refresh: () => Promise<void>; online: boolean; tab: string; openCollections: () => void; go: (path: string) => void }) {
  const viewer = context.role === 'viewer'
  const [revision, setRevision] = useState(0)
  const [queueLoaded, setQueueLoaded] = useState(false)
  const [queue, setQueue] = useState<Awaited<ReturnType<Portal['queue']>>>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<{ type: 'block' | 'reverse' | 'link' | 'retry'; id: string; name: string; member?: AdminMember } | null>(null)
  const [reason, setReason] = useState('')
  async function load() { if (viewer) return; if (tab === 'cobrancas') { setQueue(await api.queue()); setQueueLoaded(true) } }
  useEffect(() => { if (online) void load().catch(() => setError('Não foi possível carregar os dados. Entre novamente se sua sessão expirou.')) }, [api, online, viewer, tab])
  async function run(action: () => Promise<void>, silent = false) { if (!online || busy) return; setBusy(true); setError(''); setNotice(''); try { await action(); setRevision(value => value + 1); await load(); await refresh(); if (!silent) setNotice('Operação concluída.'); setSelected(null); setReason('') } catch (e) { setError(e instanceof Error ? e.message : 'Operação indisponível.') } finally { setBusy(false) } }
  async function refreshOverview() { setRefreshing(true); try { await run(load, true) } finally { setRefreshing(false) } }


  return <div className="admin-portal"><div className="welcome-row"><div><h1>{tab === 'visao' ? 'Visão geral' : tab === 'suporte' ? 'Suporte' : tab === 'relatorios' ? 'Relatórios' : tab === 'compras' ? 'Compras registradas' : tab === 'parceiros' ? 'Parceiros' : tab === 'equipe' ? 'Equipe' : tab === 'cobrancas' ? 'Cobranças e suporte' : 'Associados'}</h1><p>{viewer ? 'Consulta da diretoria' : 'Operação RKMED'}</p></div>{tab !== 'relatorios' && <Button variant="outline" disabled={busy || !online} aria-busy={refreshing} onClick={() => void (tab === 'visao' ? refreshOverview() : run(load))}>{refreshing && <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />}Atualizar dados</Button>}</div>
    {error && <p role="alert" className="inline-error">{error}</p>}{notice && <p role="status" className="inline-success">{notice}</p>}
    {tab === 'visao' ? <ConnectedOverview api={api} online={online} go={go} revision={revision} />
      : tab === 'suporte' ? (viewer ? <p role="alert" className="inline-error">Acesso restrito à equipe de atendimento.</p> : <ConnectedSupport api={api} online={online} revision={revision} />)
      : tab === 'relatorios' ? <ConnectedReports api={api} viewer={viewer} online={online} /> : tab === 'compras' ? <section className="surface-card counter-flow"><PurchaseHistory api={api} online={online} revision={revision} reverse={viewer || !online ? undefined : p => setSelected({ type: 'reverse', id: p.id, name: p.memberName })} /></section>
      : tab === 'parceiros' ? <ConnectedPartners api={api} actorId={context.userId} viewer={viewer} online={online} done={refresh} revision={revision} />
      : tab === 'equipe' && !viewer ? (context.role === 'admin' ? <StaffAccess api={api} actorId={context.userId} online={online} revision={revision} /> : <p>A gestão dos acessos internos é exclusiva da administração.</p>)
      : <MemberDirectory key={tab} api={api} viewer={viewer} online={online} busy={busy} collections={tab === 'cobrancas'} revision={revision} select={setSelected} />}
    {!viewer && ['visao', 'cobrancas'].includes(tab) && <OperationalAlerts api={api} online={online} openCollections={() => { if (tab === 'cobrancas') void run(load); else openCollections() }} />}
    {tab === 'cobrancas' && !viewer && <section className="surface-card counter-flow"><h2>Fila de comunicações e alertas</h2>{queue.length ? queue.map(item => <div className="dash-row" key={item.id}><span><b>{item.memberName}</b><small>{item.kind.startsWith('risk.') ? 'Revisão operacional' : item.kind === 'collection.link' ? 'Link de cobrança' : item.kind === 'support.answer' ? 'Resposta de suporte' : 'Atualização da assinatura'} · {item.status === 'pending' ? 'Aguardando envio' : item.status === 'failed' ? 'Falha no envio' : 'Aceita pelo provedor'} · {item.attempts} tentativa(s)</small></span></div>) : queueLoaded ? <EmptyState icon={Inbox} title="Fila sem pendências" description="Comunicações e alertas aparecerão aqui quando precisarem de acompanhamento." /> : <p role="status">Carregando fila…</p>}</section>}
    {selected && <section className="surface-card counter-flow" role="region" aria-label="Confirmar operação"><h2>Confirmar {selected.type === 'reverse' ? 'estorno' : selected.type === 'block' ? selected.member?.blocked ? 'desbloqueio' : 'bloqueio' : selected.type === 'retry' ? 'retentativa da fatura' : 'envio do link'}?</h2><p>{selected.name}</p>{['link', 'retry'].includes(selected.type) && <p>Fatura {selected.member?.invoiceId} · {brl(selected.member?.amountDue || 0)}. A retentativa pode cobrar o método de pagamento existente.</p>}{['block', 'reverse'].includes(selected.type) && <label className="field-label">Motivo<textarea className="input" value={reason} onChange={e => setReason(e.target.value)} /></label>}<Button disabled={busy || !online || (['block', 'reverse'].includes(selected.type) && reason.trim().length < 3)} onClick={() => void run(async () => { if (selected.type === 'reverse') await api.reverse(selected.id, reason); else if (selected.type === 'block') await api.block(selected.id, !selected.member?.blocked, reason); else await api.command('collection', { memberId: selected.id, invoiceId: selected.member?.invoiceId, amount: selected.member?.amountDue, operationId: crypto.randomUUID(), collectionAction: selected.type }) })}>Confirmar ação</Button><Button variant="ghost" disabled={busy} onClick={() => { setSelected(null); setReason('') }}>Cancelar</Button></section>}
  </div>
}
