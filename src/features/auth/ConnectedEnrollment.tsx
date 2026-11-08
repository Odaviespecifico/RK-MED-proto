import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '../../components/ui/button'
import { Brand } from '../../components/identity'
import type { Portal, PortalContext } from '../../integrations/portal'
import { normalizeContact, createMemberAuth } from '../../integrations/auth'
import { createSandboxBilling } from '../../integrations/billing'
import { detectFace } from '../../lib/face'
import { isAdult, onlyDigits, validCpf } from '../../lib/format'
const Camera = lazy(() => import('../../LiveFaceCamera').then(m => ({ default: m.LiveFaceCamera })))
export function ConnectedEnrollment({ client, api, context, refresh, go, online }: { client: SupabaseClient; api: Portal; context: PortalContext | null; refresh: () => Promise<void>; go: (path: string) => void; online: boolean }) {
  const signup = useMemo(() => createMemberAuth(client, 'signup'), [client])
  const attach = useMemo(() => createMemberAuth(client, 'attach'), [client])
  const billing = useMemo(() => createSandboxBilling(client), [client])
  const [step, setStep] = useState<'email' | 'emailOtp' | 'phone' | 'phoneOtp' | 'details' | 'photo' | 'payment'>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [birth, setBirth] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [documents, setDocuments] = useState<{ version: string; kind: string; content: string }[]>([])
  const [preview, setPreview] = useState('')
  const [camera, setCamera] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retryAt, setRetryAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000))
  const billingState = context?.member?.billingState
  const canPay = !billingState || billingState === 'incomplete' || billingState === 'canceled'
  useEffect(() => { api.documents().then(setDocuments).catch(() => setError('Documentos indisponíveis. Tente novamente.')); client.auth.getUser().then(({ data }) => { if (!data.user) return; setEmail(data.user.email || ''); if (context?.role === 'member') setStep(context.member?.photoPath ? 'payment' : 'photo'); else if (data.user.phone_confirmed_at && data.user.email_confirmed_at) setStep('details'); else if (data.user.email_confirmed_at) setStep('phone') }) }, [api, client, context?.role])
  useEffect(() => { if (step === 'photo' && !preview) setCamera(true) }, [step, preview])
  async function run(action: () => Promise<void>) { if (busy || !online) return; setBusy(true); setError(''); try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível continuar.') } finally { setBusy(false) } }
  async function photo(file: File) { await run(async () => { const result = await detectFace(file); if (result.count !== 1) throw new Error('A foto precisa estar nítida e ter apenas um rosto centralizado.'); setPreview(result.preview); setCamera(false) }) }
  async function pay() { await run(async () => { const { url } = await billing.createCheckout(crypto.randomUUID()); window.location.assign(url) }) }
  async function sendEmail() {
    setRetryAt(Date.now() + 60000)
    await signup.requestCode({ contact: email, channel: 'email' })
    setToken(''); setStep('emailOtp')
  }
  async function sendPhone() {
    const number = normalizeContact({ contact: phone, channel: 'sms' })
    setRetryAt(Date.now() + 60000)
    await attach.requestCode({ contact: number, channel: 'sms' })
    setPhone(number); setToken(''); setStep('phoneOtp')
  }
  return <main className="partner-entry"><div className="partner-entry-card"><Brand /><h1>{step === 'photo' ? 'Sua foto' : step === 'payment' ? 'Pagamento' : 'Faça parte da RKMED'}</h1><p>Mensalidade de R$ 69,60. O benefício é liberado após a confirmação do pagamento.</p>{!online && <p className="inline-error">Conecte-se para continuar o cadastro.</p>}{error && <p className="inline-error" role="alert">{error}</p>}
    {step === 'email' && <form onSubmit={e => { e.preventDefault(); void run(sendEmail) }}><label className="field-label">E-mail<input className="input" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label><Button type="submit" disabled={busy || !online || retrySeconds > 0}>Receber código por e-mail</Button></form>}
    {step === 'emailOtp' && <form onSubmit={e => { e.preventDefault(); void run(async () => { await signup.verifyCode({ contact: email, token, channel: 'email' }); setToken(''); setRetryAt(0); setStep('phone'); await refresh() }) }}><label className="field-label">Código enviado por e-mail<input className="input" inputMode="numeric" autoComplete="one-time-code" value={token} onChange={e => setToken(onlyDigits(e.target.value))} required maxLength={6} /></label><Button type="submit" disabled={busy || !online}>Confirmar e-mail</Button></form>}
    {step === 'phone' && <form onSubmit={e => { e.preventDefault(); void run(sendPhone) }}><label className="field-label">Celular com DDD<input className="input" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} required /></label><p>Verifique seu celular na mesma conta do e-mail já confirmado.</p><Button type="submit" disabled={busy || !online || retrySeconds > 0}>Receber código pelo SMS</Button></form>}
    {step === 'phoneOtp' && <form onSubmit={e => { e.preventDefault(); void run(async () => { await attach.verifyCode({ contact: phone, token, channel: 'sms' }); setToken(''); setStep('details') }) }}><label className="field-label">Código enviado por SMS<input className="input" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={token} onChange={e => setToken(onlyDigits(e.target.value))} /></label><Button type="submit" disabled={busy || !online}>Confirmar celular</Button></form>}
    {(step === 'emailOtp' || step === 'phoneOtp' || (step === 'phone' && retryAt > 0)) && <div className="counter-flow">
      {retrySeconds > 0 && <p role="status">Aguarde {retrySeconds}s para solicitar outro código.</p>}
      <Button variant="outline" disabled={busy || !online || retrySeconds > 0} onClick={() => void run(step === 'emailOtp' ? sendEmail : sendPhone)}>Reenviar código</Button>
    </div>}
    {step === 'details' && <form onSubmit={e => { e.preventDefault(); void run(async () => { if (!validCpf(cpf) || !isAdult(birth)) throw new Error('Informe CPF válido e data de nascimento de maior de 18 anos.'); if (!accepted || documents.length !== 3) throw new Error('Leia e aceite os documentos disponíveis.'); await api.enroll(name.trim(), onlyDigits(cpf), birth, documents.map(d => d.version)); setCpf(''); setBirth(''); setStep('photo'); await refresh() }) }}><label className="field-label">Nome completo<input className="input" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={160} required /></label><label className="field-label">CPF<input className="input" inputMode="numeric" autoComplete="off" value={cpf} onChange={e => setCpf(e.target.value)} required /></label><label className="field-label">Data de nascimento<input className="input" type="date" value={birth} onChange={e => setBirth(e.target.value)} required /></label>{documents.map(d => <details key={d.version}><summary>{d.kind === 'terms' ? 'Termos de uso' : d.kind === 'privacy' ? 'Aviso de privacidade' : 'Uso da foto'} · {d.version}</summary><p style={{ whiteSpace: 'pre-wrap' }}>{d.content}</p></details>)}<p>Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.</p><label className="field-label"><span><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} required /> Li e aceito os documentos acima, nas versões apresentadas.</span></label><Button type="submit" disabled={busy || !online || !accepted}>Continuar para a foto</Button></form>}
    {step === 'photo' && <><p>Uma foto com um rosto centralizado. Detectamos presença de rosto; isso não comprova identidade.</p><p className="photo-guidance">A foto deve estar nítida: rosto parado, de frente, bem iluminado e sem outras pessoas.</p>{!camera && !preview && <Button variant="outline" disabled={busy || !online} onClick={() => setCamera(true)}>Abrir câmera</Button>}{camera && <Suspense fallback={<p>Carregando câmera...</p>}><Camera onCapture={file => void photo(file)} onClose={() => setCamera(false)} /></Suspense>}{preview && <><img src={preview} alt="Recorte da sua foto" width={240} height={240} /><Button variant="outline" disabled={busy || !online} onClick={() => { setPreview(''); setCamera(true) }}>Tirar outra foto</Button></>}<Button disabled={busy || !online || !preview} onClick={() => void run(async () => { await api.command('photo', { photo: preview }); setPreview(''); await refresh(); setStep('payment') })}>{busy ? 'Validando foto...' : 'Salvar foto e ir ao pagamento'}</Button></>}
    {step === 'payment' && <div><span className="form-step">PAGAMENTO</span><h2>{billingState === 'active' ? 'Assinatura ativa.' : canPay ? 'Pagamento da assinatura.' : 'Pagamento pendente.'}</h2><p>{billingState === 'active' ? 'Seu pagamento está em dia. O cartão e os benefícios já estão disponíveis.' : canPay ? 'Seu cadastro está completo. Confirme o pagamento para liberar seu cartão e seus benefícios.' : 'Sua assinatura precisa de atenção. Abra sua área para atualizar a forma de pagamento.'}</p><div className="plan-summary"><div><span>Plano</span><b>Linha Gold</b></div><div><span>Mensalidade</span><b>R$ 69,60</b></div><div><span>Cobrança</span><b>Mensal</b></div></div>{canPay ? <><p>O pagamento é processado em ambiente seguro. O benefício é liberado somente após a confirmação do provedor.</p><Button disabled={busy || !online} onClick={() => void pay()}>{busy ? 'Abrindo pagamento...' : 'Pagar R$ 69,60'}</Button></> : <Button onClick={() => go('/app')}>Abrir minha área</Button>}</div>}
    <button className="text-link" onClick={() => go('/')}>Voltar ao início</button></div></main>
}
