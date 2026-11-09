import { useCallback, useState } from 'react'
import type { Portal } from '../../integrations/portal'
import type { PageCursor } from '../../lib/pagination'
import { useCursorPage } from '../../lib/useCursorPage'
import { PageControls } from '../../components/PageControls'
import { Button } from '../../components/ui/button'
import { shortDate } from '../../lib/format'

export function MemberSupportHistory({ api, online, revision }: { api: Portal; online: boolean; revision: number }) {
  const load = useCallback((cursor: PageCursor | null) => api.supportPage(cursor), [api])
  const page = useCursorPage(load, online, revision)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function close(id: string) {
    if (!online || busy) return
    setBusy(true); setError('')
    try { await api.closeSupport(id); page.refresh() }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível encerrar.') }
    finally { setBusy(false) }
  }
  return <section className="counter-flow member-support-history"><div className="small-section-head"><h3>Meus atendimentos</h3><Button variant="outline" disabled={!online || busy} onClick={() => page.refresh()}>Atualizar atendimentos</Button></div>
    {!online ? <p>Conecte-se para consultar as respostas e o histórico de atendimento.</p> : <>
      {page.loading && <p role="status">Carregando atendimentos…</p>}
      {(error || page.error) && <p className="inline-error" role="alert">{error || page.error}</p>}
      {page.data && (page.data.items.length ? page.data.items.map(item => <article key={item.id} className="support-thread">
        <p><strong>{item.status === 'open' ? 'Aguardando resposta' : item.status === 'answered' ? 'Respondida' : 'Encerrada'}</strong> · {shortDate(item.createdAt)}</p>
        <p className="preserve-lines">{item.message}</p>
        {item.response && <div className="support-answer"><strong>Resposta da RKMED</strong><p className="preserve-lines">{item.response}</p></div>}
        {item.status !== 'closed' && <Button variant="outline" disabled={busy} onClick={() => void close(item.id)}>Encerrar solicitação</Button>}
      </article>) : <p>Nenhum atendimento registrado.</p>)}
      <PageControls label="Páginas de meus atendimentos" page={page} />
    </>}
  </section>
}
