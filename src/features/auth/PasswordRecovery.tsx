import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Brand } from '../../components/identity'
import { Button } from '../../components/ui/button'

export function ForgotPassword({ client, online, go }: { client: SupabaseClient; online: boolean; go: (path: string) => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [error, setError] = useState('')
  async function send() {
    if (!online || busy) return
    setBusy(true); setError('')
    try {
      const { error } = await client.functions.invoke('phone-code', { body: { action: 'recover', email: email.trim() } })
      if (error) throw error
      setSent(true)
      setResendIn(60)
    } catch { setError('Não foi possível enviar a solicitação agora. Verifique a conexão e tente novamente.') }
    finally { setBusy(false) }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send() }
  useEffect(() => {
    if (!resendIn) return
    const timer = window.setTimeout(() => setResendIn(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])
  return <main className="partner-entry"><div className="partner-entry-card"><Brand /><button type="button" className="back-link" onClick={() => go('/')}><ArrowLeft size={15} /> Voltar</button>
    <h1>Esqueci minha senha</h1><p>Informe o e-mail da sua conta. Se houver um acesso associado a ele, enviaremos um link para criar outra senha.</p>
    {!sent ? <form onSubmit={submit}><label className="field-label">E-mail<input className="input" type="email" autoComplete="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }} required maxLength={254} /></label><Button className="full" type="submit" disabled={!online || busy}>{busy ? 'Enviando…' : 'Enviar link de recuperação'}</Button>{error && <p role="alert" className="inline-error">{error}</p>}</form> : <p role="status" className="inline-success"><CheckCircle2 size={17} /> Se houver uma conta com esse e-mail, você receberá as instruções em breve. Confira também o spam.</p>}
    {sent && <div className="counter-flow"><Button className="full" variant="outline" onClick={() => void send()} disabled={!online || busy || resendIn > 0}>{busy ? 'Enviando…' : resendIn > 0 ? `Reenviar link em ${resendIn}s` : 'Reenviar e-mail'}</Button>{!online && <p role="status" className="inline-error">Conecte-se à internet para solicitar um novo link.</p>}{error && <p role="alert" className="inline-error">{error}</p>}</div>}
    <p className="auth-foot"><button type="button" onClick={() => go('/acesso-admin')}>Entrar como equipe ou parceiro</button></p>
  </div></main>
}

export function SetNewPassword({ client, go }: { client: SupabaseClient; go: (path: string) => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 12 || password.length > 128) return setError('Use uma senha entre 12 e 128 caracteres.')
    if (password !== confirmation) return setError('As senhas não coincidem.')
    setBusy(true); setError('')
    try {
      const { data } = await client.auth.getSession()
      if (!data.session) throw new Error('O link expirou ou já foi usado. Solicite outro link de recuperação.')
      const { error } = await client.auth.updateUser({ password })
      if (error) throw new Error('Não foi possível atualizar a senha. Solicite outro link de recuperação.')
      await client.auth.signOut({ scope: 'local' })
      setPassword(''); setConfirmation(''); setDone(true)
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível atualizar a senha.') }
    finally { setBusy(false) }
  }
  // Supabase consumes the one-time recovery token before the route can update a password.
  useEffect(() => { let active = true; void client.auth.getSession().then(({ data }) => { if (active) setReady(Boolean(data.session)) }).catch(() => { if (active) setReady(false) }); return () => { active = false } }, [client])
  return <main className="partner-entry"><div className="partner-entry-card"><Brand /><h1>Crie uma nova senha</h1>
    {done ? <><p role="status" className="inline-success">Senha atualizada. Entre novamente com a nova senha.</p><Button className="full" onClick={() => go('/')}>Voltar ao início</Button><Button variant="outline" className="full" onClick={() => go('/acesso-admin')}>Acesso da equipe ou parceiro</Button><Button variant="outline" className="full" onClick={() => go('/entrar')}>Acesso do associado</Button></>
      : <><p>Use uma senha de 12 a 128 caracteres. O link só pode ser utilizado uma vez.</p>{!ready && <p role="alert" className="inline-error">O link expirou, já foi usado ou está inválido. Solicite outro link de recuperação.</p>}<form onSubmit={submit}><label className="field-label">Nova senha<input className="input" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required /></label><label className="field-label">Confirme a nova senha<input className="input" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} required /></label><Button className="full" type="submit" disabled={!ready || busy}>{busy ? 'Atualizando…' : 'Atualizar senha'}</Button>{error && <p role="alert" className="inline-error">{error}</p>}</form></>}
  </div></main>
}
