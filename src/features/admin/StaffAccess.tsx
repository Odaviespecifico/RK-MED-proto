import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Portal, StaffAccount, StaffAudit, StaffRole } from '../../integrations/portal'
import type { PageCursor } from '../../lib/pagination'
import { useCursorPage } from '../../lib/useCursorPage'
import { PageControls } from '../../components/PageControls'
import { Button } from '../../components/ui/button'
import { shortDate } from '../../lib/format'

const roles: Record<StaffRole, string> = { partner: 'Parceiro', support: 'Suporte RKMED', viewer: 'Diretoria', admin: 'Administrador' }
const auditNames: Record<string, string> = { 'staff.created': 'Acesso criado', 'staff.provision': 'Acesso criado', 'staff.access.update': 'Permissões ou situação alteradas', 'staff.password.requested': 'Redefinição de senha solicitada', 'staff.password.succeeded': 'Senha redefinida', 'staff.password.failed': 'Falha na redefinição de senha' }

export function StaffAccess({ api, actorId, online }: { api: Portal; actorId: string; online: boolean }) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(timer) }, [query])
  const load = useCallback((cursor: PageCursor | null) => api.staffAccounts(cursor, search), [api, search])
  const page = useCursorPage(load, online)
  const [partners, setPartners] = useState<Awaited<ReturnType<Portal['staffPartners']>>>([])
  const [createRole, setCreateRole] = useState<StaffRole>('partner')
  const [selected, setSelected] = useState<StaffAccount | null>(null)
  const [mode, setMode] = useState<'edit' | 'password'>('edit')
  const [role, setRole] = useState<StaffRole>('support')
  const [partner, setPartner] = useState('')
  const [active, setActive] = useState(true)
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [auditAccount, setAuditAccount] = useState<StaffAccount | null>(null)
  const [audit, setAudit] = useState<StaffAudit[] | null>(null)
  const [auditError, setAuditError] = useState('')
  useEffect(() => {
    if (!online) return
    let current = true
    api.staffPartners().then(value => { if (current) setPartners(value) }).catch(() => { if (current) setError('Não foi possível carregar os estabelecimentos.') })
    return () => { current = false }
  }, [api, online])
  useEffect(() => {
    setAudit(null); setAuditError('')
    if (!online || !auditAccount) return
    let current = true
    api.staffAudit(auditAccount.id).then(value => { if (current) setAudit(value) }).catch(() => { if (current) setAuditError('Não foi possível carregar o histórico.') })
    return () => { current = false }
  }, [api, online, auditAccount])
  function choose(account: StaffAccount, mode: 'edit' | 'password') {
    setSelected(account); setMode(mode); setRole(account.role); setPartner(account.partnerId || ''); setActive(account.active)
    setReason(''); setPassword(''); setConfirming(false); setError(''); setNotice(''); setAuditAccount(null)
  }
  function cancel() { setSelected(null); setPassword(''); setReason(''); setConfirming(false) }
  async function run(action: () => Promise<void>, message: string) {
    if (busy || !online) return false
    setBusy(true); setError(''); setNotice('')
    try { await action(); setNotice(message); cancel(); return true }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível concluir a operação.'); return false }
    finally { setBusy(false); page.refresh() }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget; const data = new FormData(form)
    const success = await run(async () => {
      await api.command('staff', { staffAction: 'create', operationId: crypto.randomUUID(), email: String(data.get('email')),
        password: String(data.get('password')), role: createRole, partnerId: createRole === 'partner' ? String(data.get('partner')) : null })
    }, 'Acesso criado. A senha inicial deve ser comunicada ao responsável por um canal seguro.')
    if (success) { form.reset(); setCreateRole('partner') }
    else { const field = form.elements.namedItem('password'); if (field instanceof HTMLInputElement) field.value = '' }
  }
  async function commit() {
    if (!selected || !confirming) return
    const account = selected
    if (mode === 'edit') {
      await run(() => api.updateStaff(account, role, role === 'partner' ? partner : null, active, reason.trim()), 'Acesso atualizado. As sessões anteriores perderam acesso ao sistema.')
    } else {
      await run(async () => { await api.command('staff', { staffAction: 'password', operationId: crypto.randomUUID(), userId: account.id, revision: account.revision, reason: reason.trim(), password }) }, 'Senha redefinida. As sessões anteriores perderam acesso ao sistema.')
      // An uncertain provider response requires a fresh account revision and password entry.
      cancel()
    }
  }
  const change = () => setConfirming(false)
  return <section className="surface-card counter-flow" aria-label="Acessos internos">
    <div className="small-section-head"><h2>Acessos internos</h2><Button variant="outline" disabled={!online || busy} onClick={() => page.refresh()}>Atualizar acessos</Button></div>
    <p>Somente administradores gerenciam contas e permissões. Cada alteração exige motivo e fica registrada.</p>
    {!online && <p role="status">Conecte-se para consultar e administrar acessos.</p>}
    {(error || page.error) && <p role="alert" className="inline-error">{error || page.error}</p>}
    {notice && <p role="status" className="inline-success">{notice}</p>}
    <label className="field-label">Buscar acesso por e-mail ou estabelecimento<input className="input" value={query} maxLength={160} onChange={e => setQuery(e.target.value)} disabled={!online} /></label>
    {page.loading && <p role="status">Carregando acessos…</p>}
    {online && page.data && (page.data.items.length ? <div className="staff-access-list">{page.data.items.map(account => <article key={account.id} className="staff-access-row">
      <div><b>{account.email}</b><small>{roles[account.role]}{account.isTest ? ' · Parceiro de teste' : ''}{account.partnerName ? ` · ${account.partnerName}` : ''} · {account.active ? 'Ativo' : 'Desativado'}{account.id === actorId ? ' · Seu acesso' : ''}</small>{account.lastSignInAt && <small>Último acesso: {shortDate(account.lastSignInAt)}</small>}</div>
      <div className="staff-access-actions"><Button variant="outline" disabled={busy || account.id === actorId} onClick={() => choose(account, 'edit')}>Editar acesso</Button><Button variant="outline" disabled={busy || !account.active || account.id === actorId} onClick={() => choose(account, 'password')}>Redefinir senha</Button><Button variant="ghost" disabled={busy} onClick={() => { cancel(); setAuditAccount(account) }}>Histórico de acesso</Button></div>
    </article>)}</div> : <p>Nenhum acesso encontrado.</p>)}
    <PageControls label="Páginas de acessos internos" page={page} />
    {selected && <form className="counter-flow staff-access-editor" aria-label={mode === 'edit' ? 'Editar acesso interno' : 'Redefinir senha do acesso'} onSubmit={e => { e.preventDefault(); setConfirming(true) }}>
      <h3>{mode === 'edit' ? 'Editar acesso' : 'Redefinir senha'} · {selected.email}</h3>
      {mode === 'edit' ? <><label className="field-label">Perfil do acesso<select className="input" value={role} disabled={busy} onChange={e => { setRole(e.target.value as StaffRole); setPartner(''); change() }}>{Object.entries(roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {role === 'partner' && <label className="field-label">Estabelecimento do acesso<select className="input" value={partner} onChange={e => { setPartner(e.target.value); change() }} required disabled={busy}><option value="">Selecione</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}{p.active ? '' : ' (inativo)'}</option>)}</select></label>}
        <label className="field-label"><span><input type="checkbox" checked={active} disabled={busy} onChange={e => { setActive(e.target.checked); change() }} /> Acesso ativo</span></label></>
        : <label className="field-label">Nova senha<input className="input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} disabled={busy} onChange={e => { setPassword(e.target.value); change() }} /></label>}
      <label className="field-label">Motivo da alteração<textarea className="input" value={reason} required minLength={3} maxLength={1000} disabled={busy} onChange={e => { setReason(e.target.value); change() }} /></label>
      <Button type="submit" disabled={busy || !online}>Revisar alteração</Button>
      {confirming && <div className="staff-confirmation" role="region" aria-label="Confirmar alteração de acesso"><p>{mode === 'password' ? 'Definir a nova senha' : `${active ? 'Manter ou ativar' : 'Desativar'} o acesso como ${roles[role]}`} para <strong>{selected.email}</strong>?</p><p>As sessões anteriores perderão acesso. A alteração e o motivo serão auditados.</p><Button type="button" disabled={busy || !online} onClick={() => void commit()}>{busy ? 'Salvando…' : 'Confirmar alteração'}</Button></div>}
      <Button type="button" variant="ghost" disabled={busy} onClick={cancel}>Cancelar alteração</Button>
    </form>}
    {auditAccount && <section className="counter-flow" aria-label="Histórico do acesso"><h3>Últimas 20 ações · {auditAccount.email}</h3>{auditError && <p role="alert">{auditError}</p>}{!audit && !auditError && <p role="status">Carregando histórico…</p>}{audit && (audit.length ? audit.map(item => <article className="staff-audit-row" key={item.id}><b>{auditNames[item.action] || 'Acesso administrado'}</b><small>{shortDate(item.createdAt)} · {item.actorEmail || 'Sistema'}</small>{item.reason && <p className="preserve-lines">{item.reason}</p>}</article>) : <p>Nenhuma alteração registrada.</p>)}</section>}
    <form className="counter-flow staff-access-create" onSubmit={create}><h3>Criar acesso</h3>
      <label className="field-label">E-mail do novo acesso<input className="input" name="email" type="email" required autoComplete="off" disabled={busy || !online} /></label>
      <label className="field-label">Senha inicial<input className="input" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy || !online} /></label>
      <label className="field-label">Perfil<select className="input" name="role" value={createRole} disabled={busy || !online} onChange={e => setCreateRole(e.target.value as StaffRole)}>{Object.entries(roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {createRole === 'partner' && <label className="field-label">Estabelecimento (perfil parceiro)<select className="input" name="partner" required disabled={busy || !online}><option value="">Selecione</option>{partners.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      <Button disabled={!online || busy} type="submit">Criar acesso</Button>
    </form>
  </section>
}
