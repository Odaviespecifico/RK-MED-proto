import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlert, MapPin, Plus, Users } from 'lucide-react'
import { Button } from './components/ui/button'
import { onlyDigits } from './lib/format'
import type { DemoState, Partner } from './mocks/data'

type Props = {
  data: DemoState
  update: (next: DemoState) => void
  notify: (message: string) => void
  online: boolean
  viewer: boolean
}

function Message({ text }: { text: string }) {
  return text ? <div className="inline-error" role="alert"><CircleAlert size={16} />{text}</div> : null
}

export function AdminPartners({ data, update, notify, online, viewer }: Props) {
  const [name, setName] = useState('')
  const [segment, setSegment] = useState('Laboratório')
  const [address, setAddress] = useState('')
  const [discount, setDiscount] = useState('')
  const [error, setError] = useState('')

  function addPartner(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (viewer || !online) return
    const cleanName = name.trim()
    const cleanSegment = segment.trim()
    const cleanAddress = address.trim()
    const percent = Number(discount)
    if (cleanName.length < 3 || cleanSegment.length < 3 || cleanAddress.length < 8) return setError('Informe nome, categoria e endereço completos.')
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) return setError('Informe um desconto inteiro entre 1% e 100%.')
    if (data.partners.some(item => item.name.localeCompare(cleanName, 'pt-BR', { sensitivity: 'base' }) === 0)) return setError('Já existe um parceiro com este nome.')
    const initials = cleanName.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()
    const tones = ['sage', 'sand', 'rose', 'blue']
    const partner: Partner = { id: crypto.randomUUID(), name: cleanName, segment: cleanSegment, address: cleanAddress, discount: percent, initials, tone: tones[data.partners.length % tones.length] }
    update({ ...data, partners: [...data.partners, partner] })
    setName(''); setSegment('Laboratório'); setAddress(''); setDiscount('')
    notify('Parceiro adicionado à demonstração.')
  }

  return <>
    <div className="panel-heading"><div><h1>Parceiros</h1><p>Cadastre estabelecimentos, endereços e descontos da rede.</p></div></div>
    {!viewer && <form className="surface-card management-form" onSubmit={addPartner}>
      <div className="small-section-head"><h2>Adicionar parceiro</h2><MapPin size={19} aria-hidden="true" /></div>
      <div className="management-fields">
        <label className="field-label">Nome do estabelecimento<input className="input" value={name} onChange={event => setName(event.target.value)} required maxLength={80} placeholder="Nome do parceiro" /></label>
        <label className="field-label">Categoria<input className="input" list="partner-segments" value={segment} onChange={event => setSegment(event.target.value)} required maxLength={40} /><datalist id="partner-segments"><option value="Laboratório" /><option value="Academia" /><option value="Suplementos" /></datalist></label>
        <label className="field-label">Desconto (%)<input className="input" type="number" min="1" max="100" step="1" value={discount} onChange={event => setDiscount(event.target.value)} required placeholder="15" /></label>
        <label className="field-label management-address">Endereço completo<input className="input" value={address} onChange={event => setAddress(event.target.value)} required maxLength={160} placeholder="Rua, número · Cidade, UF" /></label>
      </div>
      <Message text={error} />
      <Button type="submit" disabled={!online}><Plus size={17} /> Adicionar parceiro</Button>
    </form>}
    <div className="management-list" aria-label="Parceiros cadastrados">{data.partners.map(partner => <article className="surface-card management-row" key={partner.id}>
      <span className={`partner-logo tone-${partner.tone}`} aria-hidden="true">{partner.initials}</span>
      <div><h2>{partner.name}</h2><p>{partner.segment} · {partner.address}</p><small>{data.employees.filter(employee => employee.partnerId === partner.id && employee.active).length} funcionário(s) ativo(s)</small></div>
      <strong>{partner.discount}% de desconto</strong>
    </article>)}</div>
  </>
}

