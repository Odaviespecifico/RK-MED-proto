import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BarChart3, Building2, KeyRound, Percent, RefreshCw, ShoppingBag, TrendingUp, Users, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState } from '../../components/EmptyState'
import type { PartnerMetrics, Portal, PortalContext, PortalEmployee } from '../../integrations/portal'
import { formatCnpj } from '../../lib/format'
import { reportMoney } from '../../lib/reports'
import { preparePartnerPhoto } from '../../lib/partner-photo'
import { PartnerAddressFields, emptyPartnerAddress, type PartnerAddress } from '../admin/PartnerAddressFields'
import { PurchaseHistory } from './PurchaseHistory'

const PERIODS = [7, 30, 90, 365] as const

export function PartnerManagerPortal({ api, context, online, tab, refresh }: { api: Portal; context: PortalContext; online: boolean; tab: string; refresh: () => Promise<void> }) {
  const partner = context.partner
  const partnerId = context.partnerId || partner?.id || ''

  // Metrics state
  const [days, setDays] = useState<number>(30)
  const [metrics, setMetrics] = useState<PartnerMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')
  const [revision, setRevision] = useState(0)

  // Employees state
  const [employees, setEmployees] = useState<PortalEmployee[]>([])
  const [employeesLoaded, setEmployeesLoaded] = useState(false)
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [empBusy, setEmpBusy] = useState(false)
  const [empError, setEmpError] = useState('')
  const [empNotice, setEmpNotice] = useState('')

  // Business edit state
  const [name, setName] = useState(partner?.name || '')
  const [segment, setSegment] = useState(partner?.segment || '')
  const [address, setAddress] = useState<PartnerAddress>(partner ? {
    street: partner.street || '',
    number: partner.number || '',
    complement: partner.complement || '',
    neighborhood: partner.neighborhood || '',
    postalCode: partner.postalCode || '',
    city: partner.city || '',
    state: partner.state || '',
  } : emptyPartnerAddress)
  const [description, setDescription] = useState(partner?.description || '')
  const [phone, setPhone] = useState(partner?.phone || '')
  const [email, setEmail] = useState(partner?.email || '')
  const [photo, setPhoto] = useState<File | null>(null)
  const [bizBusy, setBizBusy] = useState(false)
  const [bizError, setBizError] = useState('')
  const [bizNotice, setBizNotice] = useState('')

  useEffect(() => {
    if (!partner) return
    setName(partner.name || '')
    setSegment(partner.segment || '')
    setAddress({
      street: partner.street || '',
      number: partner.number || '',
      complement: partner.complement || '',
      neighborhood: partner.neighborhood || '',
      postalCode: partner.postalCode || '',
      city: partner.city || '',
      state: partner.state || '',
    })
    setDescription(partner.description || '')
    setPhone(partner.phone || '')
    setEmail(partner.email || '')
  }, [partner?.id, partner?.name, partner?.segment, partner?.address, partner?.description, partner?.phone, partner?.email])

  useEffect(() => {
    if (!online || tab !== 'metricas') return
    let active = true
    setMetricsLoading(true); setMetricsError('')
    api.partnerMetrics(days)
      .then(value => { if (active) setMetrics(value) })
      .catch(cause => { if (active) setMetricsError(cause instanceof Error ? cause.message : 'Não foi possível carregar as métricas.') })
      .finally(() => { if (active) setMetricsLoading(false) })
    return () => { active = false }
  }, [api, online, tab, days, revision])

  async function loadEmployees() {
    if (!partnerId) return
    const rows = await api.partnerEmployees(partnerId)
    setEmployees(rows)
    setEmployeesLoaded(true)
  }

  useEffect(() => {
    if (!online || tab !== 'funcionarios' || !partnerId) return
    let active = true
    api.partnerEmployees(partnerId)
      .then(rows => { if (active) { setEmployees(rows); setEmployeesLoaded(true); setEmpError('') } })
      .catch(() => { if (active) setEmpError('Não foi possível carregar os funcionários.') })
    return () => { active = false }
  }, [api, online, tab, partnerId, revision])

  async function createEmployee(event: FormEvent) {
    event.preventDefault()
    if (!online || empBusy || !partnerId) return
    setEmpBusy(true); setEmpError(''); setEmpNotice('')
    try {
      const created = await api.createPartnerEmployee(partnerId, newEmployeeName.trim())
      setEmpNotice(`Funcionário "${newEmployeeName.trim()}" cadastrado com o código ${created.code}.`)
      setNewEmployeeName('')
      await loadEmployees()
    } catch (cause) {
      setEmpError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o funcionário.')
    } finally {
      setEmpBusy(false)
    }
  }

  async function toggleEmployee(employee: PortalEmployee) {
    if (!online || empBusy) return
    setEmpBusy(true); setEmpError(''); setEmpNotice('')
    try {
      await api.saveEmployee({ ...employee, code: '', active: !employee.active })
      setEmpNotice(`Funcionário ${employee.name} ${employee.active ? 'desativado' : 'reativado'}.`)
      await loadEmployees()
    } catch (cause) {
      setEmpError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o funcionário.')
    } finally {
      setEmpBusy(false)
    }
  }

  async function reissueCode(employee: PortalEmployee) {
    if (!online || empBusy || !partnerId) return
    setEmpBusy(true); setEmpError(''); setEmpNotice('')
    try {
      const result = await api.reissueEmployeeCode(partnerId, employee.id)
      setEmpNotice(`Novo código gerado para ${employee.name}: ${result.code}.`)
      await loadEmployees()
    } catch (cause) {
      setEmpError(cause instanceof Error ? cause.message : 'Não foi possível gerar novo código.')
    } finally {
      setEmpBusy(false)
    }
  }

  async function saveBusiness(event: FormEvent) {
    event.preventDefault()
    if (!online || bizBusy || !partnerId) return
    setBizBusy(true); setBizError(''); setBizNotice('')
    try {
      let photoPath: string | null = null
      if (photo) {
        photoPath = await api.uploadPartnerPhoto(partnerId, await preparePartnerPhoto(photo))
      }
      await api.updateOwnPartner({
        name: name.trim(),
        segment: segment.trim(),
        ...address,
        description: description.trim(),
        phone: phone.trim(),
        email: email.trim(),
        photoPath,
      })
      setPhoto(null)
      await refresh()
      setBizNotice('Informações do negócio atualizadas com sucesso.')
    } catch (cause) {
      setBizError(cause instanceof Error ? cause.message : 'Não foi possível salvar as informações.')
    } finally {
      setBizBusy(false)
    }
  }

  const maxSeriesCents = Math.max(1, ...(metrics?.series.map(item => Number(item.finalCents) || 0) ?? [1]))
  const maxEmpCents = Math.max(1, ...(metrics?.byEmployee.map(item => Number(item.finalCents) || 0) ?? [1]))

  return <div className="admin-portal">
    <div className="welcome-row">
      <div>
        <h1>{tab === 'funcionarios' ? 'Funcionários e códigos' : tab === 'negocio' ? 'Meu negócio' : 'Métricas do negócio'}</h1>
        <p>{partner?.name || 'Estabelecimento'} · Gerente de parceiro</p>
      </div>
      {tab !== 'negocio' && <Button variant="outline" disabled={!online} onClick={() => setRevision(v => v + 1)}>Atualizar dados</Button>}
    </div>

    {tab === 'metricas' && <div className="billing-dashboard">
      <div className="billing-toolbar">
        <small>{metrics ? `Atualizado em ${new Date(metrics.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Recife' })}` : 'Consulte o desempenho do seu estabelecimento.'}</small>
        <div className="billing-period-group" role="group" aria-label="Período das métricas">
          {PERIODS.map(option => <button key={option} type="button" className={days === option ? 'selected' : ''} aria-pressed={days === option} disabled={metricsLoading} onClick={() => setDays(option)}>Últimos {option} dias</button>)}
        </div>
      </div>

      {metricsError && <p role="alert" className="inline-error">{metricsError}</p>}
      {metricsLoading && !metrics && <p role="status">Carregando métricas…</p>}

      {metrics && <>
        <div className="admin-stats">
          <div className="admin-stat">
            <span className="stat-top"><span>VENDAS VÁLIDAS</span><ShoppingBag size={19} /></span>
            <strong>{metrics.totals.validCount}</strong>
            <small><Users size={14} /> {metrics.totals.uniqueMembers} associado(s) único(s){metrics.totals.reversedCount > 0 ? ` · ${metrics.totals.reversedCount} estorno(s)` : ''}</small>
          </div>
          <div className="admin-stat">
            <span className="stat-top"><span>VALOR BRUTO</span><TrendingUp size={19} /></span>
            <strong>{reportMoney(metrics.totals.grossCents)}</strong>
            <small>Antes do desconto RKMED</small>
          </div>
          <div className="admin-stat">
            <span className="stat-top"><span>DESCONTOS CONCEDIDOS</span><Percent size={19} /></span>
            <strong>{reportMoney(metrics.totals.discountCents)}</strong>
            <small>Taxa atual: {partner?.discount ?? 0}%</small>
          </div>
          <div className="admin-stat">
            <span className="stat-top"><span>LÍQUIDO RECEBIDO</span><Wallet size={19} /></span>
            <strong>{reportMoney(metrics.totals.finalCents)}</strong>
            <small>Ticket médio: {reportMoney(metrics.totals.avgFinalCents)}</small>
          </div>
        </div>

        <div className="billing-charts-grid">
          <section className="surface-card billing-chart-card">
            <div className="small-section-head">
              <div>
                <h2>Evolução das vendas ({metrics.days} dias)</h2>
                <p className="billing-subtitle">Valor líquido recebido no balcão por período.</p>
              </div>
            </div>
            {metrics.series.length ? <div className="billing-bar-chart" role="list" aria-label="Evolução de vendas">
              {metrics.series.map(item => {
                const pct = Math.max(4, Math.round(((Number(item.finalCents) || 0) / maxSeriesCents) * 100))
                return <div key={item.bucket} role="listitem" className="billing-bar-col">
                  <span className="billing-bar-track" aria-hidden="true">
                    <span className="billing-bar-net" style={{ height: `${pct}%` }} />
                  </span>
                  <span className="billing-bar-label">{item.bucket}</span>
                  <small className="billing-bar-count">{reportMoney(item.finalCents)}</small>
                </div>
              })}
            </div> : <EmptyState icon={BarChart3} title="Nenhuma venda no período" description="As vendas registradas pelos seus funcionários aparecerão aqui." />}
          </section>

          <section className="surface-card counter-flow">
            <div className="small-section-head">
              <h2>Desempenho por funcionário</h2>
              <small>{metrics.byEmployee.length} cadastrado(s)</small>
            </div>
            {metrics.byEmployee.length ? <div className="partner-emp-metrics">
              {metrics.byEmployee.map(emp => {
                const width = emp.salesCount > 0 ? Math.max(6, Math.round(((Number(emp.finalCents) || 0) / maxEmpCents) * 100)) : 0
                return <div key={emp.employeeId} className="partner-emp-metric-row">
                  <div className="partner-emp-metric-head">
                    <span><b>{emp.employeeName}</b>{!emp.active && <small> (Inativo)</small>}</span>
                    <strong>{reportMoney(emp.finalCents)}</strong>
                  </div>
                  <div className="billing-progress-track"><span style={{ width: `${width}%` }} /></div>
                  <small>{emp.salesCount} venda(s) · Bruto {reportMoney(emp.grossCents)} · Desconto {reportMoney(emp.discountCents)}</small>
                </div>
              })}
            </div> : <EmptyState icon={Users} title="Nenhum funcionário cadastrado" description="Cadastre funcionários na aba Funcionários para acompanhar vendas individuais." />}
          </section>
        </div>

        <section className="surface-card counter-flow">
          <h2>Histórico de compras</h2>
          {partnerId && <PurchaseHistory api={api} online={online} revision={revision} partnerId={partnerId} />}
        </section>
      </>}
    </div>}

    {tab === 'funcionarios' && <div className="counter-flow">
      {partner?.establishmentCode && <section className="surface-card partner-code-banner">
        <div>
          <span className="registration-eyebrow">ACESSO DO BALCÃO (LOGIN VENDEDOR)</span>
          <h2>Código do estabelecimento</h2>
          <p className="billing-subtitle">Entregue este código junto com o código individual de 4 dígitos para cada vendedor acessar a aba <strong>Login vendedor</strong>.</p>
        </div>
        <strong className="employee-issued-code">{partner.establishmentCode}</strong>
      </section>}

      <section className="surface-card counter-flow">
        <h2>Cadastrar novo funcionário</h2>
        {empError && <p role="alert" className="inline-error">{empError}</p>}
        {empNotice && <p role="status" className="inline-success">{empNotice}</p>}
        <form className="counter-flow" onSubmit={event => void createEmployee(event)}>
          <label className="field-label">
            Nome do funcionário
            <input className="input" value={newEmployeeName} onChange={e => setNewEmployeeName(e.target.value)} minLength={2} maxLength={160} required disabled={!online || empBusy} placeholder="Ex: Maria Silva" />
          </label>
          <p className="billing-subtitle">O código de 4 dígitos é gerado automaticamente e fica sempre visível para você nesta tela.</p>
          <Button type="submit" disabled={!online || empBusy}>{empBusy ? 'Cadastrando…' : 'Cadastrar funcionário'}</Button>
        </form>
      </section>

      <section className="surface-card counter-flow">
        <div className="small-section-head">
          <h2>Funcionários cadastrados</h2>
          <small>{employees.length} registro(s)</small>
        </div>
        {!employeesLoaded ? <p role="status">Carregando funcionários…</p>
          : !employees.length ? <EmptyState icon={KeyRound} title="Nenhum funcionário cadastrado" description="Use o formulário acima para cadastrar o primeiro vendedor." />
          : employees.map(employee => <div className="dash-row partner-employee-row" key={employee.id}>
            <span>
              <b>{employee.name}</b>
              <small>{employee.active ? 'Ativo' : 'Inativo'} · Código: {employee.code ? <code className="employee-inline-code">{employee.code}</code> : <em>código legado (clique em gerar novo)</em>}</small>
            </span>
            <div className="row-actions">
              <Button variant="outline" disabled={!online || empBusy} onClick={() => void reissueCode(employee)}><RefreshCw size={14} aria-hidden="true" /> {employee.code ? 'Novo código' : 'Gerar código'}</Button>
              <Button variant="outline" disabled={!online || empBusy} onClick={() => void toggleEmployee(employee)}>{employee.active ? 'Desativar' : 'Reativar'}</Button>
            </div>
          </div>)}
      </section>
    </div>}

    {tab === 'negocio' && <section className="surface-card counter-flow">
      <div className="small-section-head">
        <div>
          <h2>Dados do estabelecimento</h2>
          <p className="billing-subtitle">Atualize a foto, endereço, descrição e contatos exibidos aos associados. CNPJ e percentual de desconto são geridos pela RKMED.</p>
        </div>
        <Building2 size={22} aria-hidden="true" />
      </div>

      {partner?.photoUrl && <img className="partner-detail-photo" src={partner.photoUrl} alt={`Foto atual de ${partner.name}`} />}
      <div className="billing-month-detail">
        <span>CNPJ: <b>{partner?.cnpj ? formatCnpj(partner.cnpj) : 'Não informado'}</b></span>
        <span>Desconto contratado: <b>{partner?.discount ?? 0}%</b></span>
        {partner?.establishmentCode && <span>Código do estabelecimento: <b>{partner.establishmentCode}</b></span>}
      </div>

      {bizError && <p role="alert" className="inline-error">{bizError}</p>}
      {bizNotice && <p role="status" className="inline-success">{bizNotice}</p>}

      <form className="counter-flow" onSubmit={event => void saveBusiness(event)}>
        <label className="field-label">Nome do estabelecimento<input className="input" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={160} disabled={bizBusy} /></label>
        <label className="field-label">Categoria<input className="input" value={segment} onChange={e => setSegment(e.target.value)} required minLength={2} maxLength={160} disabled={bizBusy} /></label>
        <PartnerAddressFields value={address} onChange={setAddress} disabled={bizBusy} />
        <label className="field-label">Descrição<textarea className="input" value={description} onChange={e => setDescription(e.target.value)} required minLength={2} maxLength={1000} disabled={bizBusy} /></label>
        <label className="field-label">Telefone de contato<input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={32} disabled={bizBusy} /></label>
        <label className="field-label">E-mail de contato<input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} disabled={bizBusy} /></label>
        <label className="field-label">Nova foto do estabelecimento (opcional)<input className="input" type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)} disabled={bizBusy} /></label>
        <div className="row-actions">
          <Button type="submit" disabled={!online || bizBusy}>{bizBusy ? 'Salvando…' : 'Salvar alterações'}</Button>
        </div>
      </form>
    </section>}
  </div>
}
