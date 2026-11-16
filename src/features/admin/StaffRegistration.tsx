import { RegistrationErrors, useRegistrationErrors } from '../../components/RegistrationErrors'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Portal, StaffRole } from '../../integrations/portal'
import { Button } from '../../components/ui/button'
import { RegistrationDialog } from '../../components/RegistrationDialog'
import { useRegistrationDraft } from '../../lib/useRegistrationDraft'

const steps = ['Identificação', 'Acesso e permissões', 'Revisão'] as const
const initial = { email: '', role: 'admin', partnerId: '' }
const allowed = Object.keys(initial)
const roles: Record<StaffRole, string> = { admin: 'Administrador', support: 'Suporte RKMED', viewer: 'Diretoria', partner: 'Parceiro' }
export function StaffRegistration({ api, actorId, online, partners, onSuccess }: { api: Portal; actorId: string; online: boolean; partners: Awaited<ReturnType<Portal['staffPartners']>>; onSuccess: (email: string, partnerName: string) => void }) {
  const draft = useRegistrationDraft(actorId, 'staff', initial, allowed, 2)
  const [password, setPassword] = useState('')
  const validation = useRegistrationErrors()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (error) errorRef.current?.focus() }, [error, draft.step])
  const operation = useRef(crypto.randomUUID())
  const fields = draft.fields
  function close() { validation.clear(); draft.discard(); setPassword(''); setError(''); operation.current = crypto.randomUUID() }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !online) return
    setError(''); validation.clear()
    if (draft.step < 2) { draft.changeStep(draft.step + 1); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) { setError('Informe um e-mail válido.'); draft.changeStep(0); return }
    if (!Object.hasOwn(roles, fields.role) || (fields.role === 'partner' && !partners.some(p => p.id === fields.partnerId && p.active))) { setError('Selecione um perfil e um estabelecimento ativo.'); draft.changeStep(1); return }
    if (password.length < 12 || password.length > 128) { setError('Informe novamente uma senha entre 12 e 128 caracteres.'); draft.changeStep(1); return }
    setBusy(true)
    try {
      await api.command('staff', { staffAction: 'create', operationId: operation.current, email: fields.email.trim().toLowerCase(), password, role: fields.role, partnerId: fields.role === 'partner' ? fields.partnerId : null })
      const email = fields.email.trim().toLowerCase(); const partnerName = fields.role === 'partner' ? partners.find(p => p.id === fields.partnerId)?.name || '' : ''; close(); onSuccess(email, partnerName)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar o acesso. Tente novamente.') }
    finally { setBusy(false) }
  }
  return <><Button variant="outline" disabled={!online} onClick={() => { setError(''); setPassword(''); draft.start() }}>Adicionar administrador</Button>
    {draft.open && <RegistrationDialog title="Criar acesso interno" description="Configure um novo acesso para a equipe RKMED." step={draft.step} steps={steps} stepDescriptions={["Informe o e-mail de quem receberá o acesso.", "Defina as permissões e uma senha inicial para este acesso.", "Confira o e-mail e as permissões antes de criar o acesso."]} onClose={close} busy={busy}>
      {!online && <p role="status">Conecte-se à internet para concluir o cadastro.</p>}
      {draft.recovered && <p role="status">Recuperamos seu preenchimento. Informe novamente a senha inicial.</p>}
      {draft.storage && <p role="status">{draft.storage === 'saved' ? 'Rascunho salvo neste navegador.' : 'A recuperação do rascunho está indisponível neste navegador.'}</p>}
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="inline-error">{error}</p>}
      <RegistrationErrors errors={validation.errors} />
      <form className="counter-flow registration-form" onInvalid={validation.onInvalid} onSubmit={event => void submit(event)}>
        {draft.step === 0 && <label className="field-label">E-mail do novo acesso (obrigatório)<input id="staff-email" aria-invalid={!!validation.errors.find(item => item.id === "staff-email")} aria-describedby={validation.errors.some(item => item.id === "staff-email") ? "staff-email-error" : undefined} className="input" type="email" autoComplete="email" required maxLength={254} value={fields.email} onChange={e => draft.update({ ...fields, email: e.target.value })} />{validation.errors.filter(item => item.id === "staff-email").map(item => <small id="staff-email-error" className="field-error" key={item.id}>{item.message}</small>)}</label>}
        {draft.step === 1 && <><label className="field-label">Perfil (obrigatório)<select id="staff-role" aria-invalid={!!validation.errors.find(item => item.id === "staff-role")} aria-describedby={validation.errors.some(item => item.id === "staff-role") ? "staff-role-error" : undefined} className="input" value={fields.role} onChange={e => draft.update({ ...fields, role: e.target.value, partnerId: '' })}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{validation.errors.filter(item => item.id === "staff-role").map(item => <small id="staff-role-error" className="field-error" key={item.id}>{item.message}</small>)}</label>
          {fields.role === 'partner' && <label className="field-label">Estabelecimento (obrigatório)<select id="staff-partner" aria-invalid={!!validation.errors.find(item => item.id === "staff-partner")} aria-describedby={validation.errors.some(item => item.id === "staff-partner") ? "staff-partner-error" : undefined} className="input" required value={fields.partnerId} onChange={e => draft.update({ ...fields, partnerId: e.target.value })}><option value="">Selecione</option>{partners.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{validation.errors.filter(item => item.id === "staff-partner").map(item => <small id="staff-partner-error" className="field-error" key={item.id}>{item.message}</small>)}</label>}
          <label className="field-label">Senha inicial (obrigatório; 12 a 128 caracteres)<input id="staff-password" aria-invalid={!!validation.errors.find(item => item.id === "staff-password")} aria-describedby={validation.errors.some(item => item.id === "staff-password") ? "staff-password-error" : undefined} className="input" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} />{validation.errors.filter(item => item.id === "staff-password").map(item => <small id="staff-password-error" className="field-error" key={item.id}>{item.message}</small>)}</label></>}
        {draft.step === 2 && <><p>E-mail: <strong>{fields.email}</strong></p><Button type="button" variant="ghost" disabled={busy} onClick={() => { validation.clear(); draft.changeStep(0) }}>Editar identificação</Button><p>Perfil: {roles[fields.role as StaffRole]}{fields.role === 'partner' ? ` · ${partners.find(p => p.id === fields.partnerId)?.name || 'Estabelecimento não encontrado'}` : ''}</p><p>A senha inicial não é exibida nesta revisão.</p><Button type="button" variant="ghost" disabled={busy} onClick={() => { validation.clear(); draft.changeStep(1) }}>Editar acesso e permissões</Button></>}
        <div className="row-actions">{draft.step > 0 && <Button type="button" variant="outline" disabled={busy} onClick={() => { setError(''); validation.clear(); draft.changeStep(draft.step - 1) }}>Voltar</Button>}<Button type="submit" disabled={busy || !online}>{busy ? 'Criando…' : draft.step === 2 ? (fields.role === 'admin' ? 'Criar administrador' : 'Criar acesso') : 'Continuar'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={close}>Cancelar</Button></div>
      </form>
    </RegistrationDialog>}</>
}
