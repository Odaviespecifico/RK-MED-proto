import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { LogOut, ShieldCheck, WifiOff } from 'lucide-react'
import type { PublicConfig } from '../lib/config'
import type { PublicPartner } from '../integrations/contracts'
import type { PortalContext } from '../integrations/portal'
import { portal, PortalConnectionError } from '../integrations/portal'
import { offlineAccount, readMemberSnapshot, type MemberSnapshot } from '../offline/member'
import { Brand, Gate } from '../components/identity'
import { Button } from '../components/ui/button'
import { WorkspaceSidebar } from '../components/workspace'
import { Landing } from '../features/public/Landing'
import { LegalDocument } from '../features/public/LegalDocument'
import { MemberLogin } from '../features/auth/MemberLogin'
import { ForgotPassword, SetNewPassword } from '../features/auth/PasswordRecovery'
import { PartnerLocation } from '../components/PartnerLocation'
import { createSupabase } from '../integrations/supabase'
import { createMemberAuth } from '../integrations/auth'
const Enrollment = lazy(() => import('../features/auth/ConnectedEnrollment').then(m => ({ default: m.ConnectedEnrollment })))
const Counter = lazy(() => import('../features/partner/ConnectedCounter').then(m => ({ default: m.ConnectedCounter })))
const Member = lazy(() => import('../features/membership/ConnectedMember').then(m => ({ default: m.ConnectedMember })))
const Admin = lazy(() => import('../features/admin/ConnectedAdmin').then(m => ({ default: m.ConnectedAdmin })))

