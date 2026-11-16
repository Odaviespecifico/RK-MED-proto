import { preparePartnerPhoto } from '../../lib/partner-photo'
import { RegistrationErrors, useRegistrationErrors } from '../../components/RegistrationErrors'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Portal } from '../../integrations/portal'
import { Button } from '../../components/ui/button'
import { RegistrationDialog } from '../../components/RegistrationDialog'
import { useRegistrationDraft } from '../../lib/useRegistrationDraft'
import { validCnpj, formatCnpj } from '../../lib/format'
import { PartnerAddressFields } from './PartnerAddressFields'

const steps = ['Identificação', 'Endereço e contato', 'Revisão'] as const
const initial = { name: '', segment: '', description: '', cnpj: '', rate: '', street: '', number: '', complement: '', neighborhood: '', postalCode: '', city: '', state: '', phone: '', email: '', active: true }
const allowed = Object.keys(initial)

export function PartnerRegistration({ api, actorId, online, onSuccess }: { api: Portal; actorId: string; online: boolean; onSuccess: (name: string, partnerId: string, warning?: string) => Promise<void> }) {
  const draft = useRegistrationDraft(actorId, 'partner', initial, allowed, 2)
  const validation = useRegistrationErrors()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (error) errorRef.current?.focus() }, [error, draft.step])
  const [photo, setPhoto] = useState<File | null>(null)
  const fields = draft.fields
  function set(name: keyof typeof initial, value: string | boolean) { draft.update({ ...fields, [name]: value }) }
  function close() { validation.clear(); draft.discard(); setPhoto(null); setError('') }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !online) return
    setError(''); validation.clear()
    if (draft.step === 0 && !validCnpj(fields.cnpj)) { setError('Informe um CNPJ válido, com 14 caracteres e dígitos verificadores corretos.'); return }
    if (draft.step < 2) { draft.changeStep(draft.step + 1); return }
    // Revalidate restored values; a draft is never proof of validity.
    if (!validCnpj(fields.cnpj) || fields.name.trim().length < 2 || !fields.segment.trim() || fields.description.trim().length < 2 || fields.rate.trim() === '' || !Number.isFinite(Number(fields.rate)) || Number(fields.rate) < 0 || Number(fields.rate) > 100) { setError('Revise os dados de identificação e o desconto.'); draft.changeStep(0); return }
    if (!/^\d{8}$/.test(fields.postalCode) || fields.street.trim().length < 2 || !fields.neighborhood.trim() || !fields.city.trim() || !/^[A-Z]{2}$/.test(fields.state)) { setError('Revise o CEP e os campos obrigatórios do endereço.'); draft.changeStep(1); return }
    setBusy(true)
    try {
      const details = { ...fields, name: fields.name.trim(), segment: fields.segment.trim(), description: fields.description.trim(), phone: fields.phone.trim(), email: fields.email.trim(), discountBps: Math.round(Number(fields.rate) * 100) }
      const partnerId = await api.savePartner(details)
      let warning = ''
      if (photo) {
        try {
          const blob = await preparePartnerPhoto(photo)
          const path = await api.uploadPartnerPhoto(partnerId, blob)
          await api.savePartner({ ...details, id: partnerId, photoPath: path })
        } catch { warning = 'Parceiro cadastrado, mas a foto não foi salva. Edite o parceiro para tentar novamente.' }
      }
      close()
      try { await onSuccess(details.name, partnerId, warning) } catch { setError('Parceiro cadastrado. Atualize a lista para consultar os dados.') }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o parceiro. Tente novamente.') }
    finally { setBusy(false) }
  }
  const address = { street: fields.street, number: fields.number, complement: fields.complement, neighborhood: fields.neighborhood, postalCode: fields.postalCode, city: fields.city, state: fields.state }
  return <>
    <Button variant="outline" disabled={!online} onClick={() => { setError(''); draft.start() }}>Adicionar parceiro</Button>
    {draft.open && <RegistrationDialog title="Cadastrar parceiro" description="Adicione um estabelecimento à rede de parceiros RKMED." step={draft.step} steps={steps} stepDescriptions={["Comece pelos dados do estabelecimento e pelo benefício oferecido.", "Informe onde o parceiro está e como entrar em contato.", "Confira os dados antes de concluir o cadastro."]} onClose={close} busy={busy}>
      {!online && <p role="status">Conecte-se à internet para concluir o cadastro.</p>}
      {draft.recovered && <p role="status">Recuperamos seu preenchimento. Selecione a foto novamente, se necessário.</p>}
      {draft.storage && <p role="status">{draft.storage === 'saved' ? 'Rascunho salvo neste navegador.' : 'A recuperação do rascunho está indisponível neste navegador.'}</p>}
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="inline-error">{error}</p>}
      <RegistrationErrors errors={validation.errors} />
      <form className="counter-flow registration-form" onInvalid={validation.onInvalid} onSubmit={event => void submit(event)}>
        {draft.step === 0 && <>
          <label className="field-label">Nome do parceiro (obrigatório)<input id="partner-name" aria-invalid={!!validation.errors.find(item => item.id === "partner-name")} aria-describedby={validation.errors.some(item => item.id === "partner-name") ? "partner-name-error" : undefined} className="input" value={fields.name} onChange={e => set('name', e.target.value)} required minLength={2} maxLength={160} autoComplete="organization" />{validation.errors.filter(item => item.id === "partner-name").map(item => <small id="partner-name-error" className="field-error" key={item.id}>{item.message}</small>)}</label>
          <label className="field-label">Categoria (obrigatório)<input id="partner-segment" aria-invalid={!!validation.errors.find(item => item.id === "partner-segment")} aria-describedby={validation.errors.some(item => item.id === "partner-segment") ? "partner-segment-error" : undefined} className="input" value={fields.segment} onChange={e => set('segment', e.target.value)} required maxLength={160} />{validation.errors.filter(item => item.id === "partner-segment").map(item => <small id="partner-segment-error" className="field-error" key={item.id}>{item.message}</small>)}</label>
          <label className="field-label">CNPJ (obrigatório)<input id="partner-cnpj" aria-invalid={!!validation.errors.find(item => item.id === 'partner-cnpj') || error.startsWith('Informe um CNPJ')} aria-describedby={validation.errors.some(item => item.id === 'partner-cnpj') ? 'partner-cnpj-error' : error.startsWith('Informe um CNPJ') ? 'partner-cnpj-custom' : undefined} className="input" placeholder="Ex.: 00.000.000/0000-00" value={formatCnpj(fields.cnpj)} onChange={e => set('cnpj', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14))} required maxLength={18} />{validation.errors.filter(item => item.id === "partner-cnpj").map(item => <small id="partner-cnpj-error" className="field-error" key={item.id}>{item.message}</small>)}</label>
          {error.startsWith('Informe um CNPJ') && <small id="partner-cnpj-custom" className="field-error">{error}</small>}
          <label className="field-label">Desconto em % (obrigatório)<input id="partner-rate" aria-invalid={!!validation.errors.find(item => item.id === "partner-rate")} aria-describedby={validation.errors.some(item => item.id === "partner-rate") ? "partner-rate-error" : undefined} className="input" type="number" min="0" max="100" step="0.01" value={fields.rate} onChange={e => set('rate', e.target.value)} required />{validation.errors.filter(item => item.id === "partner-rate").map(item => <small id="partner-rate-error" className="field-error" key={item.id}>{item.message}</small>)}</label>
          <label className="field-label">Descrição (obrigatório)<input id="partner-description" aria-invalid={!!validation.errors.find(item => item.id === "partner-description")} aria-describedby={validation.errors.some(item => item.id === "partner-description") ? "partner-description-error" : undefined} className="input" value={fields.description} onChange={e => set('description', e.target.value)} required minLength={2} maxLength={1000} />{validation.errors.filter(item => item.id === "partner-description").map(item => <small id="partner-description-error" className="field-error" key={item.id}>{item.message}</small>)}</label>
          <label className="field-label"><span><input type="checkbox" checked={fields.active} onChange={e => set('active', e.target.checked)} /> Parceiro ativo</span></label>
        </>}
        {draft.step === 1 && <><PartnerAddressFields errors={validation.errors} value={address} onChange={value => draft.update({ ...fields, ...value })} disabled={busy} />
          <label className="field-label">Telefone (opcional)<input id="partner-phone" aria-invalid={!!validation.errors.find(item => item.id === "partner-phone")} aria-describedby={validation.errors.some(item => item.id === "partner-phone") ? "partner-phone-error" : undefined} className="input" type="tel" autoComplete="tel" value={fields.phone} onChange={e => set('phone', e.target.value)} maxLength={32} />{validation.errors.filter(item => item.id === "partner-phone").map(item => <small id="partner-phone-error" className="field-error" key={item.id}>{item.message}</small>)}</label>
          <label className="field-label">E-mail de contato (opcional)<input id="partner-email" aria-invalid={!!validation.errors.find(item => item.id === "partner-email")} aria-describedby={validation.errors.some(item => item.id === "partner-email") ? "partner-email-error" : undefined} className="input" type="email" autoComplete="email" value={fields.email} onChange={e => set('email', e.target.value)} maxLength={254} />{validation.errors.filter(item => item.id === "partner-email").map(item => <small id="partner-email-error" className="field-error" key={item.id}>{item.message}</small>)}</label>
          <label className="field-label">Foto (opcional; até 10 MB)<input className="input" type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0] || null; if (file && (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024)) { setPhoto(null); e.target.value = ''; setError('Escolha uma imagem de até 10 MB.'); return } setError(''); setPhoto(file) }} /></label>{photo && <small>Foto selecionada: {photo.name}</small>}</>}
        {draft.step === 2 && <><p><strong>{fields.name}</strong> · {fields.segment} · {formatCnpj(fields.cnpj)}</p><p>{fields.description} · {fields.rate}% de desconto · {fields.active ? 'Ativo' : 'Inativo'}</p><Button type="button" variant="ghost" disabled={busy} onClick={() => { validation.clear(); draft.changeStep(0) }}>Editar identificação</Button><p>{fields.street}, {fields.number} {fields.complement} · {fields.neighborhood} · {fields.city}/{fields.state} · {fields.postalCode}</p><p>{fields.phone || 'Telefone não informado'} · {fields.email || 'E-mail não informado'} · {photo ? 'Foto selecionada' : 'Sem foto'}</p><Button type="button" variant="ghost" disabled={busy} onClick={() => { validation.clear(); draft.changeStep(1) }}>Editar endereço e contato</Button></>}
        <div className="row-actions">{draft.step > 0 && <Button type="button" variant="outline" disabled={busy} onClick={() => { setError(''); validation.clear(); draft.changeStep(draft.step - 1) }}>Voltar</Button>}<Button type="submit" disabled={busy || !online}>{busy ? 'Cadastrando…' : draft.step === 2 ? 'Cadastrar parceiro' : 'Continuar'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={close}>Cancelar</Button></div>
      </form>
    </RegistrationDialog>}
  </>
}
