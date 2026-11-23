import { MessageCircle, X } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import type { Portal, SupportRequest } from '../../integrations/portal'
import type { PageCursor } from '../../lib/pagination'
import { shortDate } from '../../lib/format'
import { useCursorPage } from '../../lib/useCursorPage'
import { PageControls } from '../../components/PageControls'

const filters = [['', 'Todos'], ['open', 'Abertas'], ['answered', 'Respondidas'], ['closed', 'Fechadas']] as const

export function ConnectedSupport({ api, online, revision }: { api: Portal; online: boolean; revision: number }) {
  const [status, setStatus] = useState('')
  const load = useCallback((cursor: PageCursor | null) => api.supportPage(cursor, status), [api, status])
  const page = useCursorPage(load, online, revision)
  const [selected, setSelected] = useState<SupportRequest | null>(null)
  const [response, setResponse] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selected) {
      if (!dialog.open) dialog.showModal()
      window.requestAnimationFrame(() => textareaRef.current?.focus())
    } else if (dialog.open) {
      dialog.close()
    }
  }, [selected])

  function closeDialog() {
    if (busy) return
    setSelected(null)
    setResponse('')
    setError('')
  }

  async function answer(event?: React.FormEvent) {
    event?.preventDefault()
    if (!online || busy || !selected || response.trim().length < 2) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api.answerSupport(selected.id, response.trim())
      setSelected(null); setResponse(''); setNotice('Resposta salva no histórico do associado e colocada na fila de e-mail.')
      page.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível registrar a resposta.') } finally { setBusy(false) }
  }

  async function change(action: () => Promise<void>, nextNotice: string) {
    if (!online || busy) return
    setBusy(true); setError(''); setNotice('')
    try { await action(); setNotice(nextNotice); page.refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir.') }
    finally { setBusy(false) }
  }

  return <section className="surface-card counter-flow">
    <div className="small-section-head"><h2>Suporte</h2><small>Mensagens dos associados</small></div>
    <div className="filter-chips" role="group" aria-label="Filtrar mensagens de suporte">{filters.map(([value, label]) => <button key={value} type="button" className={status === value ? 'active' : ''} aria-pressed={status === value} onClick={() => { setStatus(value); setSelected(null); setResponse('') }}>{label}</button>)}</div>
    {!online && <p role="status">Conecte-se para consultar e responder mensagens.</p>}
    {page.loading && <p role="status">Carregando mensagens...</p>}
    {page.error && <p role="alert" className="inline-error">{page.error}</p>}
    {!selected && error && <p role="alert" className="inline-error">{error}</p>}
    {notice && <p role="status" className="inline-success">{notice}</p>}
    {page.data && (page.data.items.length ? page.data.items.map(item => <div className="dash-row" key={item.id}><span><b>{item.memberName}</b><small>{shortDate(item.createdAt)} · {item.status === 'open' ? 'Aguardando resposta' : item.status === 'answered' ? 'Respondida' : 'Fechada'}</small><small>{item.message}</small>{item.response && <><small className="preserve-lines">Resposta: {item.response}</small><small>E-mail: {item.deliveryStatus === 'sent' ? 'aceito pelo provedor' : item.deliveryStatus === 'failed' ? `falha no envio (${item.deliveryAttempts} tentativa(s))` : 'aguardando envio'}</small></>}</span><div className="support-actions">{item.deliveryStatus === 'failed' && <Button variant="outline" disabled={!online || busy} onClick={() => void change(() => api.retrySupportReply(item.id), 'Resposta recolocada na fila de envio.')}>Tentar envio novamente</Button>}{item.status !== 'closed' && <Button variant="outline" disabled={!online || busy} onClick={() => void change(() => api.closeSupport(item.id), 'Solicitação encerrada.')}>Encerrar</Button>}</div>{item.status === 'open' && <Button variant="outline" disabled={!online || busy} onClick={() => { setSelected(item); setResponse(''); setError(''); setNotice('') }}>Responder</Button>}</div>) : <EmptyState icon={MessageCircle} title="Nenhuma mensagem neste filtro" description="Quando houver solicitações com essa situação, elas aparecerão aqui." />)}
    <PageControls label="Páginas de suporte" page={page} />
    <dialog ref={dialogRef} className="registration-dialog support-reply-dialog" aria-modal="true" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); closeDialog() }} onClick={event => { if (event.target === dialogRef.current) closeDialog() }}>
      {selected && <div className="registration-dialog-shell">
        <header className="registration-dialog-header">
          <div>
            <span className="registration-eyebrow">RKMED · Atendimento</span>
            <h3 id={titleId}>Responder mensagem</h3>
            <p>{selected.memberName} · {shortDate(selected.createdAt)}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Fechar janela de resposta" disabled={busy} onClick={closeDialog}><X size={20} aria-hidden="true" /></Button>
        </header>
        <form className="registration-dialog-body support-reply-body" onSubmit={event => void answer(event)}>
          <div className="support-reply-original">
            <small>MENSAGEM DO ASSOCIADO</small>
            <p className="preserve-lines">{selected.message}</p>
          </div>
          {error && <p role="alert" className="inline-error">{error}</p>}
          <label className="field-label">Sua resposta<textarea ref={textareaRef} className="input support-reply-textarea" required minLength={2} maxLength={2000} rows={5} placeholder="Escreva a resposta para o associado…" value={response} onChange={e => setResponse(e.target.value)} disabled={!online || busy} /></label>
          <div className="row-actions support-reply-actions">
            <Button type="submit" disabled={!online || busy || response.trim().length < 2}>{busy ? 'Registrando…' : 'Registrar resposta'}</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={closeDialog}>Cancelar</Button>
          </div>
        </form>
      </div>}
    </dialog>
  </section>
}
