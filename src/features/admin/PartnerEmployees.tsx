import { useEffect, useState } from 'react'
import type { Portal, PortalEmployee } from '../../integrations/portal'
import { Button } from '../../components/ui/button'

export function PartnerEmployees({ api, partnerId, online }: { api: Portal; partnerId: string; online: boolean }) {
  const [employees, setEmployees] = useState<PortalEmployee[]>([])
  const [name, setName] = useState('')
  const [issued, setIssued] = useState<{ name: string; code: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  async function load() { setEmployees(await api.partnerEmployees(partnerId)); setLoaded(true) }
  useEffect(() => { let active = true; if (online) api.partnerEmployees(partnerId).then(rows => { if (active) { setEmployees(rows); setLoaded(true) } }).catch(() => { if (active) setError('Não foi possível carregar os funcionários.') }); return () => { active = false } }, [api, partnerId, online])
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (!online || busy) return
    setBusy(true); setError(''); setIssued(null)
    try { const result = await api.createPartnerEmployee(partnerId, name.trim()); setIssued({ name: name.trim(), code: result.code }); setName(''); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o funcionário.') }
    finally { setBusy(false) }
  }
  async function toggle(employee: PortalEmployee) {
    setBusy(true); setError('')
    try { await api.saveEmployee({ ...employee, code: '', active: !employee.active }); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o funcionário.') }
    finally { setBusy(false) }
  }
  return <section className="counter-flow" aria-label="Funcionários do parceiro"><h3>Funcionários</h3>
    {error && <p role="alert" className="inline-error">{error}</p>}
    {!loaded ? <p role="status">{online ? 'Carregando funcionários…' : 'Conecte-se para consultar os funcionários.'}</p> : !employees.length ? <p>Nenhum funcionário cadastrado neste parceiro.</p> : employees.map(employee => <div className="dash-row" key={employee.id}><span><b>{employee.name}</b><small>{employee.active ? 'Ativo' : 'Inativo'}{employee.code ? <> · Código: <code className="employee-inline-code">{employee.code}</code></> : ''}</small></span><Button variant="outline" disabled={!online || busy} onClick={() => void toggle(employee)}>{employee.active ? 'Desativar' : 'Reativar'}</Button></div>)}
    <form className="counter-flow" onSubmit={event => void create(event)}><label className="field-label">Nome do funcionário<input className="input" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={160} required disabled={!online || busy} /></label><p>O código de quatro dígitos é gerado automaticamente e não se repete neste parceiro.</p><Button type="submit" disabled={!online || busy}>{busy ? 'Salvando…' : 'Cadastrar funcionário'}</Button></form>
    {issued && <div role="status" className="inline-success"><p>Funcionário cadastrado: <strong>{issued.name}</strong></p><p>Código de acesso: <strong className="employee-issued-code">{issued.code}</strong></p><p>Guarde e entregue este código ao funcionário. Ele é exibido somente neste cadastro.</p><Button variant="outline" onClick={() => setIssued(null)}>Ocultar código</Button></div>}
  </section>
}
