import { useCallback, useState } from 'react'
import { Button } from '../../components/ui/button'
import type { Portal } from '../../integrations/portal'
import type { PageCursor } from '../../lib/pagination'
import { shortDate } from '../../lib/format'
import { useCursorPage } from '../../lib/useCursorPage'
import { PageControls } from '../../components/PageControls'

const filters = [['', 'Todos'], ['open', 'Abertas'], ['answered', 'Respondidas'], ['closed', 'Fechadas']] as const

export function ConnectedSupport({ api, online, revision }: { api: Portal; online: boolean; revision: number }) {
  const [status, setStatus] = useState('')
  const load = useCallback((cursor: PageCursor | null) => api.supportPage(cursor, status), [api, status])
  const page = useCursorPage(load, online, revision)
  const [selected, setSelected] = useState<string | null>(null)
  const [response, setResponse] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function answer() {
    if (!online || busy || !selected || response.trim().length < 2) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api.answerSupport(selected, response.trim())
      setSelected(null); setResponse(''); setNotice('Resposta salva no histórico do associado e colocada na fila de e-mail.')
      page.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível registrar a resposta.') } finally { setBusy(false) }
  }
  async function change(action: () => Promise<void>, notice: string) {
    if (!online || busy) return
    setBusy(true); setError(''); setNotice('')
    try { await action(); setNotice(notice); page.refresh() }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível concluir.') }
    finally { setBusy(false) }
  }
  return <section className="surface-card counter-flow">
    <div className="small-section-head"><h2>Suporte</h2><small>Mensagens dos associados</small></div>
    <div className="filter-chips" role="group" aria-label="Filtrar mensagens de suporte">{filters.map(([value, label]) => <button key={value} type="button" className={status === value ? 'active' : ''} aria-pressed={status === value} onClick={() => { setStatus(value); setSelected(null); setResponse('') }}>{label}</button>)}</div>
    {!online && <p role="status">Conecte-se para consultar e responder mensagens.</p>}
    {page.loading && <p role="status">Carregando mensagens...</p>}
    {page.error && <p role="alert" className="inline-error">{page.error}</p>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    {notice && <p role="status" className="inline-success">{notice}</p>}
    {page.data && (page.data.items.length ? page.data.items.map(item => <div className="dash-row" key={item.id}><span><b>{item.memberName}</b><small>{shortDate(item.createdAt)} · {item.status === 'open' ? 'Aguardando resposta' : item.status === 'answered' ? 'Respondida' : 'Fechada'}</small><small>{item.message}</small>{item.response && <><small className="preserve-lines">Resposta: {item.response}</small><small>E-mail: {item.deliveryStatus === 'sent' ? 'aceito pelo provedor' : item.deliveryStatus === 'failed' ? `falha no envio (${item.deliveryAttempts} tentativa(s))` : 'aguardando envio'}</small></>}</span><div className="support-actions">{item.deliveryStatus === 'failed' && <Button variant="outline" disabled={!online || busy} onClick={() => void change(() => api.retrySupportReply(item.id), 'Resposta recolocada na fila de envio.')}>Tentar envio novamente</Button>}{item.status !== 'closed' && <Button variant="outline" disabled={!online || busy} onClick={() => void change(() => api.closeSupport(item.id), 'Solicitação encerrada.')}>Encerrar</Button>}</div>{item.status === 'open' && <Button variant="outline" disabled={!online || busy} onClick={() => { setSelected(item.id); setResponse(''); setNotice('') }}>Responder</Button>}</div>) : <p className="empty-copy">Nenhuma mensagem neste filtro.</p>)}
    <PageControls label="Páginas de suporte" page={page} />
    {selected && <div className="surface-card counter-flow" role="region" aria-label="Responder mensagem"><h3>Responder mensagem</h3><label className="field-label">Resposta<textarea className="input" required minLength={2} maxLength={2000} value={response} onChange={e => setResponse(e.target.value)} disabled={!online || busy} /></label><Button disabled={!online || busy || response.trim().length < 2} onClick={() => void answer()}>{busy ? 'Registrando...' : 'Registrar resposta'}</Button><Button variant="ghost" disabled={busy} onClick={() => { setSelected(null); setResponse('') }}>Cancelar</Button></div>}
  </section>
}
