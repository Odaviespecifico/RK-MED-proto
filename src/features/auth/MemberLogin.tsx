import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Smartphone, Mail, CheckCircle2, CircleAlert } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Brand, Eyebrow } from '../../components/identity'
import { onlyDigits } from '../../lib/format'
import type { MemberAuth } from '../../integrations/contracts'

export function MemberLogin({ auth, onAuthenticated, go, online, demo = false, demoHint, emailPlaceholder = 'seu@email.com' }: { auth: MemberAuth; onAuthenticated: (userId: string) => void; go: (p: string) => void; online: boolean; demo?: boolean; demoHint?: ReactNode; emailPlaceholder?: string }) {
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => { if (cooldown <= 0) return; const timer = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(timer) }, [cooldown])
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'whatsapp' | 'email'>('whatsapp')
  const [step, setStep] = useState<'choice' | 'contact' | 'otp'>('choice')
  const [contact, setContact] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [sentBy, setSentBy] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp')
  const [notice, setNotice] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const heading = cardRef.current?.querySelector('h2')
    if (heading) { heading.tabIndex = -1; heading.focus() }
  }, [step])
  function choose(next: 'whatsapp' | 'email') {
    setMode(next); setContact(''); setOtp(''); setError(''); setNotice(''); setStep('contact')
  }
  async function send(e: FormEvent) {
    e.preventDefault()
    if (!online) return setError('Conecte-se à internet para receber o código.')
    if (mode === 'whatsapp' && onlyDigits(contact).length < 10) return setError('Informe um celular com DDD.')
    setBusy(true); setError(''); setNotice('')
    try {
      await auth.requestCode({ contact, channel: mode })
      setCooldown(demo ? 0 : 60); setOtp(''); setSentBy(mode); setStep('otp')
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível solicitar o código.') }
    finally { setBusy(false) }
  }
  async function resend() {
    if (!online) return setError('Conecte-se à internet para solicitar outro código.')
    const channel = mode === 'whatsapp' ? 'sms' : 'email'
    setBusy(true); setError('')
    try {
      await auth.requestCode({ contact, channel })
      setCooldown(demo ? 0 : 60)
      setSentBy(channel)
      setNotice(`${channel === 'sms' ? 'Código enviado por SMS' : 'Novo código enviado por e-mail'}${demo ? ' (simulado)' : ''}.`)
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível reenviar o código.') }
    finally { setBusy(false) }
  }
  async function verify(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const result = await auth.verifyCode({ contact, channel: sentBy, token: otp })
      onAuthenticated(result.userId)
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível confirmar o código.') }
    finally { setBusy(false) }
  }
  return <div className="auth-layout">
    <div className="auth-aside"><button className="brand-button" onClick={() => go('/')}><Brand dark /></button><div><Eyebrow>SEU ESPAÇO DE CUIDADO</Eyebrow><h1>Acesse seu<br /><em>cartão digital.</em></h1><p>Entre com WhatsApp ou e-mail para consultar seus descontos e mostrar o QR.</p></div><div className="auth-art-card"><span>✳ RKMED</span><b>Seu cartão.<br />Seus descontos.</b><small>LINHA GOLD</small></div></div>
    <main className="auth-main"><div className="auth-card" ref={cardRef}>
      <span className="auth-topline">ÁREA DO ASSOCIADO <span>{step === 'choice' ? '01' : step === 'contact' ? '02' : '03'} / 03</span></span>
      <div className="login-progress" aria-label={`Passo ${step === 'choice' ? 1 : step === 'contact' ? 2 : 3} de 3`}><span className="current" /><span className={step !== 'choice' ? 'current' : ''} /><span className={step === 'otp' ? 'current' : ''} /></div>
      {step === 'choice' && <><h2>Como prefere entrar?</h2><p>Escolha onde quer receber o código de acesso.</p><div className="login-choice"><button type="button" onClick={() => choose('whatsapp')}><Smartphone size={21} /><span><b>Login com whatsapp</b><small>Receba um código no seu celular</small></span><ArrowRight size={18} /></button><button type="button" onClick={() => choose('email')}><Mail size={21} /><span><b>Login com email</b><small>Receba um código no seu e-mail</small></span><ArrowRight size={18} /></button></div></>}
      {step === 'contact' && <><button type="button" className="back-link" onClick={() => { setError(''); setNotice(''); setStep('choice') }}><ArrowLeft size={15} /> Escolher outro meio</button><h2>{mode === 'email' ? 'Seu e-mail' : 'Seu WhatsApp'}</h2><p>{mode === 'email' ? 'Digite o e-mail verificado no cadastro.' : 'Digite o número verificado no cadastro, com DDD.'}</p><form onSubmit={send}><label className="field-label">{mode === 'email' ? 'E-mail' : 'WhatsApp'}<input className="input" type={mode === 'email' ? 'email' : 'tel'} inputMode={mode === 'email' ? 'email' : 'tel'} autoComplete={mode === 'email' ? 'email' : 'tel'} required placeholder={mode === 'email' ? emailPlaceholder : '(81) 99999-0001'} value={contact} onChange={e => { setContact(e.target.value); setError('') }} /></label><p className="helper">{mode === 'whatsapp' ? 'Se o WhatsApp não chegar, você poderá tentar por SMS.' : 'Enviaremos um código temporário para este e-mail.'}</p><Button type="submit" disabled={!online || busy} className="full">Continuar <ArrowRight size={18} /></Button></form></>}
      {step === 'otp' && <><button type="button" className="back-link" onClick={() => { setOtp(''); setError(''); setNotice(''); setStep('contact') }}><ArrowLeft size={15} /> Alterar contato</button><h2>Confirme seu acesso</h2><p>Código enviado para <strong>{contact}</strong> por {sentBy === 'email' ? 'e-mail' : sentBy === 'sms' ? 'SMS' : 'WhatsApp'}.</p><form onSubmit={verify}><label className="field-label">Código recebido por {sentBy === 'email' ? 'e-mail' : sentBy === 'sms' ? 'SMS' : 'WhatsApp'}<input className="input otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="••••••" value={otp} onChange={e => { setOtp(onlyDigits(e.target.value)); setError('') }} /></label><Button type="submit" disabled={!online || busy} className="full">Acessar meu cartão <ArrowRight size={18} /></Button><button type="button" className="text-link" disabled={!online || busy || cooldown > 0} onClick={resend}>{mode === 'whatsapp' ? 'Não chegou? Tentar por SMS' : 'Não chegou? Reenviar e-mail'}</button></form></>}
      {notice && <div className="inline-success" role="status"><CheckCircle2 size={16} />{notice}</div>}
      {error && <div className="inline-error" role="alert"><CircleAlert size={16} />{error}</div>}
      {demoHint}
      <p className="auth-foot">Ainda não faz parte? <button onClick={() => go('/cadastro')}>Comece aqui <ArrowRight size={14} /></button></p>
    </div></main>
  </div>
}

