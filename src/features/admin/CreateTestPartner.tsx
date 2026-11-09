import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/button'
import type { Portal, TestPartnerResult } from '../../integrations/portal'

type Draft = { name: string; segment: string; address: string; discountBps: number; email: string; employeeName: string; employeeCode: string; password: string; operationId: string }
export function CreateTestPartner({ api, online, done }: { api: Portal; online: boolean; done: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [initial, setInitial] = useState<Draft | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TestPartnerResult | null>(null)
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const discount = Number(data.get('discount'))
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) { setError('Desconto inválido.'); return }
    setError('')
    setDraft({ name: String(data.get('name')).trim(), segment: String(data.get('segment')).trim(), address: String(data.get('address')).trim(),
      discountBps: Math.round(discount * 100), email: String(data.get('email')).trim().toLowerCase(), password: String(data.get('password')),
      employeeName: String(data.get('employeeName')).trim(), employeeCode: String(data.get('employeeCode')), operationId: crypto.randomUUID() })
  }
  async function create() {
    if (!draft || !online || busy) return
    setBusy(true); setError(''); setAttempted(true)
    try {
      const value = await api.command<TestPartnerResult>('test-partner', draft)
      setResult(value); setInitial(null); setDraft(null); setOpen(false); setAttempted(false)
      // The creation has succeeded even if refreshing the surrounding list fails.
      try { await done() } catch { setError('Parceiro criado. Atualize a lista para consultar os dados.') }
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente para verificar o cadastro.') }
    finally { setBusy(false) }
  }
  return <section className="counter-flow" aria-label="Cadastro de parceiro de teste">
    <div className="small-section-head"><h2>Parceiro de teste</h2>{!open && <Button variant="outline" disabled={!online} onClick={() => { setOpen(true); setInitial(null); setResult(null); setError('') }}>Criar parceiro de teste</Button>}</div>
    <p>Cadastre estabelecimento, acesso e primeiro funcionário juntos. O parceiro fica oculto da rede dos associados e pode acessar o balcão neste ambiente de homologação.</p>
    {!online && <p role="status">Conecte-se para criar o parceiro de teste.</p>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    {open && !draft && <form className="counter-flow" onSubmit={review}>
      <label className="field-label">Nome do estabelecimento de teste<input className="input" name="name" defaultValue={initial?.name || ''} minLength={2} maxLength={160} required disabled={!online} /></label>
      <label className="field-label">Categoria do estabelecimento de teste<input className="input" name="segment" defaultValue={initial?.segment || ''} maxLength={160} required disabled={!online} /></label>
      <label className="field-label">Endereço do estabelecimento de teste<input className="input" name="address" defaultValue={initial?.address || ''} maxLength={500} required disabled={!online} /></label>
      <label className="field-label">Desconto do parceiro de teste (%)<input className="input" name="discount" defaultValue={initial ? initial.discountBps / 100 : ''} type="number" min="0" max="100" step="0.01" required disabled={!online} /></label>
      <label className="field-label">E-mail do parceiro de teste<input className="input" name="email" defaultValue={initial?.email || ''} type="email" maxLength={254} autoComplete="off" required disabled={!online} /></label>
      <label className="field-label">Senha inicial do parceiro de teste<input className="input" name="password" defaultValue={initial?.password || ''} type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={!online} /></label>
      <label className="field-label">Nome do primeiro funcionário<input className="input" name="employeeName" defaultValue={initial?.employeeName || ''} minLength={2} maxLength={160} required disabled={!online} /></label>
      <label className="field-label">Código do primeiro funcionário<input className="input" name="employeeCode" defaultValue={initial?.employeeCode || ''} type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,12}" minLength={4} maxLength={12} required disabled={!online} /></label>
      <Button type="submit" disabled={!online}>Revisar cadastro de teste</Button>
      <Button type="button" variant="ghost" onClick={() => { setOpen(false); setInitial(null); setError('') }}>Cancelar cadastro de teste</Button>
    </form>}
    {draft && <section className="counter-flow staff-confirmation" aria-label="Revisar parceiro de teste">
      <h3>Confirmar cadastro de teste</h3><p><strong>{draft.name}</strong> · {draft.segment}</p><p>{draft.address}</p><p>Desconto: {draft.discountBps / 100}%</p><p>Acesso: {draft.email}</p><p>Funcionário: {draft.employeeName}</p>
      <p>O estabelecimento será criado ativo e oculto dos associados. Guarde a senha inicial e o código do funcionário para entrar no balcão.</p>
      {attempted && <p role="status">Se houve falha de conexão, tente novamente para verificar ou concluir o mesmo cadastro. Para retomar um cadastro pendente, mantenha os mesmos dados e o código do funcionário. Os dados e a senha ficam somente na memória desta tela.</p>}
      <Button type="button" disabled={busy || !online} onClick={() => void create()}>{busy ? 'Criando parceiro…' : attempted ? 'Verificar e concluir cadastro' : 'Confirmar criação do parceiro de teste'}</Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => { setInitial(draft); setDraft(null); setAttempted(false); setError('') }}>Revisar dados do cadastro</Button>
    </section>}
    {result && <section className="counter-flow" role="status" aria-label="Parceiro de teste criado"><h3>Parceiro de teste criado</h3><p><strong>{result.name}</strong></p><p>E-mail: {result.email}</p><p>Código do estabelecimento: <code>{result.establishmentCode}</code></p><p>Funcionário: {result.employeeName}</p><p>Entre em Acesso da equipe com o e-mail e a senha cadastrados. Depois informe o código do estabelecimento acima e o código do funcionário escolhido no cadastro.</p><p>A senha e o código do funcionário não são exibidos novamente. Gerencie a conta em Equipe → Acessos internos.</p></section>}
  </section>
}