export function AdminEmployees({ data, update, notify, online, viewer }: Props) {
  const [partnerId, setPartnerId] = useState(data.partners[0]?.id ?? '')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const selectedPartner = data.partners.find(item => item.id === partnerId)
  const employees = data.employees.filter(item => item.partnerId === partnerId)

  function validateCode(value: string, employeeId?: string) {
    if (!/^\d{4}$/.test(value)) return 'O código deve ter quatro dígitos.'
    if (data.employees.some(item => item.id !== employeeId && item.code === value)) return 'Este código já pertence a outro funcionário.'
    return ''
  }
  function addEmployee(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (viewer || !online) return
    if (!selectedPartner) return setError('Selecione um parceiro.')
    const cleanName = name.trim()
    if (cleanName.length < 3) return setError('Informe o nome completo do funcionário.')
    if (employees.some(item => item.name.localeCompare(cleanName, 'pt-BR', { sensitivity: 'base' }) === 0)) return setError('Este funcionário já está cadastrado para o parceiro.')
    const codeError = validateCode(code)
    if (codeError) return setError(codeError)
    update({ ...data, employees: [...data.employees, { id: crypto.randomUUID(), name: cleanName, partnerId, code, active: true }] })
    setName(''); setCode('')
    notify(`Funcionário cadastrado para ${selectedPartner.name}.`)
  }
  function saveCode(employeeId: string) {
    setError('')
    if (viewer || !online) return
    const employee = employees.find(item => item.id === employeeId)
    if (!employee) return
    const nextCode = codeDrafts[employeeId] ?? employee.code
    const codeError = validateCode(nextCode, employeeId)
    if (codeError) return setError(codeError)
    update({ ...data, employees: data.employees.map(item => item.id === employeeId ? { ...item, code: nextCode } : item) })
    notify(`Código de ${employee.name} atualizado.`)
  }

  return <>
    <div className="panel-heading"><div><h1>Funcionários</h1><p>Cada funcionário pertence a um parceiro e inicia um turno de cada vez.</p></div></div>
    <label className="field-label management-selector">Parceiro<select className="input" value={partnerId} onChange={event => { setPartnerId(event.target.value); setError('') }}>{data.partners.map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>
    {!viewer && <form className="surface-card management-form" onSubmit={addEmployee}>
      <div className="small-section-head"><h2>Adicionar funcionário</h2><Users size={19} aria-hidden="true" /></div>
      <p>O código será aceito apenas para o parceiro selecionado acima.</p>
      <div className="management-fields">
        <label className="field-label">Nome completo<input className="input" value={name} onChange={event => setName(event.target.value)} required maxLength={80} placeholder="Nome do funcionário" /></label>
        <label className="field-label">Código de quatro dígitos<input className="input" value={code} onChange={event => setCode(onlyDigits(event.target.value))} inputMode="numeric" maxLength={4} required placeholder="0000" /></label>
      </div>
      <Message text={error} />
      <Button type="submit" disabled={!online || !selectedPartner}><Plus size={17} /> Adicionar funcionário</Button>
    </form>}
    {viewer && <Message text={error} />}
    <div className="surface-card management-staff-list"><div className="small-section-head"><h2>Equipe de {selectedPartner?.name ?? 'parceiro'}</h2><span>{employees.length} cadastrado(s)</span></div>
      {employees.length ? employees.map(employee => <div className="management-staff-row" key={employee.id}>
        <div className="management-staff-name"><b>{employee.name}</b><span className={`status-badge ${employee.active ? 'status-active' : 'status-blocked'}`}>{employee.active ? 'Ativo' : 'Inativo'}</span></div>
        {viewer ? <small>Código: ••••</small> : <div className="management-staff-actions">
          <label className="field-label">Código<input className="input" value={codeDrafts[employee.id] ?? employee.code} onChange={event => setCodeDrafts(previous => ({ ...previous, [employee.id]: onlyDigits(event.target.value) }))} inputMode="numeric" maxLength={4} aria-label={`Código de ${employee.name}`} /></label>
          <button className="table-action" disabled={!online || (codeDrafts[employee.id] ?? employee.code) === employee.code} onClick={() => saveCode(employee.id)}>Salvar código</button>
          <button className="table-action" disabled={!online} onClick={() => { update({ ...data, employees: data.employees.map(item => item.id === employee.id ? { ...item, active: !item.active } : item) }); notify(employee.active ? 'Funcionário desativado.' : 'Funcionário ativado.') }}>{employee.active ? 'Desativar' : 'Ativar'}</button>
        </div>}
      </div>) : <p className="empty-copy">Nenhum funcionário cadastrado para este parceiro.</p>}
    </div>
  </>
}
