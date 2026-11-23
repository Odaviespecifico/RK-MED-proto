import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '../../components/ui/button'
import { EnrollmentFrame } from './EnrollmentFrame'
import { EnrollmentPayment } from './EnrollmentPayment'
import type { Portal, PortalContext } from '../../integrations/portal'
import { normalizeContact, createMemberAuth } from '../../integrations/auth'
import { detectFace } from '../../lib/face'
import { isAdult, onlyDigits, validCpf } from '../../lib/format'
const Camera = lazy(() => import('../../LiveFaceCamera').then(m => ({ default: m.LiveFaceCamera })))
export function ConnectedEnrollment({ client, api, context, refresh, go, online }: { client: SupabaseClient; api: Portal; context: PortalContext | null; refresh: () => Promise<void>; go: (path: string) => void; online: boolean }) {
  const signup = useMemo(() => createMemberAuth(client, 'signup'), [client])
  const attach = useMemo(() => createMemberAuth(client, 'attach'), [client])
  const [step, setStep] = useState<'email' | 'emailOtp' | 'phone' | 'phoneOtp' | 'details' | 'finish' | 'photo' | 'payment'>('details')
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
  const working = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const detailsReady = useRef(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [error, setError] = useState('')
  const [retryAt, setRetryAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000))
  useEffect(() => {
    let active = true
    api.documents().then(value => { if (active) setDocuments(value) }).catch(() => { if (active) setError('Documentos indisponíveis. Tente novamente.') })
    return () => { active = false }
  }, [api])
  useEffect(() => {
    let active = true
    client.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return
      setEmail(data.user.email || '')
      setEmailVerified(!!data.user.email_confirmed_at); setPhoneVerified(!!data.user.phone_confirmed_at)
      if (context?.role === 'member') {
        if (context.member?.eligible) { go('/app'); return }
        const payment = !!context.member?.photoPath
        setStep(payment ? 'payment' : 'photo')
        if (payment && location.pathname !== '/cadastro/pagamento') go('/cadastro/pagamento')
      } else if (!detailsReady.current) setStep('details')
      else if (data.user.email_confirmed_at && !data.user.phone_confirmed_at) setStep('phone')
    }).catch(() => { if (active) setError('Não foi possível verificar sua sessão. Tente novamente.') })
    return () => { active = false }
  }, [client, context?.role, context?.member?.photoPath, context?.member?.eligible, go])
  useEffect(() => { if (step === 'photo' && !preview) setCamera(true) }, [step, preview])
  useEffect(() => { heading.current?.focus() }, [step])
  async function run(action: () => Promise<void>) { if (working.current || !online) return; working.current = true; setBusy(true); setError(''); try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível continuar.') } finally { working.current = false; setBusy(false) } }
  async function photo(file: File) { await run(async () => { const result = await detectFace(file); if (result.count !== 1) throw new Error('A foto precisa estar nítida e ter apenas um rosto centralizado.'); setPreview(result.preview); setCamera(false) }) }
  async function sendEmail() {
    setEmail(email.trim().toLowerCase())
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
  function validateDetails() {
    if (name.trim().length < 2 || !validCpf(cpf) || !isAdult(birth)) throw new Error('Informe nome, CPF válido e data de nascimento de maior de 18 anos.')
    if (!accepted || documents.length !== 3) throw new Error('Leia e aceite os documentos disponíveis.')
  }
  async function completeEnrollment() {
    validateDetails()
    await api.enroll(name.trim(), onlyDigits(cpf), birth, documents.map(d => d.version))
    setCpf(''); setStep('photo'); await refresh()
  }
  async function continueDetails() {
    validateDetails(); detailsReady.current = true
    if (emailVerified && phoneVerified) { await completeEnrollment(); return }
    setStep(emailVerified ? 'phone' : 'email')
  }
  const labels = ['Seus dados', 'E-mail', 'Confirmar e-mail', 'Celular', 'Confirmar SMS', 'Foto', 'Pagamento']
  const current = step === 'details' ? 0 : step === 'email' ? 1 : step === 'emailOtp' ? 2 : step === 'phone' ? 3 : step === 'phoneOtp' || step === 'finish' ? 4 : step === 'photo' ? 5 : 6
  return <EnrollmentFrame showIntroduction={step === 'details' && !context && !detailsReady.current} go={go}>
    <div className="enrollment-progress"><span>Etapa {current + 1} de {labels.length} · {labels[current]}</span><ol aria-label="Etapas do cadastro">{labels.map((label, index) => <li key={label} aria-current={index === current ? 'step' : undefined} data-complete={index < current}><span className="sr-only">{label}</span></li>)}</ol></div>
    {step !== 'payment' && <><h2 ref={heading} tabIndex={-1}>{step === 'photo' ? 'Sua foto para o cartão' : step === 'details' ? 'Vamos começar por você' : step === 'finish' ? 'Concluindo seu cadastro' : step === 'emailOtp' ? 'Confirme seu e-mail' : step === 'phoneOtp' ? 'Confirme seu celular' : step === 'phone' ? 'Agora, seu celular' : 'Qual é o seu e-mail?'}</h2>{step === 'details' && <p>Informe seus dados pessoais. Em seguida, vamos confirmar seu e-mail e celular para proteger o acesso.</p>}</>}
    {!online && <p className="inline-error" role="status">Conecte-se para continuar o cadastro.</p>}{busy && <p role="status">Processando sua solicitação…</p>}{retrySeconds > 0 && step === 'email' && <p role="status">Novo código disponível em {retrySeconds}s.</p>}{error && <p className="inline-error" role="alert">{error}</p>}
    {step === 'email' && <><button className="back-link" disabled={busy} onClick={() => { setError(''); setStep('details') }}>Voltar aos dados pessoais</button><form onSubmit={e => { e.preventDefault(); void run(sendEmail) }}><label className="field-label">E-mail<input disabled={busy} className="input" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label><Button type="submit" disabled={busy || !online || retrySeconds > 0}>Receber código por e-mail</Button></form></>}
    {step === 'emailOtp' && <><p>Código enviado para <strong>{email}</strong>. Válido por 5 minutos.</p><button className="back-link" disabled={busy} onClick={() => { setToken(''); setError(''); setStep('email') }}>Corrigir e-mail</button><form onSubmit={e => { e.preventDefault(); void run(async () => { await signup.verifyCode({ contact: email, token, channel: 'email' }); setEmailVerified(true); setToken(''); setRetryAt(0); setStep('phone'); await refresh() }) }}><label className="field-label">Código enviado por e-mail<input disabled={busy} className="input" inputMode="numeric" autoComplete="one-time-code" value={token} onChange={e => setToken(onlyDigits(e.target.value).slice(0, 6))} required minLength={6} pattern="[0-9]{6}" maxLength={6} /></label><Button type="submit" disabled={busy || !online}>Confirmar e-mail</Button></form></>}
    {step === 'phone' && <form onSubmit={e => { e.preventDefault(); void run(sendPhone) }}><label className="field-label">Celular com DDD<input disabled={busy} className="input" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} required /></label><p>Verifique seu celular na mesma conta do e-mail já confirmado.</p><Button type="submit" disabled={busy || !online || retrySeconds > 0}>Receber código pelo SMS</Button></form>}
    {step === 'phoneOtp' && <><p>Código enviado para <strong>{phone}</strong>. Válido por 5 minutos.</p><button className="back-link" disabled={busy} onClick={() => { setToken(''); setError(''); setStep('phone') }}>Corrigir celular</button><form onSubmit={e => { e.preventDefault(); void run(async () => { await attach.verifyCode({ contact: phone, token, channel: 'sms' }); setPhoneVerified(true); setToken(''); setStep('finish'); await completeEnrollment() }) }}><label className="field-label">Código enviado por SMS<input disabled={busy} className="input" inputMode="numeric" autoComplete="one-time-code" required minLength={6} pattern="[0-9]{6}" maxLength={6} value={token} onChange={e => setToken(onlyDigits(e.target.value).slice(0, 6))} /></label><Button type="submit" disabled={busy || !online}>Confirmar celular</Button></form></>}
    {(step === 'emailOtp' || step === 'phoneOtp' || (step === 'phone' && retryAt > 0)) && <div className="enrollment-resend">
      {retrySeconds > 0 && <p role="status">Aguarde {retrySeconds}s para solicitar outro código.</p>}
      <Button variant="outline" disabled={busy || !online || retrySeconds > 0} onClick={() => void run(step === 'emailOtp' ? sendEmail : sendPhone)}>Reenviar código</Button>
    </div>}
    {step === 'details' && <form onSubmit={e => { e.preventDefault(); void run(continueDetails) }}><label className="field-label">Nome completo<input disabled={busy} className="input" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={160} required /></label><label className="field-label">CPF<input disabled={busy} className="input" inputMode="numeric" autoComplete="off" value={cpf} onChange={e => setCpf(e.target.value)} required /></label><label className="field-label">Data de nascimento<input disabled={busy} className="input" type="date" value={birth} onChange={e => setBirth(e.target.value)} required /></label><div className="enrollment-consent"><input id="enrollment-accept" disabled={busy} type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} required /><label htmlFor="enrollment-accept">Li e aceito a <a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>, os <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e a <a href="/autorizacao-imagem" target="_blank" rel="noopener noreferrer">Autorização de Uso de Imagem</a>.</label></div><Button type="submit" disabled={busy || !online || !accepted}>{emailVerified ? phoneVerified ? 'Concluir cadastro' : 'Continuar para o celular' : 'Continuar para o e-mail'}</Button></form>}
    {step === 'finish' && <><p>Seus contatos foram confirmados. Falta concluir o registro dos dados pessoais para seguir à foto.</p><Button disabled={busy || !online} onClick={() => void run(completeEnrollment)}>{busy ? 'Salvando cadastro…' : 'Tentar concluir cadastro novamente'}</Button><button className="back-link" disabled={busy} onClick={() => { setError(''); setStep('details') }}>Revisar dados pessoais</button></>}
    {step === 'photo' && <><p>Uma foto com um rosto centralizado. Detectamos presença de rosto; isso não comprova identidade.</p><p className="photo-guidance">A foto deve estar nítida: rosto parado, de frente, bem iluminado e sem outras pessoas.</p>{!camera && !preview && <Button variant="outline" disabled={busy || !online} onClick={() => setCamera(true)}>Abrir câmera</Button>}{camera && <Suspense fallback={<p>Carregando câmera...</p>}><Camera onCapture={file => void photo(file)} onClose={() => setCamera(false)} /></Suspense>}{preview && <><img src={preview} alt="Recorte da sua foto" width={240} height={240} /><Button variant="outline" disabled={busy || !online} onClick={() => { setPreview(''); setCamera(true) }}>Tirar outra foto</Button></>}<Button disabled={busy || !online || !preview} onClick={() => void run(async () => { await api.command('photo', { photo: preview }); setPreview(''); await refresh(); setStep('payment'); go('/cadastro/pagamento') })}>{busy ? 'Validando foto...' : 'Salvar foto e ir ao pagamento'}</Button></>}
    {step === 'payment' && <EnrollmentPayment client={client} api={api} context={context} refresh={refresh} go={go} online={online} />}
    <button className="text-link enrollment-home" onClick={() => go('/')}>Voltar ao início</button>
  </EnrollmentFrame>
}
