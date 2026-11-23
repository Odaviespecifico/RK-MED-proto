import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Brand } from '../../components/identity'
import { onlyDigits } from '../../lib/format'
import { maskedContact } from '../../lib/member-experience'
import type { MemberAuth } from '../../integrations/contracts'
import './member-experience.css'

export function MemberLogin({ auth, onAuthenticated, go, online, demo = false, demoHint, emailPlaceholder = 'seu@email.com', sellerLogin }: { auth: MemberAuth; onAuthenticated: (userId: string) => void | Promise<void>; go: (p: string) => void; online: boolean; demo?: boolean; demoHint?: ReactNode; emailPlaceholder?: string; sellerLogin?: ReactNode }) {
  const [loginTab, setLoginTab] = useState<'member' | 'seller'>('member')
  const [retryAt, setRetryAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const cooldown = Math.max(0, Math.ceil((retryAt - now) / 1000))
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const [mode, setMode] = useState<'sms' | 'email'>('email')
  const [step, setStep] = useState<'contact' | 'otp'>('contact')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const contact = mode === 'email' ? email : phone
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const heading = cardRef.current?.querySelector('h2'); if (heading) { heading.tabIndex = -1; heading.focus() } }, [step, mode])
  function choose(next: 'sms' | 'email') { setMode(next); setOtp(''); setError(''); setNotice(''); setStep('contact') }
  async function send(event?: FormEvent) {
    event?.preventDefault()
    if (!online || working.current || cooldown > 0) return
    working.current = true; setBusy(true); setError(''); setNotice('')
    setRetryAt(Date.now() + (demo ? 0 : 60000))
    try {
      await auth.requestCode({ contact, channel: mode })
      setOtp(''); setStep('otp'); setNotice('Código solicitado. Confira também a pasta de spam se usar e-mail.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o código. Aguarde antes de tentar novamente.') }
    finally { working.current = false; setBusy(false) }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); if (!online || working.current) return
    working.current = true; setBusy(true); setError('')
    try { const result = await auth.verifyCode({ contact, channel: mode, token: otp }); await onAuthenticated(result.userId) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Código incorreto ou expirado. Confira ou solicite outro código.') }
    finally { working.current = false; setBusy(false) }
  }
  return <div className="auth-layout member-login">
    <aside className="auth-aside"><button className="brand-button" onClick={() => go('/')} aria-label="RKMED — início"><Brand dark /></button><div><h1>Seu cartão,<br /><em>sempre com você.</em></h1><p>Acesse sua conta com um código enviado ao contato já verificado.</p></div></aside>
    <main className="auth-main"><div className="auth-card" ref={cardRef}>
      <div className="enrollment-mobile-brand"><button className="brand-button" onClick={() => go('/')}><Brand /></button></div>
      {sellerLogin && <div className="login-mode-tabs" role="tablist" aria-label="Tipo de acesso">
        <button type="button" role="tab" aria-selected={loginTab === 'member'} className={loginTab === 'member' ? 'selected' : ''} onClick={() => setLoginTab('member')}>Associado</button>
        <button type="button" role="tab" aria-selected={loginTab === 'seller'} className={loginTab === 'seller' ? 'selected' : ''} onClick={() => setLoginTab('seller')}>Login vendedor</button>
      </div>}
      {sellerLogin && loginTab === 'seller' ? sellerLogin : <>
      <span className="auth-topline">ÁREA DO ASSOCIADO <span>{step === 'contact' ? '1 · Contato' : '2 · Código'}</span></span>
      {step === 'contact' ? <><h2>{mode === 'email' ? 'Entre com seu e-mail' : 'Entre pelo SMS'}</h2><p>{mode === 'email' ? 'Enviaremos um código de acesso. Você não precisa de senha.' : 'Use o celular já verificado no cadastro. Esta opção não altera o telefone da conta.'}</p>
        <form onSubmit={event => void send(event)}><label className="field-label">{mode === 'email' ? 'E-mail' : 'Celular com DDD'}<input className="input" type={mode === 'email' ? 'email' : 'tel'} autoComplete={mode === 'email' ? 'email' : 'tel'} required placeholder={mode === 'email' ? emailPlaceholder : '(81) 99999-0001'} value={contact} disabled={busy} onChange={event => { mode === 'email' ? setEmail(event.target.value) : setPhone(event.target.value); setError('') }} /></label><Button type="submit" disabled={!online || busy || cooldown > 0} className="full">{busy ? 'Enviando código…' : mode === 'email' ? 'Receber código por e-mail' : 'Receber código por SMS'} <ArrowRight size={18} /></Button></form>
        <button type="button" className="text-link auth-alternative" disabled={busy} onClick={() => choose(mode === 'email' ? 'sms' : 'email')}>{mode === 'email' ? 'Não consigo acessar meu e-mail' : 'Voltar ao acesso por e-mail'}</button>
      </> : <><button type="button" className="back-link" disabled={busy} onClick={() => { setOtp(''); setError(''); setNotice(''); setStep('contact') }}><ArrowLeft size={15} /> Corrigir {mode === 'email' ? 'e-mail' : 'celular'}</button><h2>Confirme seu acesso</h2><p>Código enviado para <strong>{maskedContact(contact, mode)}</strong> por {mode === 'email' ? 'e-mail' : 'SMS'}. Válido por 5 minutos.</p>
        <form onSubmit={event => void verify(event)}><label className="field-label">Código recebido por {mode === 'email' ? 'e-mail' : 'SMS'}<input className="input otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="000000" value={otp} disabled={busy} onChange={event => { setOtp(onlyDigits(event.target.value).slice(0, 6)); setError('') }} /></label><Button type="submit" disabled={!online || busy} className="full">{busy ? 'Verificando…' : 'Acessar meu cartão'} <ArrowRight size={18} /></Button><button type="button" className="text-link" disabled={!online || busy || cooldown > 0} onClick={() => void send()}>Reenviar código</button></form>
      </>}
      {cooldown > 0 && <p className="auth-countdown" role="status">Novo código disponível em {cooldown}s.</p>}
      {!online && <p role="status">Conecte-se à internet para entrar.</p>}
      {notice && <div className="inline-success" role="status"><CheckCircle2 size={16} />{notice}</div>}
      {error && <div className="inline-error" role="alert"><CircleAlert size={16} />{error}</div>}
      {demoHint}
      <p className="auth-foot">Ainda não faz parte? <button onClick={() => go('/cadastro')}>Comece aqui <ArrowRight size={14} /></button></p>
      </>}
    </div></main>
  </div>
}