export default function SandboxApp({ config }: { config: PublicConfig }) {
  const [path, setPath] = useState(window.location.pathname)
  const [menuOpen, setMenuOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [context, setContext] = useState<PortalContext | null>(null)
  const [partners, setPartners] = useState<PublicPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(true)
  const [partnersError, setPartnersError] = useState('')
  const [snapshot, setSnapshot] = useState<MemberSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const revision = useRef(0)
  const client = useMemo(() => createSupabase(config), [config.environment, config.projectRef, config.supabaseUrl, config.supabaseKey])
  const auth = useMemo(() => createMemberAuth(client), [client, config.environment])
  const api = useMemo(() => portal(client), [client])
  async function refresh() {
    if (!navigator.onLine) { setLoading(false); return }
    const current = ++revision.current
    const { data } = await client.auth.getSession()
    if (!data.session) { if (current === revision.current) { setContext(null); setLoading(false) } return }
    try { const result = await api.context(); if (current === revision.current) { setContext(result); offlineAccount(result.role === 'member' ? result.userId : null); setOnline(true); setError('') } }
    catch (e) { if (current === revision.current) { setContext(null); if (e instanceof PortalConnectionError) setOnline(false); setError(e instanceof Error ? e.message : 'Não foi possível verificar sua sessão.') } }
    finally { if (current === revision.current) setLoading(false) }
  }
  async function reload() { await refresh(); setPartners(await api.partners()) }
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const url = new URL(window.location.href)
    const recoveryFragment = fragment.get('type') === 'recovery'
    const recoveryCode = url.searchParams.has('code')
    if (!recoveryFragment && !recoveryCode) return
    // Remove one-time credentials from the address bar before exchanging them.
    history.replaceState({}, '', `${url.pathname}${recoveryCode ? '' : url.search}`)
    const finish = recoveryCode
      ? client.auth.exchangeCodeForSession(url.searchParams.get('code')!)
      : fragment.get('access_token') && fragment.get('refresh_token')
        ? client.auth.setSession({ access_token: fragment.get('access_token')!, refresh_token: fragment.get('refresh_token')! })
        : Promise.resolve({ error: new Error('Link inválido.') })
    void finish.then(({ error }) => {
      if (!error) { history.replaceState({}, '', '/redefinir-senha'); setPath('/redefinir-senha') }
    })
  }, [client])
  useEffect(() => {
    const pop = () => setPath(window.location.pathname)
    const connection = () => setOnline(navigator.onLine)
    window.addEventListener('popstate', pop); window.addEventListener('online', connection); window.addEventListener('offline', connection)
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('online', connection); window.removeEventListener('offline', connection) }
  }, [])
  useEffect(() => {
    let active = true
    // Schedule outside the Auth callback to avoid awaiting Supabase calls while its lock is held.
    const { data } = client.auth.onAuthStateChange((event, session) => { if (event === 'PASSWORD_RECOVERY') { setPath('/redefinir-senha'); history.replaceState({}, '', '/redefinir-senha'); setLoading(false) } if (event === 'SIGNED_OUT') { offlineAccount(null); setSnapshot(null); revision.current++; setContext(null); setLoading(false) } else { if (event === 'SIGNED_IN') offlineAccount(session?.user.id || null); setTimeout(() => { if (active) void refresh() }, 0) } })
    void refresh()
    api.partners().then(value => { if (active) { setPartners(value); setPartnersError('') } })
      .catch(() => { if (active) setPartnersError('Não foi possível carregar a rede de parceiros. Recarregue a página para tentar novamente.') })
      .finally(() => { if (active) setPartnersLoading(false) })
    return () => { active = false; revision.current++; data.subscription.unsubscribe() }
  }, [client, api])
  useEffect(() => {
    let active = true
    if (online) { setSnapshot(null); void refresh() }
    else void readMemberSnapshot().then(value => {
      if (!active) return
      setSnapshot(value)
      if (value && window.location.pathname === '/') { history.replaceState({}, '', '/app'); setPath('/app') }
    })
    return () => { active = false }
  }, [online])
  useEffect(() => {
    if (online) return
    const retry = window.setInterval(() => { if (navigator.onLine) void refresh() }, 15000)
    return () => window.clearInterval(retry)
  }, [online, api])
  function go(to: string) { history.pushState({}, '', to); setPath(to); setMenuOpen(false); window.scrollTo(0, 0) }
  async function logout() { await offlineAccount(null); setSnapshot(null); setContext(null); revision.current++; if (!online) { localStorage.removeItem(`rkmed-auth-${config.environment}-${config.projectRef || 'local'}`); window.location.assign('/'); return } try { await api.endWork() } catch {} await client.auth.signOut({ scope: 'local' }); go('/') }
  const restricted = path.startsWith('/app') || path.startsWith('/admin') || path.startsWith('/parceiro')
  const staffLogin = path.startsWith('/acesso-')
  const staff = context && ['admin', 'support', 'viewer'].includes(context.role)
  const correctArea = context && ((context.role === 'member' && path.startsWith('/app')) || (context.role === 'partner' && path.startsWith('/parceiro')) || (staff && path.startsWith('/admin')))
  const roleHome = context?.role === 'partner' ? '/parceiro' : staff ? '/admin' : '/app'
  const currentPartner = context?.partner || partners.find(partner => partner.id === context?.partnerId)
  const tab = path.split('/')[2] || 'visao'
  const memberTab = path.split('/')[2] ?? ''
  const memberSection = (memberTab === 'parceiros' || memberTab === 'economia' || memberTab === 'assinatura' ? memberTab : ['conta', 'suporte'].includes(memberTab) ? 'conta' : memberTab === 'cobranca' ? 'assinatura' : 'inicio') as 'inicio' | 'parceiros' | 'economia' | 'conta' | 'assinatura'
  return <>
    <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
    <div id="main-content" tabIndex={-1}>
      {path === '/esqueci-senha' ? <ForgotPassword client={client} online={online} go={go} />
        : path === '/redefinir-senha' ? <SetNewPassword client={client} go={go} />
        : path === '/entrar' ? <MemberLogin auth={auth} onAuthenticated={() => { void refresh(); go('/app') }} go={go} online={online} />
        : staffLogin ? <StaffLogin online={online} go={go} login={async (email, password) => { const { error } = await client.auth.signInWithPassword({ email, password }); if (error) throw new Error('E-mail ou senha inválidos.'); try { const result = await api.context(); setContext(result); go(result.role === 'partner' ? '/parceiro' : ['admin', 'support', 'viewer'].includes(result.role) ? '/admin' : '/app') } catch (error) { await client.auth.signOut({ scope: 'local' }); throw error } }} />
        : restricted ? !online && path.startsWith('/app') && snapshot ? <div className="member-main"><Button variant="ghost" onClick={() => void logout()}>Sair</Button><Suspense fallback={<p>Carregando cartão salvo...</p>}><Member key={snapshot.account} api={api} member={snapshot.member} partners={snapshot.partners} online={false} refresh={refresh} snapshot={snapshot} section={memberSection} go={go} /></Suspense></div> : loading ? <div className="gate-page" role="status">Verificando sua sessão...</div>
          : !online ? <Gate icon={<WifiOff />} title="Conexão necessária" detail="Conecte-se para consultar os dados atualizados. Operações do balcão e da equipe exigem conexão." action="Voltar ao início" onAction={() => go('/')} />
          : !context ? <Gate icon={<ShieldCheck />} title="Entre para continuar" detail={error || 'Use seu acesso verificado para abrir esta área.'} action="Entrar" onAction={() => go(path.startsWith('/app') ? '/entrar' : '/acesso-admin')} />
          : !correctArea ? <Gate icon={<ShieldCheck />} title={context.role === 'pending' ? 'Conclua seu cadastro' : 'Área não disponível neste acesso'} detail={context.role === 'pending' ? 'Seu acesso foi verificado. Conclua contatos, dados e foto antes de assinar.' : 'As permissões são verificadas pelo servidor.'} action={context.role === 'pending' ? 'Continuar cadastro' : 'Abrir minha área'} onAction={() => go(context.role === 'pending' ? '/cadastro' : roleHome)} />
          : <div className="workspace"><WorkspaceSidebar><Brand /><nav>{context.role === 'partner' ? <button className="selected" onClick={() => go('/parceiro')}>Balcão</button> : context.role === 'member' ? <>{[['/app', 'Início'], ['/app/parceiros', 'Parceiros'], ['/app/economia', 'Economia'], ['/app/assinatura', 'Assinatura'], ['/app/conta', 'Conta']].map(([route, title]) => <button key={route} className={path === route ? 'selected' : ''} onClick={() => go(route)}>{title}</button>)}</> : <>{[['visao', 'Visão geral'], ['associados', 'Associados'], ['compras', 'Compras'], ['parceiros', 'Parceiros'], ['relatorios', 'Relatórios'], ...(!['viewer'].includes(context.role) ? [['equipe', 'Equipe'], ['cobrancas', 'Cobranças'], ['suporte', 'Suporte']] : [])].map(([route, title]) => <button key={route} className={tab === route ? 'selected' : ''} onClick={() => go(route === 'visao' ? '/admin' : `/admin/${route}`)}>{title}</button>)}</>}</nav><div className="workspace-sidebar-bottom"><button onClick={() => void logout()}><LogOut size={18} /> Sair</button></div></WorkspaceSidebar><div className="workspace-content"><header className="workspace-topbar"><Brand /><span>{context.role === 'partner' ? 'Parceiro' : context.role === 'member' ? 'Associado' : 'Equipe RKMED'}</span></header><main className="workspace-main"><Suspense fallback={<p role="status">Carregando sua área...</p>}>{context.role === 'partner' ? <>{currentPartner && <section className="surface-card counter-flow"><h2>{currentPartner.name}</h2>{context.partner?.isTest && <p role="status">Parceiro de teste · ambiente de homologação</p>}<PartnerLocation partner={currentPartner} /></section>}<Counter key={context.userId} api={api} context={context} refresh={refresh} online={online} /></> : context.member ? <Member key={context.member.id} api={api} member={context.member} partners={partners} online={online} refresh={refresh} section={memberSection} go={go} /> : <Admin key={context.userId} api={api} context={context} partners={partners} refresh={reload} online={online} tab={tab} openCollections={() => go('/admin/cobrancas')} go={go} />}</Suspense></main></div></div>
        : path.startsWith('/cadastro') ? <Suspense fallback={<p role="status">Carregando cadastro...</p>}><Enrollment client={client} api={api} context={context} refresh={refresh} go={go} online={online} /></Suspense>
        : path === '/termos' || path === '/privacidade'
          ? <LegalDocument api={api} kind={path === '/termos' ? 'terms' : 'privacy'} go={go} />
          : <Landing partnersLoading={partnersLoading} partnersError={partnersError} data={{ partners }} go={go} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />}
    </div>
  </>
}

function StaffLogin({ online, login, go }: { online: boolean; login: (email: string, password: string) => Promise<void>; go: (path: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) { e.preventDefault(); if (!online || busy) return; setBusy(true); setError(''); try { await login(email.trim(), password); setPassword('') } catch (e) { setError(e instanceof Error ? e.message : 'Acesso indisponível.') } finally { setBusy(false) } }
  return <main className="partner-entry"><div className="partner-entry-card"><Brand /><h1>Acesso da equipe</h1><p>Entre com a conta cadastrada para seu estabelecimento ou para a equipe RKMED.</p><form onSubmit={submit}><label className="field-label">E-mail<input className="input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label><label className="field-label">Senha<input className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><Button type="submit" className="full" disabled={!online || busy}>{busy ? 'Entrando...' : 'Entrar'}</Button></form>{error && <p className="inline-error" role="alert">{error}</p>}<button className="text-link" type="button" onClick={() => go('/esqueci-senha')}>Esqueci minha senha</button><button className="text-link" onClick={() => go('/')}>Voltar ao início</button></div></main>
}
