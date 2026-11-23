import { preparePartnerPhoto } from '../../lib/partner-photo'
import { PartnerRegistration } from './PartnerRegistration'
import { PartnerEmployees } from './PartnerEmployees'
import { PurchaseHistory } from '../partner/PurchaseHistory'
import { PartnerAddressFields, emptyPartnerAddress, type PartnerAddress } from './PartnerAddressFields'
import { PartnerLocation } from '../../components/PartnerLocation'
import { useEffect, useState } from 'react'
import type { Portal } from '../../integrations/portal'
import type { PublicPartner } from '../../integrations/contracts'
import { formatCnpj, validCnpj } from '../../lib/format'
import { Button } from '../../components/ui/button'
import { Store } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'
import { PageControls } from '../../components/PageControls'
import { useClientPage } from '../../lib/useClientPage'

type StaffPartner = PublicPartner & { active: boolean; isTest: boolean; establishmentCode: string | null; street?: string; number?: string | null; complement?: string | null; neighborhood?: string; postalCode?: string; city?: string; state?: string; cnpj?: string | null; phone?: string | null; email?: string | null }

export function ConnectedPartners({ api, actorId, viewer, online, done, revision }: { api: Portal; actorId: string; viewer: boolean; online: boolean; done: () => Promise<void>; revision: number }) {
  const [partners, setPartners] = useState<StaffPartner[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [id, setId] = useState(''); const [name, setName] = useState(''); const [segment, setSegment] = useState('')
  const [address, setAddress] = useState<PartnerAddress>(emptyPartnerAddress); const [description, setDescription] = useState('')
  const [cnpj, setCnpj] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState(''); const [rate, setRate] = useState('')
  const [active, setActive] = useState(true); const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  async function refresh() { const rows = await api.staffPartners() as StaffPartner[]; setPartners(rows); setLoaded(true); return rows }
  useEffect(() => { if (online) void refresh().catch(() => setError('Não foi possível carregar os parceiros.')) }, [api, online, revision])
  function choose(value: string) {
    setEditing(false); const p = partners.find(item => item.id === value); setId(value); setName(p?.name || ''); setSegment(p?.segment || '')
    setAddress(p ? { street: p.street || '', number: p.number || '', complement: p.complement || '', neighborhood: p.neighborhood || '', postalCode: p.postalCode || '', city: p.city || '', state: p.state || '' } : emptyPartnerAddress)
    setDescription(p?.description || ''); setCnpj(p?.cnpj || ''); setPhone(p?.phone || ''); setEmail(p?.email || '')
    setRate(p ? String(p.discount) : ''); setActive(p?.active ?? true); setPhoto(null); setNotice(''); setError('')
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !online) return
    setBusy(true); setError(''); setNotice('')
    const percent = Number(rate)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) { setError('Desconto inválido.'); setBusy(false); return }
    if (!validCnpj(cnpj)) { setError('Informe um CNPJ válido.'); setBusy(false); return }
    try {
      const partnerId = await api.savePartner({ id: id || undefined, name: name.trim(), segment: segment.trim(), ...address, description: description.trim(), cnpj, phone: phone.trim(), email: email.trim(), discountBps: Math.round(percent * 100), active })
      if (photo) {
        try { const path = await api.uploadPartnerPhoto(partnerId, await preparePartnerPhoto(photo)); await api.savePartner({ id: partnerId, name: name.trim(), segment: segment.trim(), ...address, description: description.trim(), cnpj, phone: phone.trim(), email: email.trim(), discountBps: Math.round(percent * 100), photoPath: path, active }) }
        catch { setNotice('Dados salvos, mas a foto não foi enviada. Selecione-a novamente e salve para tentar outra vez.'); await refresh(); await done(); return }
      }
      await refresh(); await done(); setId(partnerId); setPhoto(null); setNotice('Parceiro salvo. O novo desconto será aplicado às próximas compras.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.') }
    finally { setBusy(false) }
  }
  function matchesSearch(partner: StaffPartner) { const query = search.trim().toLocaleLowerCase('pt-BR'); const document = search.toUpperCase().replace(/[^A-Z0-9]/g, ''); return !query || [partner.name, partner.segment, partner.address].some(value => value.toLocaleLowerCase('pt-BR').includes(query)) || !!document && !!partner.cnpj && partner.cnpj.toUpperCase().includes(document) }
  const filteredPartners = partners.filter(matchesSearch)
  const partnersPage = useClientPage(filteredPartners, 10, { resetKey: search })
  return <section className="surface-card counter-flow">
    {notice && <p role="status" className="inline-success">{notice}</p>}
    {loaded && !partners.length && <EmptyState icon={Store} title="Nenhum parceiro cadastrado" description={viewer ? 'Os parceiros cadastrados aparecerão aqui.' : 'Use Adicionar parceiro para adicionar o primeiro estabelecimento.'} />}
    {!viewer && <PartnerRegistration api={api} actorId={actorId} online={online} onSuccess={async (name, partnerId, warning) => { const message = warning || `Parceiro ${name} cadastrado.`; setNotice(message); try { const rows = await refresh(); const created = rows.find(row => row.id === partnerId); setNotice(`${message}${created && !matchesSearch(created) ? ' O registro não corresponde à busca atual.' : ''}`); await done() } catch { setNotice(`${message} Atualize a lista para consultar os dados.`) } }} />}
    <label className="field-label">Buscar parceiro por nome, categoria, endereço ou CNPJ<input className="input" value={search} onChange={event => setSearch(event.target.value)} maxLength={160} /></label>
    {!loaded && !error && <p role="status">{online ? 'Carregando parceiros…' : 'Conecte-se para consultar parceiros.'}</p>}
    {!loaded && error && <Button variant="outline" disabled={!online} onClick={() => { setError(''); void refresh().catch(() => setError('Não foi possível carregar os parceiros.')) }}>Tentar carregar parceiros novamente</Button>}
    {loaded && partners.length > 0 && !filteredPartners.length && <EmptyState icon={Store} title="Nenhum parceiro encontrado" description="Confira os dados informados ou limpe a busca." />}
    {loaded && partners.length > 0 && !filteredPartners.length && <Button variant="outline" onClick={() => setSearch('')}>Limpar busca</Button>}
    {partnersPage.items.map(p => <article key={p.id} className="partner-directory-entry">
      <button type="button" className="partner-detail-trigger" disabled={busy} aria-expanded={id === p.id} aria-controls={`partner-${p.id}`} onClick={() => choose(id === p.id ? '' : p.id)}><span><b>{p.name}</b><small>{p.segment} · {p.active ? 'Ativo' : 'Inativo'}</small></span><span>{p.discount}% · {id === p.id ? 'Fechar' : 'Ver detalhes'}</span></button>
      {id === p.id && <div id={`partner-${p.id}`} className="counter-flow partner-detail-content">
        {p.photoUrl && <img className="partner-detail-photo" src={p.photoUrl} alt={`Foto de ${p.name}`} />}
        {p.isTest && <p>Parceiro de teste · oculto dos associados</p>}
        <p>{p.address}</p>{p.description && <p>{p.description}</p>}
        {!viewer && <><p>CNPJ: {p.cnpj ? formatCnpj(p.cnpj) : 'Não informado'}</p>{p.phone && <p>Telefone: {p.phone}</p>}{p.email && <p>E-mail: {p.email}</p>}{p.establishmentCode && <p>Código do estabelecimento: <code>{p.establishmentCode}</code></p>}<Button variant="outline" disabled={!online} onClick={() => { setEditing(true); requestAnimationFrame(() => { const form = document.querySelector<HTMLFormElement>('form[aria-label="Dados do parceiro"]'); form?.scrollIntoView({ behavior: 'smooth', block: 'start' }); form?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }) }) }}>Editar parceiro</Button></>}
        <PartnerLocation partner={p} />
        {!viewer && <PartnerEmployees key={p.id} api={api} partnerId={p.id} online={online} />}
        <section className="counter-flow"><h3>Uso registrado</h3><p>Compras e descontos registrados neste parceiro.</p><PurchaseHistory key={p.id} api={api} online={online} revision={revision} partnerId={p.id} /></section>
      </div>}
    </article>)}
    {partnersPage.totalPages > 1 && <PageControls label="Páginas de parceiros" page={partnersPage} />}
    {!viewer && editing && <form className="counter-flow" aria-label="Dados do parceiro" onSubmit={event => void submit(event)}><h2>{id ? 'Editar parceiro' : 'Cadastrar parceiro'}</h2>
      <label className="field-label">Nome<input className="input" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={160} /></label>
      <label className="field-label">Categoria<input className="input" value={segment} onChange={event => setSegment(event.target.value)} required maxLength={160} /></label>
      <PartnerAddressFields value={address} onChange={setAddress} disabled={busy} />
      <label className="field-label">Descrição<input className="input" value={description} onChange={event => setDescription(event.target.value)} required minLength={2} maxLength={1000} /></label>
      <label className="field-label">CNPJ<input className="input" value={formatCnpj(cnpj)} onChange={event => setCnpj(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14))} required maxLength={18} autoComplete="off" /></label>
      <label className="field-label">Contato (telefone)<input className="input" type="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={32} /></label>
      <label className="field-label">Contato (e-mail)<input className="input" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} /></label>
      <label className="field-label">Foto do parceiro<input className="input" type="file" accept="image/*" onChange={event => setPhoto(event.target.files?.[0] || null)} /></label>
      <label className="field-label">Desconto (%)<input className="input" type="number" min="0" max="100" step="0.01" value={rate} onChange={event => setRate(event.target.value)} required /></label>
      <label className="field-label"><span><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} /> Parceiro ativo</span></label>
      <div className="row-actions"><Button type="submit" disabled={!online || busy}>{busy ? 'Salvando…' : 'Salvar parceiro'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Fechar edição</Button></div>
    </form>}
    {error && <p role="alert" className="inline-error">{error}</p>}
  </section>
}
