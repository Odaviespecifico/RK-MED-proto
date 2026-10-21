import { useCallback, useState } from 'react'
import type { AdminMember, Portal } from '../../integrations/portal'
import type { PageCursor } from '../../lib/pagination'
import { useCursorPage } from '../../lib/useCursorPage'
import { reportMoney } from '../../lib/reports'
import { PageControls } from '../../components/PageControls'
import { Button } from '../../components/ui/button'

export type MemberAction = { type: 'block' | 'link' | 'retry'; id: string; name: string; member: AdminMember }
export function MemberDirectory({ api, viewer, online, busy, collections, revision, select }: { api: Portal; viewer: boolean; online: boolean; busy: boolean; collections: boolean; revision: number; select: (value: MemberAction) => void }) {
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const load = useCallback((cursor: PageCursor | null) => api.membersPage(cursor, query, collections), [api, query, collections])
  const page = useCursorPage(load, online, revision)
  return <section className="surface-card counter-flow">
    <form onSubmit={e => { e.preventDefault(); if (draft.trim() === query) page.refresh(); else setQuery(draft.trim()) }}>
      <label className="field-label">Buscar por nome<input className="input" maxLength={80} value={draft} onChange={e => setDraft(e.target.value)} /></label>
      <div className="row-actions"><Button type="submit" disabled={!online || busy}>Buscar associados</Button><Button type="button" variant="ghost" disabled={!online || busy} onClick={() => { setDraft(''); setQuery(''); page.refresh() }}>Limpar busca</Button></div>
    </form>
    {page.loading && <p role="status">Carregando associados...</p>}
    {page.error && <p role="alert" className="inline-error">{page.error}</p>}
    {page.data && (page.data.items.length ? <div className="table-card"><table className="responsive-table"><thead><tr><th>Associado</th><th>CPF</th><th>Situação</th><th>Economia</th>{!viewer && <th>Ações</th>}</tr></thead><tbody>{page.data.items.map(m => <tr key={m.id}>
      <td data-label="Associado"><b>{m.name}</b>{!viewer && <><p>{m.email}</p><p>{m.phone}</p></>}</td><td data-label="CPF">{m.cpf}</td>
      <td data-label="Situação">{m.blocked ? 'Bloqueado' : m.eligible ? 'Benefício disponível' : 'Benefício indisponível'}</td><td data-label="Economia">{reportMoney(m.savingsCents)}</td>
      {!viewer && <td data-label="Ações"><div className="row-actions"><Button variant="outline" disabled={!online || busy} onClick={() => select({ type: 'block', id: m.id, name: m.name, member: m })}>{m.blocked ? 'Desbloquear' : 'Bloquear'}</Button>{collections && m.invoiceId && <><Button variant="outline" disabled={!online || busy} onClick={() => select({ type: 'link', id: m.id, name: m.name, member: m })}>Enviar link</Button><Button variant="outline" disabled={!online || busy} onClick={() => select({ type: 'retry', id: m.id, name: m.name, member: m })}>Retentar fatura</Button></>}</div></td>}
    </tr>)}</tbody></table></div> : <p>Nenhum associado encontrado.</p>)}
    <PageControls label="Páginas de associados" page={page} />
  </section>
}
