import { PartnerLocation } from '../../components/PartnerLocation'
import { useEffect, useState } from 'react'
import type { Portal } from '../../integrations/portal'
import type { PublicPartner } from '../../integrations/contracts'
import { Button } from '../../components/ui/button'
export function ConnectedPartners({ api, viewer, online, done }: { api: Portal; viewer: boolean; online: boolean; done: () => Promise<void> }) {
  const [partners, setPartners] = useState<(PublicPartner & { active: boolean; establishmentCode: string | null })[]>([])
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [segment, setSegment] = useState('')
  const [address, setAddress] = useState('')
  const [rate, setRate] = useState('')
  const [active, setActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { if (online) api.staffPartners().then(setPartners).catch(() => setError('Não foi possível carregar os parceiros.')) }, [api, online])
  function choose(value: string) { const p = partners.find(p => p.id === value); setId(value); setName(p?.name || ''); setSegment(p?.segment || ''); setAddress(p?.address || ''); setRate(p ? String(p.discount) : ''); setActive(p?.active ?? true); setNotice('') }
  return <section className="surface-card counter-flow">{partners.map(p => <article key={p.id} className="partner-directory-entry"><div className="dash-row"><span><b>{p.name}</b><small>{p.address} · {p.active ? 'Ativo' : 'Inativo'}</small>{p.establishmentCode && <small>Código do estabelecimento: <code>{p.establishmentCode}</code></small>}</span><strong>{p.discount}%</strong></div><PartnerLocation partner={p} /></article>)}{!viewer && <form onSubmit={e => { e.preventDefault(); if (busy || !online) return; setBusy(true); setError(''); setNotice(''); const percent = Number(rate); if (!Number.isFinite(percent) || percent < 0 || percent > 100) { setError('Desconto inválido.'); setBusy(false); return } void api.savePartner({ id: id || undefined, name, segment, address, discountBps: Math.round(percent * 100), active }).then(async () => { setPartners(await api.staffPartners()); await done(); setNotice('Parceiro salvo. O novo desconto será aplicado às próximas compras.') }).catch(e => setError(e instanceof Error ? e.message : 'Não foi possível salvar.')).finally(() => setBusy(false)) }}><h2>{id ? 'Editar parceiro' : 'Cadastrar parceiro'}</h2><label className="field-label">Selecionar parceiro<select className="input" value={id} onChange={e => choose(e.target.value)} disabled={busy}><option value="">Novo parceiro</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="field-label">Nome<input className="input" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={160} /></label><label className="field-label">Categoria<input className="input" value={segment} onChange={e => setSegment(e.target.value)} required /></label><label className="field-label">Endereço<input className="input" value={address} onChange={e => setAddress(e.target.value)} required /></label><label className="field-label">Desconto (%)<input className="input" type="number" min="0" max="100" step="0.01" value={rate} onChange={e => setRate(e.target.value)} required /></label><label className="field-label"><span><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Parceiro ativo</span></label><Button type="submit" disabled={!online || busy}>Salvar parceiro</Button></form>}{notice && <p role="status" className="inline-success">{notice}</p>}{error && <p role="alert" className="inline-error">{error}</p>}</section>
}
