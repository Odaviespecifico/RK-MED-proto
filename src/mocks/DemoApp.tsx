import { WorkspaceSidebar, useDialogFocus } from '../components/workspace'
import { PartnerMap } from '../PartnerMap'
import { Brand, Eyebrow, Gate, PartnerLogo } from '../components/identity'
import { Landing } from '../features/public/Landing'
import { MemberLogin } from '../features/auth/MemberLogin'
import { createDemoAuth } from '../mocks/auth'
import { SESSION_KEY, WORK_SESSION_KEY, loadSession, loadWorkSession, type DemoSession as Session } from '../mocks/session'
import { brl, shortDate, maskedCpf, onlyDigits, validCpf, isAdult } from '../lib/format'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Camera, Check, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, CreditCard,
  Fingerprint, Heart, HelpCircle, Home, Info, LayoutDashboard, LockKeyhole, LogOut,
  MapPin, Plus, QrCode, Receipt, RefreshCw, ScanLine, Search, ShieldCheck,
  ShoppingBag, Smartphone, TrendingUp, UserRound, Users, Wallet, Wifi, WifiOff, X
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { LiveFaceCamera } from '../LiveFaceCamera'
import { AdminEmployees, AdminPartners } from '../AdminDirectory'
import { detectFace } from '../lib/face'
import {
  activeWorkAssignment, calculateDiscount, DEMO_EMPLOYEE_CODE, DEMO_OTP, DEMO_PASSWORD, isEligible,
  LEGAL_WARNING, loadDemo, memberSavings, saveDemo,
  statusLabel, type DemoState, type Member, type Purchase, type WorkSession
} from '../mocks/data'

const readPath = () => window.location.pathname

function App() {
  const [path, setPath] = useState(readPath)
  const [data, setData] = useState<DemoState>(loadDemo)
  const [session, setSession] = useState<Session | null>(loadSession)
  const [online, setOnline] = useState(navigator.onLine)
  const [toast, setToast] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const pop = () => setPath(readPath())
    const checkConnection = async () => {
      if (!navigator.onLine) { setOnline(false); return }
      try {
        const response = await fetch(`/?rkmed-connectivity=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
        setOnline(response.ok)
      } catch { setOnline(false) }
    }
    window.addEventListener('popstate', pop)
    window.addEventListener('online', checkConnection)
    window.addEventListener('offline', checkConnection)
    window.addEventListener('focus', checkConnection)
    void checkConnection()
    const timer = window.setInterval(checkConnection, 12000)
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('online', checkConnection); window.removeEventListener('offline', checkConnection); window.removeEventListener('focus', checkConnection); window.clearInterval(timer) }
  }, [])
  useEffect(() => saveDemo(data), [data])
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === 'rkmed-prototype-data-v1') setData(loadDemo()) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  }, [session])
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 4500); return () => window.clearTimeout(id) }, [toast])
  useEffect(() => {
    const section = path === '/' ? 'Linha Gold' : path.startsWith('/app') ? 'Área do associado' : path.startsWith('/parceiro') ? 'Balcão do parceiro' : path.startsWith('/admin') ? 'Gestão' : path === '/cadastro' ? 'Cadastro' : path === '/entrar' ? 'Entrar' : path === '/termos' ? 'Termos de uso' : path === '/privacidade' ? 'Privacidade' : 'Acesso'
    document.title = `${section} | RKMED`
  }, [path])

  function go(to: string) { window.history.pushState({}, '', to); setPath(to); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function login(value: Session, to?: string) { sessionStorage.removeItem(WORK_SESSION_KEY); setSession(value); go(to ?? (value.role === 'member' ? '/app' : value.role === 'partner' ? '/parceiro' : '/admin')) }
  function logout() { sessionStorage.removeItem(WORK_SESSION_KEY); setSession(null); go('/'); setToast('Sessão encerrada.') }
  function update(next: DemoState) { setData(next) }
  const member = session?.memberId ? data.members.find(item => item.id === session.memberId) : undefined
  const shared = { data, update, session, login, go, online, notify: setToast }

  let content: ReactNode
  if (path.startsWith('/app')) content = session?.role === 'member' && member
    ? <MemberApp {...shared} member={member} path={path} logout={logout} />
    : <Gate icon={<LockKeyhole size={26} />} title="Seu espaço, só seu" detail="Entre para acessar seu cartão digital e seus benefícios." action="Entrar como associado" onAction={() => go('/entrar')} />
  else if (path.startsWith('/parceiro')) content = !online
    ? <Gate icon={<WifiOff size={28} />} title="Conexão necessária" detail="O balcão precisa de internet para validar a assinatura e registrar compras." action="Ir ao início" onAction={() => go('/')} />
    : session?.role === 'partner'
      ? <PartnerApp {...shared} path={path} logout={logout} />
      : <Gate icon={<ScanLine size={28} />} title="Área do parceiro" detail="Acesse com a conta do estabelecimento para validar associados." action="Entrar no painel" onAction={() => go('/acesso-parceiro')} />
  else if (path.startsWith('/admin')) content = !online
    ? <Gate icon={<WifiOff size={28} />} title="Conexão necessária" detail="O painel de gestão está disponível somente quando você está online." action="Ir ao início" onAction={() => go('/')} />
    : (session?.role === 'admin' || session?.role === 'viewer')
      ? <AdminApp {...shared} path={path} logout={logout} />
      : <Gate icon={<ShieldCheck size={28} />} title="Acesso restrito" detail="O painel de gestão é exclusivo da equipe autorizada." action="Entrar no painel" onAction={() => go('/acesso-admin')} />
  else if (path === '/cadastro') content = <Enrollment {...shared} />
  else if (path === '/entrar') content = <MemberLogin auth={createDemoAuth(data)} onAuthenticated={id => login({ role: 'member', memberId: id })} go={go} online={online} demo emailPlaceholder="ana@exemplo.com" demoHint={<div className="demo-hint"><Info size={16} /><span><b>Acesso de demonstração</b><br />WhatsApp: 81999990001 · E-mail: ana@exemplo.com · Código: <b>123456</b></span></div>} />
  else if (path === '/acesso-parceiro') content = <StaffLogin role="partner" login={login} go={go} />
  else if (path === '/acesso-admin') content = <StaffLogin role="admin" login={login} go={go} />
  else if (path === '/termos' || path === '/privacidade') content = <LegalPage type={path.slice(1)} go={go} />
  else content = <Landing data={data} go={go} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

  return <>
    <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
    <div className="prototype-ribbon"><span className="ribbon-dot" /> PROTÓTIPO RKMED <span className="ribbon-divider">·</span> Dados fictícios</div>
    {!online && <div className="offline-banner" role="status"><WifiOff size={15} /> Você está offline. Conteúdo salvo disponível; ações que precisam de internet estão desativadas.</div>}
    <div id="main-content" tabIndex={-1}>{content}</div>
    {toast && <div className="toast" role="status"><CheckCircle2 size={18} /> {toast}<button aria-label="Fechar aviso" onClick={() => setToast('')}><X size={16} /></button></div>}
  </>
}

function Avatar({ member, size = 'normal' }: { member?: Pick<Member, 'name' | 'photo'>; size?: 'normal' | 'large' | 'tiny' }) {
  const initials = member?.name.split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() ?? 'RK'
  return <div className={`avatar avatar-${size}`}>{member?.photo ? <img src={member.photo} alt={`Foto de ${member.name}`} /> : <span>{initials}</span>}</div>
}
function Status({ active, children }: { active: boolean; children: ReactNode }) { return <span className={`status-badge ${active ? 'status-active' : 'status-blocked'}`}><span className="status-dot" />{children}</span> }
function PanelHeader({ title, subtitle, side }: { title: string; subtitle?: string; side?: ReactNode }) { return <div className="panel-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{side}</div> }
function StaffLogin({ role, login, go }: { role: 'partner' | 'admin'; login: (s: Session, to?: string) => void; go: (p: string) => void }) {
  const [email, setEmail] = useState(role === 'partner' ? 'parceiro@rkmed.demo' : 'admin@rkmed.demo')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    const allowed = role === 'partner' ? email === 'parceiro@rkmed.demo' : ['admin@rkmed.demo', 'diretoria@rkmed.demo'].includes(email)
    if (!allowed || password !== DEMO_PASSWORD) return setError('Credenciais de demonstração inválidas.')
    login({ role: email === 'diretoria@rkmed.demo' ? 'viewer' : role })
  }
  return <div className="staff-login"><button className="brand-button" onClick={() => go('/')}><Brand /></button><div className="staff-login-card" role="main"><span className="auth-topline">{role === 'partner' ? 'ACESSO DO ESTABELECIMENTO' : 'ACESSO DA EQUIPE RK'}</span><div className="staff-login-icon">{role === 'partner' ? <ScanLine size={25} /> : <ShieldCheck size={25} />}</div><h1>{role === 'partner' ? 'Painel do parceiro' : 'Painel de gestão'}</h1><p>{role === 'partner' ? 'Valide associados e registre compras com segurança.' : 'Acompanhe a operação e cuide de cada detalhe.'}</p><form onSubmit={submit}><label className="field-label">E-mail<input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><label className="field-label">Senha<input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required /></label>{error && <div className="inline-error" role="alert"><CircleAlert size={16} />{error}</div>}<Button type="submit" className="full">Entrar <ArrowRight size={17} /></Button></form><div className="demo-hint"><Info size={16} /><span><b>Dados de demonstração</b><br />{role === 'partner' ? 'parceiro@rkmed.demo' : 'admin@rkmed.demo ou diretoria@rkmed.demo'}<br />Senha: <b>{DEMO_PASSWORD}</b>{role === 'partner' && <> · Funcionário: <b>{DEMO_EMPLOYEE_CODE}</b></>}</span></div></div></div>
}

type AppShared = { data: DemoState; update: (d: DemoState) => void; session: Session | null; login: (s: Session, to?: string) => void; go: (p: string) => void; online: boolean; notify: (m: string) => void }

function Enrollment({ data, update, login, go, online }: AppShared) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', cpf: '', birth: '', email: '', phone: '' })
  const [emailOtp, setEmailOtp] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [photo, setPhoto] = useState('')
  const [faceStatus, setFaceStatus] = useState<'idle' | 'checking' | 'approved' | 'rejected'>('idle')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [error, setError] = useState('')
  const [accept, setAccept] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const steps = ['Seus dados', 'WhatsApp', 'Código WhatsApp', 'E-mail', 'Código e-mail', 'Sua foto']
  useEffect(() => {
    const heading = cardRef.current?.querySelector('h2')
    if (heading) { heading.tabIndex = -1; heading.focus() }
  }, [step])

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(previous => ({ ...previous, [key]: value }))
    if (key === 'phone') { setPhoneVerified(false); setPhoneOtp('') }
    if (key === 'email') { setEmailVerified(false); setEmailOtp('') }
  }
  function nextIdentity(e: FormEvent) {
    e.preventDefault(); setError('')
    if (!validCpf(form.cpf)) return setError('CPF inválido. Confira os números digitados.')
    if (!isAdult(form.birth)) return setError('A associação individual é para maiores de 18 anos.')
    if (data.members.some(member => member.cpf === onlyDigits(form.cpf))) return setError('CPF já cadastrado. Entre pelo acesso de associado.')
    setStep(2)
  }
  function nextPhone(e: FormEvent) {
    e.preventDefault(); setError('')
    if (onlyDigits(form.phone).length < 10) return setError('Informe um celular com DDD.')
    setStep(3)
  }
  function checkPhoneOtp(e: FormEvent) {
    e.preventDefault(); setError('')
    if (phoneOtp !== DEMO_OTP) return setError('Código inválido. Neste protótipo, use 123456.')
    setPhoneVerified(true); setStep(4)
  }
  function nextEmail(e: FormEvent) {
    e.preventDefault(); setError('')
    if (!phoneVerified) return setError('Confirme o WhatsApp antes de continuar.')
    setStep(5)
  }
  function checkEmailOtp(e: FormEvent) {
    e.preventDefault(); setError('')
    if (emailOtp !== DEMO_OTP) return setError('Código inválido. Neste protótipo, use 123456.')
    setEmailVerified(true); setCameraOpen(true); setStep(6)
  }
  async function onPhoto(file?: File) {
    if (!file) return
    setError(''); setFaceStatus('checking'); setPhoto('')
    try {
      const result = await detectFace(file)
      if (result.count !== 1) { setFaceStatus('rejected'); return setError(result.count === 0 ? 'Não encontramos um rosto nítido e inteiro no recorte. Use uma foto de frente, mais próxima e bem iluminada.' : 'Encontramos mais de um rosto. Use uma foto apenas sua.') }
      setPhoto(result.preview); setFaceStatus('approved')
    } catch (cause) { setFaceStatus('rejected'); setError(cause instanceof Error ? cause.message : 'Não foi possível analisar a foto.') }
  }
  function finish() {
    setError('')
    if (!phoneVerified || !emailVerified) return setError('Confirme o WhatsApp e o e-mail para continuar.')
    if (!photo || faceStatus !== 'approved') return setError('Adicione uma foto com um rosto detectado.')
    if (!accept) return setError('Confirme o aceite dos textos de teste para continuar.')
    if (!online) return setError('Conecte-se à internet para concluir o cadastro.')
    const member: Member = { id: `member-${Date.now()}`, name: form.name.trim(), cpf: onlyDigits(form.cpf), email: form.email.toLowerCase(), phone: onlyDigits(form.phone), cardToken: `RKMED-GOLD-${crypto.randomUUID().toUpperCase()}`, status: 'active', photo, joinedAt: new Date().toISOString(), paidThrough: new Date(Date.now() + 30 * 86400000).toISOString(), emailVerified: true, phoneVerified: true }
    update({ ...data, members: [...data.members, member] }); setStep(7)
    window.setTimeout(() => login({ role: 'member', memberId: member.id }), 1700)
  }
  function back() {
    setError('')
    if (step === 1) go('/')
    else { if (step === 6) setCameraOpen(false); setStep(step - 1) }
  }
  const errorMessage = error && <div className="inline-error" role="alert"><CircleAlert size={16} />{error}</div>
  const demoHint = <div className="demo-hint"><Info size={16} /><span>Para demonstrar, use <b>123456</b>. Nenhuma mensagem real é enviada.</span></div>

  return <div className="enroll">
    <header className="simple-header shell"><button className="brand-button" onClick={() => go('/')}><Brand /></button><button className="back-link" onClick={back}><ArrowLeft size={16} /> Voltar</button></header>
    <main className="enroll-shell"><div className="enroll-head"><Eyebrow>CADASTRO LINHA GOLD</Eyebrow><h1>Crie seu cartão digital.</h1><p>Seis passos para configurar seu acesso à rede de benefícios.</p>
      <div className="step-progress" aria-label={`Passo ${Math.min(step, 6)} de 6`}>{steps.map((label, index) => <div className={step > index + 1 ? 'done' : step === index + 1 ? 'current' : ''} key={label} title={label}><span>{step > index + 1 ? <Check size={13} /> : index + 1}</span><small>{label}</small></div>)}</div>
    </div><div className="enroll-card" ref={cardRef}>
      {step === 1 && <form onSubmit={nextIdentity}><span className="form-step">PASSO 01 DE 06</span><h2>Seus dados.</h2><p>Informe nome, data de nascimento e CPF para começar.</p><div className="form-grid"><label className="field-label wide">Nome completo<input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Como está no seu documento" /></label><label className="field-label">Data de nascimento<input className="input" type="date" value={form.birth} onChange={e => set('birth', e.target.value)} required /></label><label className="field-label">CPF<input className="input" value={form.cpf} onChange={e => set('cpf', e.target.value)} required inputMode="numeric" maxLength={14} placeholder="000.000.000-00" /></label></div>{errorMessage}<Button type="submit" className="full">Continuar <ArrowRight size={17} /></Button></form>}
      {step === 2 && <form onSubmit={nextPhone}><span className="form-step">PASSO 02 DE 06</span><h2>Seu WhatsApp.</h2><p>Vamos confirmar seu número antes de seguir.</p><label className="field-label">WhatsApp<input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required placeholder="(81) 99999-9999" /></label>{errorMessage}<Button type="submit" className="full">Continuar <ArrowRight size={17} /></Button></form>}
      {step === 3 && <form onSubmit={checkPhoneOtp}><span className="form-step">PASSO 03 DE 06</span><h2>Confirme seu WhatsApp.</h2><p>Código enviado para {form.phone}. SMS será a alternativa quando necessário.</p><label className="field-label">Código enviado por WhatsApp<input className="input" value={phoneOtp} inputMode="numeric" maxLength={6} onChange={e => setPhoneOtp(onlyDigits(e.target.value))} placeholder="000000" required /></label>{demoHint}{errorMessage}<Button type="submit" className="full">Confirmar WhatsApp <ArrowRight size={17} /></Button></form>}
      {step === 4 && <form onSubmit={nextEmail}><span className="form-step">PASSO 04 DE 06</span><h2>Seu e-mail.</h2><p>Vamos confirmar também seu endereço de e-mail.</p><label className="field-label">E-mail<input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="seu@email.com" /></label>{errorMessage}<Button type="submit" className="full">Continuar <ArrowRight size={17} /></Button></form>}
      {step === 5 && <form onSubmit={checkEmailOtp}><span className="form-step">PASSO 05 DE 06</span><h2>Confirme seu e-mail.</h2><p>Código enviado para {form.email}.</p><label className="field-label">Código enviado por e-mail<input className="input" value={emailOtp} inputMode="numeric" maxLength={6} onChange={e => setEmailOtp(onlyDigits(e.target.value))} placeholder="000000" required /></label>{demoHint}{errorMessage}<Button type="submit" className="full">Confirmar e-mail <ArrowRight size={17} /></Button></form>}
      {step === 6 && <div><span className="form-step">PASSO 06 DE 06</span><h2>Uma foto para reconhecer você.</h2><p>A câmera abre automaticamente e detecta se há um rosto. O parceiro confere sua foto visualmente no balcão.</p><div className="photo-actions">{!cameraOpen && <Button type="button" onClick={() => { setError(''); setCameraOpen(true) }}><Camera size={17} /> Reabrir câmera</Button>}<Button type="button" variant="secondary" onClick={() => { setCameraOpen(false); inputRef.current?.click() }}>Escolher foto</Button></div>{cameraOpen ? <LiveFaceCamera onCapture={file => { setCameraOpen(false); void onPhoto(file) }} onClose={() => setCameraOpen(false)} /> : <div className="photo-uploader" onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}>{photo ? <img src={photo} alt="Prévia da sua foto" /> : <div className="upload-placeholder"><div><Camera size={25} /></div><b>Escolha uma foto sua</b><span>De frente, com boa luz e sem outras pessoas</span><small>JPG, PNG ou HEIC · até 5 MB</small></div>}{faceStatus === 'checking' && <span className="photo-overlay"><RefreshCw className="spin" /> Analisando rosto...</span>}</div>}<input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/heic,image/heif" onChange={e => { void onPhoto(e.target.files?.[0]); e.target.value = '' }} />{faceStatus === 'approved' && <div className="inline-success"><CheckCircle2 size={17} /> Um rosto detectado. A foto pode seguir para o cadastro.</div>}<label className="check-row"><input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} /><span>Li os <button type="button" onClick={() => go('/termos')}>termos</button> e o <button type="button" onClick={() => go('/privacidade')}>aviso de privacidade</button> de teste.</span></label><div className="legal-warning">{LEGAL_WARNING}</div>{errorMessage}<Button onClick={finish} disabled={!online || !photo || faceStatus !== 'approved' || cameraOpen} className="full">Finalizar cadastro de demonstração <ArrowRight size={17} /></Button><p className="tiny-note"><ShieldCheck size={15} /> Detecção de rosto não confirma identidade. Pagamento Stripe simulado nesta versão visual. Assinatura demonstrativa de {brl(6960)}/mês.</p></div>}
      {step === 7 && <div className="enroll-done"><div><Check size={34} /></div><h2>Você chegou!</h2><p>Seu cartão digital de demonstração está pronto.</p><Button onClick={() => go('/app')}>Ver meu cartão <ArrowRight size={17} /></Button></div>}
    </div></main>
  </div>
}

function QrDisplay({ token }: { token: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => { let alive = true; void import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(token, { margin: 1, width: 440, color: { dark: '#17241e', light: '#ffffff' } })).then(value => { if (alive) setUrl(value) }); return () => { alive = false } }, [token])
  return url ? <img className="qr-img" src={url} alt="QR do cartão do associado" /> : <div className="qr-loading"><RefreshCw className="spin" /></div>
}

function MemberApp({ data, member, path, go, logout, online, notify }: AppShared & { member: Member; path: string; logout: () => void }) {
  const [filter, setFilter] = useState('Todos')
  const [query, setQuery] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [accountAction, setAccountAction] = useState<'billing' | 'support' | null>(null)
  const saved = memberSavings(member.id, data.purchases)
  const myPurchases = data.purchases.filter(p => p.memberId === member.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const available = data.partners.filter(p => (filter === 'Todos' || p.segment === filter) && p.name.toLowerCase().includes(query.toLowerCase()))
  const tabs = [{ to: '/app', icon: <Home size={19} />, label: 'Início' }, { to: '/app/parceiros', icon: <MapPin size={19} />, label: 'Parceiros' }, { to: '/app/economia', icon: <Wallet size={19} />, label: 'Economia' }, { to: '/app/conta', icon: <UserRound size={19} />, label: 'Conta' }]
  const section = path.split('/')[2] ?? ''
  return <div className="member-app"><aside className="member-sidebar"><Brand /><nav>{tabs.map(t => <button key={t.to} className={path === t.to ? 'selected' : ''} onClick={() => go(t.to)}>{t.icon}{t.label}</button>)}</nav><div className="sidebar-help"><div><Heart size={19} /></div><b>Linha Gold</b><small>Consulte sua rede e seus descontos.</small></div><button className="logout-link" onClick={logout}><LogOut size={18} /> Sair da conta</button></aside><div className="member-content"><header className="member-topbar"><Brand /><div><span className="sync-status">{online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? 'Conectado' : 'Modo offline'}</span><button className="avatar-button" aria-label="Menu da minha conta" aria-expanded={showMenu} onClick={() => setShowMenu(!showMenu)}><Avatar member={member} size="tiny" /><span>{member.name.split(' ')[0]}</span><ChevronDown size={15} /></button>{showMenu && <div className="profile-menu"><button onClick={() => go('/app/conta')}>Minha conta</button><button onClick={logout}>Sair</button></div>}</div></header><div className="member-main" role="main">{!section && <><div className="welcome-row"><div><Eyebrow>BEM-VINDA À LINHA GOLD</Eyebrow><h1>Olá, {member.name.split(' ')[0]}</h1><p>Seu cartão está disponível. Mostre o QR em um parceiro para consultar o desconto.</p></div><div className="date-chip"><CalendarDays size={17} /> {new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date())}</div></div><div className="member-overview"><div className="member-card-block"><div className="digital-card"><div className="digital-card-top"><Brand dark /><span>MEMBRO GOLD</span></div><div className="digital-card-center"><span>Descontos na sua rotina.</span></div><div className="digital-card-bottom"><div><small>ASSOCIADO(A)</small><b>{member.name.toUpperCase()}</b></div></div></div><div className="qr-panel"><div className="qr-panel-top"><div><Eyebrow>SEU CARTÃO DIGITAL</Eyebrow><h2>Mostre no parceiro.</h2></div><Status active={isEligible(member)}>{statusLabel(member.status)}</Status></div>{isEligible(member) ? <><div className="qr-wrap"><QrDisplay token={member.cardToken} /></div><p>Apresente este QR no balcão. O parceiro valida sua assinatura online e confere sua foto.</p></> : <div className="card-blocked"><LockKeyhole size={30} /><b>Benefícios indisponíveis</b><p>Procure a equipe RKMED para regularizar sua assinatura.</p></div>}<div className="qr-bottom"><span><ShieldCheck size={16} /> Confirmação segura no parceiro</span><span>RKMED GOLD</span></div></div></div><div className="member-side"><div className="savings-card"><div className="savings-icon"><TrendingUp size={21} /></div><span>VOCÊ JÁ ECONOMIZOU</span><strong>{brl(saved)}</strong><small>em {myPurchases.filter(p => !p.reversedAt).length} compras registradas</small><button onClick={() => go('/app/economia')}>Ver minha economia <ArrowUpRight size={17} /></button></div><div className="quick-block"><div className="small-section-head"><h3>Parceiros da rede</h3><button onClick={() => go('/app/parceiros')}>Ver todos <ArrowRight size={15} /></button></div>{data.partners.slice(0, 3).map(p => <button className="quick-partner" key={p.id} onClick={() => go('/app/parceiros')}><PartnerLogo partner={p} /><span><b>{p.name}</b><small>{p.segment}</small></span><strong>{p.discount}%</strong></button>)}</div></div></div><div className="member-note"><div><Smartphone size={23} /></div><span><b>Seu cartão fica salvo neste aparelho.</b><small>Você pode exibir o QR offline. O parceiro precisa de conexão para validar a assinatura.</small></span><ArrowRight size={20} /></div></>}{section === 'parceiros' && <><PanelHeader title="Encontre um parceiro" subtitle="Filtre a rede por categoria ou nome." /><div className="toolbar"><div className="search-box"><Search size={18} /><input aria-label="Buscar parceiro" placeholder="Buscar parceiro" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="filter-chips">{['Todos', ...new Set(data.partners.map(partner => partner.segment))].map(t => <button key={t} className={filter === t ? 'active' : ''} onClick={() => setFilter(t)}>{t}</button>)}</div></div><div className="directory-grid">{available.map(p => <article className="directory-card" key={p.id}><div className={`directory-art tone-${p.tone}`}><PartnerLogo partner={p} /><span>{p.discount}% DE DESCONTO</span></div><div><small>{p.segment.toUpperCase()}</small><h3>{p.name}</h3><p><MapPin size={16} />{p.address}</p><div className="directory-foot"><Status active>Parceiro ativo</Status><ArrowUpRight size={18} /></div></div></article>)}</div><PartnerMap partners={available} /></>}{section === 'economia' && <><PanelHeader title="Sua economia" subtitle="Descontos registrados nas suas compras." /><div className="stats-row"><div className="stat-large"><span>TOTAL ECONOMIZADO</span><strong>{brl(saved)}</strong><small>Desde que você começou com a RKMED</small></div><div className="stat-mini"><span>COMPRAS REGISTRADAS</span><strong>{myPurchases.filter(p => !p.reversedAt).length}</strong><small>Na sua jornada Gold</small></div><div className="stat-mini"><span>PARCEIROS VISITADOS</span><strong>{new Set(myPurchases.filter(p => !p.reversedAt).map(p => p.partnerId)).size}</strong><small>Mais opções para você</small></div></div><div className="surface-card"><div className="small-section-head"><h3>Histórico de compras</h3><small>Valores de demonstração</small></div>{myPurchases.length ? myPurchases.map(p => { const partner = data.partners.find(v => v.id === p.partnerId); return <div className="purchase-row" key={p.id}><span className="purchase-icon"><ShoppingBag size={19} /></span><div><b>{partner?.name ?? 'Parceiro'}</b><small>{shortDate(p.createdAt)} {p.reversedAt && '· Estornado'}</small></div><strong className={p.reversedAt ? 'muted' : ''}>{p.reversedAt ? brl(0) : `+ ${brl(p.discountCents)}`}</strong></div> }) : <p className="empty-copy">Sua primeira compra com desconto aparecerá aqui.</p>}</div></>}{section === 'conta' && <><PanelHeader title="Minha conta" subtitle="Seus dados e sua assinatura em um só lugar." /><div className="account-grid"><div className="surface-card account-profile"><Avatar member={member} size="large" /><h3>{member.name}</h3><Status active={isEligible(member)}>{statusLabel(member.status)}</Status><div className="account-fields"><div><span>E-mail verificado</span><b>{member.email}</b></div><div><span>WhatsApp verificado</span><b>••••{member.phone.slice(-4)}</b></div><div><span>CPF</span><b>{maskedCpf(member.cpf)}</b></div></div></div><div><div className="surface-card account-plan"><span className="eyebrow"><span className="eyebrow-line" /> SUA ASSINATURA</span><div><h3>Linha Gold</h3><Status active={isEligible(member)}>{statusLabel(member.status)}</Status></div><p>{brl(6960)} / mês · Próxima referência: {shortDate(member.paidThrough)}</p><button disabled={!online} onClick={() => setAccountAction('billing')}><CreditCard size={18} /> Gerenciar cobrança <ArrowUpRight size={18} /></button>{!online && <small>Disponível quando você se reconectar.</small>}<small className="demo-context">No protótipo, cobranças são apenas ilustrativas.</small></div><div className="surface-card support-card"><HelpCircle size={25} /><h3>Precisa de ajuda?</h3><p>Nossa equipe está aqui para você. Segunda a sexta, 8h às 18h; sábado, 8h às 12h.</p><button disabled={!online} onClick={() => setAccountAction('support')}>Falar com suporte <ArrowUpRight size={17} /></button>{!online && <small>Mensagens exigem conexão.</small>}<small className="demo-context">Canal real de suporte será configurado depois.</small></div></div></div></>}</div><nav className="mobile-bottom-nav">{tabs.map(t => <button key={t.to} className={path === t.to ? 'selected' : ''} onClick={() => go(t.to)}>{t.icon}<small>{t.label}</small></button>)}</nav>{accountAction && <MemberActionModal type={accountAction} member={member} close={() => setAccountAction(null)} notify={notify} />}</div></div>
}

function MemberActionModal({ type, member, close, notify }: { type: 'billing' | 'support'; member: Member; close: () => void; notify: (message: string) => void }) {
  const [value, setValue] = useState('')
  const modalRef = useDialogFocus<HTMLFormElement>(true, close)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    notify(type === 'billing' ? `Cartão de demonstração terminado em ${onlyDigits(value).slice(-4)} salvo para esta sessão.` : 'Mensagem de suporte simulada. Nenhum contato real foi feito.')
    close()
  }
  return <div className="confirm-backdrop"><form className="confirm-card" ref={modalRef} role="dialog" aria-modal="true" aria-label={type === 'billing' ? 'Gerenciar cobrança' : 'Falar com suporte'} onSubmit={submit}><button type="button" className="close-button" onClick={close} aria-label="Fechar"><X size={19} /></button><div className="confirm-icon">{type === 'billing' ? <CreditCard size={23} /> : <HelpCircle size={23} />}</div><h2>{type === 'billing' ? 'Gerenciar cobrança' : 'Falar com suporte'}</h2><p>{type === 'billing' ? `${member.name} · Linha Gold ${brl(6960)}/mês. Simule uma atualização de cartão. Nenhum dado de pagamento real é enviado.` : 'Escreva para a equipe RKMED nesta simulação. Nenhuma mensagem real será enviada.'}</p><label className="field-label">{type === 'billing' ? 'Últimos quatro números de cartão fictício' : 'Sua mensagem'}{type === 'billing' ? <input className="input" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" required value={value} onChange={e => setValue(onlyDigits(e.target.value))} placeholder="4242" /> : <textarea className="input" required value={value} onChange={e => setValue(e.target.value)} placeholder="Como podemos ajudar?" />}</label><Button type="submit" className="full">{type === 'billing' ? 'Salvar atualização simulada' : 'Enviar mensagem simulada'}</Button><Button type="button" variant="ghost" className="full" onClick={close}>Cancelar</Button></form></div>
}

function CameraScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const modalRef = useDialogFocus<HTMLDivElement>(true, onClose)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let controls: { stop: () => void } | undefined
    if (!ref.current) return
    void import('@zxing/browser').then(({ BrowserQRCodeReader }) => {
      if (!active || !ref.current) return
      const reader = new BrowserQRCodeReader()
      return reader.decodeFromVideoDevice(undefined, ref.current, (result) => {
        if (result && active) { active = false; controls?.stop(); onResult(result.getText()) }
      })
    }).then(c => { controls = c; if (!active) c?.stop() }).catch(() => setError('Não foi possível abrir a câmera. Confira a permissão ou digite o código do cartão.'))
    return () => { active = false; controls?.stop() }
  }, [onResult])
  return <div className="scanner-modal"><div className="scanner-card" ref={modalRef} role="dialog" aria-modal="true" aria-label="Escanear QR do associado" tabIndex={-1}><div className="scanner-head"><h2>Escanear QR do associado</h2><button onClick={onClose} aria-label="Fechar leitor"><X size={21} /></button></div><div className="scanner-viewport"><video ref={ref} playsInline muted /><span className="scan-corners" /><span className="scanner-line" /></div><p>Enquadre o QR do cartão digital na área indicada.</p>{error && <div className="inline-error" role="alert"><CircleAlert size={16} />{error}</div>}<Button variant="outline" onClick={onClose}>Voltar e digitar código</Button></div></div>
}

function PartnerApp({ data, update, path, go, online, notify, logout }: AppShared & { path: string; logout: () => void }) {
  const [employeeCode, setEmployeeCode] = useState('')
  const [employeeError, setEmployeeError] = useState('')
  const [workSession, setWorkSession] = useState<WorkSession | null>(loadWorkSession)
  const [selectedPartnerId, setSelectedPartnerId] = useState(() => loadWorkSession()?.partnerId ?? data.partners[0]?.id ?? '')
  const [mode, setMode] = useState<'scan' | 'cpf'>('scan')
  const [search, setSearch] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [foundId, setFoundId] = useState('')
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('')
  const [done, setDone] = useState<Purchase | null>(null)
  const successRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!done) return
    successRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [done])
  const [tab, setTab] = useState(path.endsWith('/historico') ? 'historico' : 'balcao')
  const assignment = activeWorkAssignment(data, workSession)
  const employee = assignment?.employee.name ?? ''
  const partner = assignment?.partner ?? data.partners.find(item => item.id === selectedPartnerId) ?? data.partners[0]
  const found = data.members.find(m => m.id === foundId)
  const grossCents = Math.round(Number(amount.replace(',', '.')) * 100)
  const calc = Number.isFinite(grossCents) && grossCents > 0 && partner ? calculateDiscount(grossCents, partner.discount) : { discountCents: 0, finalCents: 0 }
  function selectEmployee(e: FormEvent) {
    e.preventDefault()
    const selectedPartner = data.partners.find(item => item.id === selectedPartnerId)
    const match = data.employees.find(item => item.partnerId === selectedPartnerId && item.active && item.code === employeeCode)
    if (!selectedPartner || !match) return setEmployeeError('Código não autorizado para este parceiro. Confira a seleção e o código com o administrador.')
    const next = { employeeId: match.id, partnerId: selectedPartner.id }
    setWorkSession(next); sessionStorage.setItem(WORK_SESSION_KEY, JSON.stringify(next)); setEmployeeError(''); setEmployeeCode('')
  }
  function resetFlow() { setSearch(''); setFoundId(''); setAmount(''); setError(''); setDone(null); setMode('scan') }
  function lookup(value: string, kind: 'scan' | 'cpf') {
    setError(''); setScanOpen(false)
    const m = data.members.find(member => kind === 'cpf' ? member.cpf === onlyDigits(value) : member.cardToken === value.trim())
    if (!m) { setFoundId(''); setError(kind === 'cpf' ? 'CPF não encontrado. Confira os 11 dígitos.' : 'QR não encontrado. Tente novamente ou busque pelo CPF.'); return }
    setFoundId(m.id); setSearch('')
    if (!isEligible(m)) setError('Benefício indisponível: assinatura bloqueada ou vencida. Oriente a pessoa a falar com a RKMED.')
  }
  function submitPurchase() {
    if (!online) return setError('É preciso estar online para registrar uma compra.')
    if (!found || !isEligible(found)) return setError('Este associado não está apto a usar o benefício.')
    const current = activeWorkAssignment(data, workSession)
    if (!current || current.partner.id !== partner?.id) return setError('Funcionário inativo ou não vinculado ao parceiro. Inicie um novo turno.')
    if (!Number.isFinite(grossCents) || grossCents <= 0 || grossCents > 10000000) return setError('Informe um valor entre R$ 0,01 e R$ 100.000,00.')
    if (done) return
    const purchase: Purchase = { id: crypto.randomUUID(), memberId: found.id, partnerId: current.partner.id, employee: current.employee.name, employeeId: current.employee.id, grossCents, ...calc, createdAt: new Date().toISOString() }
    update({ ...data, purchases: [purchase, ...data.purchases] }); setDone(purchase); notify('Compra registrada. O desconto já aparece na economia do associado.')
  }
  if (!assignment || !partner) return <div className="partner-entry"><div className="partner-entry-card" role="main"><Brand dark /><div className="entry-symbol"><Fingerprint size={29} /></div><Eyebrow>INÍCIO DE TURNO</Eyebrow><h1>Quem está atendendo?</h1><p>Selecione o parceiro e informe seu código. O turno e os registros ficarão vinculados a este estabelecimento.</p><form onSubmit={selectEmployee}><label className="field-label">Parceiro<select className="input" value={selectedPartnerId} onChange={e => { setSelectedPartnerId(e.target.value); setEmployeeCode(''); setEmployeeError('') }}>{data.partners.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="field-label">Código do funcionário<input className="input otp-input" type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={employeeCode} onChange={e => setEmployeeCode(onlyDigits(e.target.value))} required /></label>{employeeError && <div className="inline-error" role="alert"><CircleAlert size={16} />{employeeError}</div>}<Button type="submit" className="full" disabled={!selectedPartnerId}>Iniciar atendimento <ArrowRight size={17} /></Button></form>{selectedPartnerId === 'vida' && <div className="demo-hint"><Info size={16} /><span>Funcionária de demonstração: <b>Marina Costa</b> · Código inicial <b>2468</b></span></div>}<button className="text-link" onClick={logout}>Sair da conta do estabelecimento</button></div></div>
  return <div className="workspace partner-workspace"><WorkspaceSidebar><Brand dark /><div className="workspace-identity"><PartnerLogo partner={partner} /><div><b>{partner.name}</b><small>{partner.segment}</small></div></div><nav><button className={tab === 'balcao' ? 'selected' : ''} onClick={() => { setTab('balcao'); go('/parceiro') }}><ScanLine size={19} /> Balcão</button><button className={tab === 'historico' ? 'selected' : ''} onClick={() => { setTab('historico'); go('/parceiro/historico') }}><Receipt size={19} /> Histórico</button></nav><div className="workspace-sidebar-bottom"><button onClick={() => { setWorkSession(null); sessionStorage.removeItem(WORK_SESSION_KEY); resetFlow() }}><Users size={18} /> Trocar funcionário</button><button onClick={logout}><LogOut size={18} /> Sair</button></div></WorkspaceSidebar><div className="workspace-content"><header className="workspace-topbar"><span><span className="workspace-breadcrumb">Parceiros</span> <ChevronRight size={14} /> {tab === 'historico' ? 'Histórico' : 'Balcão'}</span><div><Status active={online}>{online ? 'Online' : 'Sem conexão'}</Status><Avatar member={{ name: employee }} size="tiny" /><span>{employee}</span></div></header><main className="workspace-main">{tab === 'balcao' ? <><PanelHeader title="Atendimento no balcão" subtitle="Valide o cartão, confira a foto e registre a compra." side={<span className="today-chip"><CalendarDays size={16} /> {shortDate(new Date().toISOString())}</span>} /><div className="counter-layout"><section className="surface-card counter-flow"><div className="counter-step-head"><span>01</span><div><h2>Identifique o associado</h2><p>Leia o cartão digital ou busque pelo CPF.</p></div></div>{!done && <><div className="counter-tabs"><button className={mode === 'scan' ? 'active' : ''} onClick={() => { setMode('scan'); resetFlow() }}><QrCode size={19} /> Ler QR Code</button><button className={mode === 'cpf' ? 'active' : ''} onClick={() => { resetFlow(); setMode('cpf') }}><Search size={19} /> Buscar CPF</button></div><div className="counter-input">{mode === 'scan' ? <><button className="scan-trigger" disabled={!online} onClick={() => setScanOpen(true)}><span><ScanLine size={34} /></span><b>Abrir câmera</b><small>Escaneie o QR exibido no celular do associado</small></button><div className="input-with-button"><input className="input" aria-label="Código do cartão" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ou cole o código do cartão" /><Button variant="secondary" disabled={!online} onClick={() => lookup(search, 'scan')}>Buscar</Button></div></> : <><p>Para o associado sem celular, digite o CPF e confira a foto pessoalmente.</p><div className="input-with-button"><input className="input" aria-label="CPF do associado" value={search} onChange={e => setSearch(e.target.value)} inputMode="numeric" maxLength={14} placeholder="000.000.000-00" /><Button variant="secondary" disabled={!online} onClick={() => lookup(search, 'cpf')}>Buscar</Button></div><small>O CPF completo não aparece nos resultados do painel.</small></>}</div></>}{error && <div className="inline-error" role="alert"><CircleAlert size={17} />{error}</div>}{found && !done && <><div className={`identity-result ${isEligible(found) ? '' : 'identity-blocked'}`}><Avatar member={found} size="large" /><div><span>ASSOCIADO ENCONTRADO</span><h3>{found.name}</h3><small>CPF {maskedCpf(found.cpf)}</small><Status active={isEligible(found)}>{isEligible(found) ? 'Benefício disponível' : 'Benefício indisponível'}</Status></div></div><div className="confirm-photo"><ShieldCheck size={20} /><span>Confira se a pessoa à sua frente corresponde à foto do cadastro. A detecção de rosto no cadastro não faz reconhecimento de identidade.</span></div></>}{done && <div className="purchase-success" ref={successRef} tabIndex={-1} aria-labelledby="purchase-success-title"><span><Check size={34} /></span><h2 id="purchase-success-title">Compra registrada!</h2><p>Economia do cliente nesta compra</p><strong className="purchase-savings">{brl(done.discountCents)}</strong><Button onClick={resetFlow}>Registrar outra compra <Plus size={17} /></Button></div>}</section><aside className="counter-right"><div className="surface-card purchase-form"><div className="counter-step-head"><span>02</span><div><h2>Registre a compra</h2><p>O desconto é calculado automaticamente.</p></div></div><label className="field-label">Valor bruto da compra (R$)<div className="currency-input"><span>R$</span><input inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} disabled={!found || !isEligible(found) || !!done} /></div></label><div className="discount-breakdown"><div><span>Valor da compra</span><b>{brl(grossCents > 0 ? grossCents : 0)}</b></div><div><span>Desconto RKMED ({partner.discount}%)</span><b className="discount-value">− {brl(calc.discountCents)}</b></div><div className="total"><span>Valor a cobrar</span><strong>{brl(calc.finalCents)}</strong></div></div><Button className="full" disabled={!online || !found || !isEligible(found) || !amount || !!done} onClick={submitPurchase}>Confirmar registro <ArrowRight size={17} /></Button><p className="tiny-note">O pagamento acontece diretamente entre associado e parceiro.</p></div><div className="tip-card"><ShieldCheck size={22} /><b>Confira antes de registrar.</b><p>Confirme a foto e o valor com o associado antes de finalizar.</p></div></aside></div></> : <><PanelHeader title="Histórico do estabelecimento" subtitle="Registros recentes da unidade, com economia de cada associado." /><div className="surface-card table-card"><table className="responsive-table"><thead><tr><th>Associado</th><th>Data</th><th>Funcionário</th><th>Compra</th><th>Desconto</th><th>Status</th></tr></thead><tbody>{data.purchases.filter(p => p.partnerId === partner.id).map(p => { const m = data.members.find(x => x.id === p.memberId); return <tr key={p.id}><td data-label="Associado">{m?.name ?? 'Associado'}</td><td data-label="Data">{shortDate(p.createdAt)}</td><td data-label="Funcionário">{p.employee}</td><td data-label="Compra">{brl(p.grossCents)}</td><td data-label="Desconto">{brl(p.discountCents)}</td><td data-label="Status"><Status active={!p.reversedAt}>{p.reversedAt ? 'Estornado' : 'Registrado'}</Status></td></tr> })}</tbody></table></div></>}</main></div>{scanOpen && <CameraScanner onResult={value => lookup(value, 'scan')} onClose={() => setScanOpen(false)} />}</div>
}

function AdminApp({ data, update, session, path, go, online, notify, logout }: AppShared & { path: string; logout: () => void }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState(path.split('/')[2] ?? '')
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState<'link' | 'retry' | null>(null)
  const modalRef = useDialogFocus<HTMLDivElement>(!!selected, () => { setSelected(null); setConfirm(null); setReason('') })
  const [actionBusy, setActionBusy] = useState(false)
  const viewer = session?.role === 'viewer'
  const activeCount = data.members.filter(isEligible).length
  const totalSavings = data.purchases.filter(p => !p.reversedAt).reduce((sum, p) => sum + p.discountCents, 0)
  const overdue = data.members.filter(m => !isEligible(m))
  function choose(t: string) { setTab(t); go(t ? `/admin/${t}` : '/admin') }
  function reverse(p: Purchase) {
    if (viewer || !online || !reason.trim() || p.reversedAt) return
    update({ ...data, purchases: data.purchases.map(x => x.id === p.id ? { ...x, reversedAt: new Date().toISOString(), reversedBy: 'Admin RKMED', reversalReason: reason.trim() } : x) }); setSelected(null); setReason(''); notify('Registro estornado. A economia do associado foi atualizada.')
  }
  function collect() {
    if (!confirm || !selected || viewer || !online || actionBusy) return
    setActionBusy(true)
    const memberId = selected
    const action = confirm
    const invoiceRef = `demo-invoice-${memberId}`
    const duplicate = data.collectionLogs.some(item => item.invoiceRef === invoiceRef && item.action === action && Date.now() - new Date(item.createdAt).getTime() < 30000)
    if (duplicate) { setActionBusy(false); setConfirm(null); setSelected(null); notify('Ação já registrada nos últimos 30 segundos. Confira o histórico.'); return }
    window.setTimeout(() => {
      update({ ...data, collectionLogs: [{ id: crypto.randomUUID(), memberId, action, invoiceRef, actor: 'Equipe RK', createdAt: new Date().toISOString() }, ...data.collectionLogs] })
      notify(action === 'link' ? 'Link Stripe de demonstração registrado como enviado.' : 'Retentativa da fatura existente registrada em modo de demonstração.')
      setActionBusy(false); setConfirm(null); setSelected(null)
    }, 650)
  }
  return <div className="workspace admin-workspace"><WorkspaceSidebar><Brand dark /><div className="workspace-label">PAINEL DE GESTÃO</div><nav>{[{ key: '', icon: <LayoutDashboard size={19} />, label: 'Visão geral' }, { key: 'associados', icon: <Users size={19} />, label: 'Associados' }, { key: 'compras', icon: <Receipt size={19} />, label: 'Compras' }, { key: 'cobrancas', icon: <CreditCard size={19} />, label: 'Cobranças', badge: overdue.length }, { key: 'parceiros', icon: <MapPin size={19} />, label: 'Parceiros' }, { key: 'equipe', icon: <UserRound size={19} />, label: 'Equipe' }].map(item => <button key={item.key} className={tab === item.key ? 'selected' : ''} onClick={() => choose(item.key)}>{item.icon} {item.label}{item.badge ? <span className="sidebar-count">{item.badge}</span> : null}</button>)}</nav><div className="workspace-sidebar-bottom"><div className="admin-user"><Avatar member={{ name: viewer ? 'Diretoria RK' : 'Equipe RK' }} size="tiny" /><span><b>{viewer ? 'Diretoria RK' : 'Equipe RK'}</b><small>{viewer ? 'Visualização' : 'Administrador'}</small></span></div><button onClick={logout}><LogOut size={18} /> Sair</button></div></WorkspaceSidebar><div className="workspace-content"><header className="workspace-topbar"><span><span className="workspace-breadcrumb">RKMED</span> <ChevronRight size={14} /> {tab || 'Visão geral'}</span><div><span className="workspace-date">{shortDate(new Date().toISOString())}</span><button className="icon-button" aria-label="Notificações" onClick={() => choose('cobrancas')}><Bell size={18} /><i /></button><Avatar member={{ name: viewer ? 'Diretoria RK' : 'Equipe RK' }} size="tiny" /></div></header><main className="workspace-main">{!tab && <><PanelHeader title="Resumo da operação" subtitle="Assinaturas, compras e cobranças da demonstração." side={<span className="today-chip"><Activity size={16} /> Dados de demonstração</span>} /><div className="admin-stats"><div className="admin-stat"><span className="stat-top"><span>ASSOCIADOS ATIVOS</span><Users size={19} /></span><strong>{activeCount.toString().padStart(2, '0')}</strong><small><TrendingUp size={14} /> Assinaturas disponíveis</small></div><div className="admin-stat"><span className="stat-top"><span>COMPRAS REGISTRADAS</span><ShoppingBag size={19} /></span><strong>{data.purchases.filter(p => !p.reversedAt).length.toString().padStart(2, '0')}</strong><small><ArrowUpRight size={14} /> Em parceiros credenciados</small></div><div className="admin-stat"><span className="stat-top"><span>ECONOMIA GERADA</span><Wallet size={19} /></span><strong>{brl(totalSavings)}</strong><small><TrendingUp size={14} /> Para os associados</small></div><div className="admin-stat alert-stat"><span className="stat-top"><span>ATENÇÃO NECESSÁRIA</span><CircleAlert size={19} /></span><strong>{overdue.length.toString().padStart(2, '0')}</strong><small>Assinatura pendente</small></div></div><div className="admin-dashboard-grid"><div className="surface-card"><div className="small-section-head"><h3>Últimas compras</h3><button onClick={() => choose('compras')}>Ver todas <ArrowRight size={16} /></button></div>{data.purchases.slice(0, 4).map(p => { const m = data.members.find(x => x.id === p.memberId); const partner = data.partners.find(x => x.id === p.partnerId); return <div className="dash-row" key={p.id}><span className="purchase-icon"><ShoppingBag size={18} /></span><span><b>{m?.name ?? 'Associado'}</b><small>{partner?.name} · {shortDate(p.createdAt)}</small></span><strong>{brl(p.grossCents)}</strong></div> })}</div><div className="surface-card attention-card"><div className="small-section-head"><h3>Precisam de atenção</h3><button onClick={() => choose('cobrancas')}>Ver cobranças <ArrowRight size={16} /></button></div>{overdue.map(m => <div className="attention-row" key={m.id}><Avatar member={m} size="tiny" /><span><b>{m.name}</b><small>Assinatura bloqueada</small></span><CircleAlert size={18} /></div>)}<div className="attention-note"><CircleAlert size={17} /> Verifique a situação antes de enviar uma cobrança.</div></div></div></>}{tab === 'associados' && <><PanelHeader title="Associados" subtitle="Consulte assinaturas e histórico de economia." /><div className="toolbar"><div className="search-box"><Search size={18} /><input aria-label="Buscar associado por nome ou CPF exato" placeholder="Buscar nome ou CPF exato" value={query} onChange={e => setQuery(e.target.value)} /></div><span className="today-chip">{data.members.length} associados</span></div><div className="surface-card table-card"><table className="responsive-table"><thead><tr><th>Associado</th><th>CPF protegido</th><th>Assinatura</th><th>Economia</th><th>Adesão</th></tr></thead><tbody>{data.members.filter(m => !query || m.name.toLowerCase().includes(query.toLowerCase()) || m.cpf === onlyDigits(query)).map(m => <tr key={m.id}><td data-label="Associado"><span className="table-person"><Avatar member={m} size="tiny" /><span><b>{m.name}</b><small>{m.email}</small></span></span></td><td data-label="CPF">{maskedCpf(m.cpf)}</td><td data-label="Assinatura"><Status active={isEligible(m)}>{statusLabel(m.status)}</Status></td><td data-label="Economia">{brl(memberSavings(m.id, data.purchases))}</td><td data-label="Adesão">{shortDate(m.joinedAt)}</td></tr>)}</tbody></table></div><p className="demo-context">Este protótipo mantém CPF em dados locais de demonstração para simular a busca. O produto real retornará apenas CPF mascarado ao navegador.</p></>}{tab === 'compras' && <><PanelHeader title="Compras registradas" subtitle="Veja os benefícios utilizados e corrija registros quando necessário." /><div className="surface-card table-card"><table className="responsive-table"><thead><tr><th>Associado</th><th>Parceiro</th><th>Data</th><th>Valor</th><th>Economia</th><th>Status</th>{!viewer && <th />}</tr></thead><tbody>{data.purchases.map(p => { const m = data.members.find(x => x.id === p.memberId); const partner = data.partners.find(x => x.id === p.partnerId); return <tr key={p.id}><td data-label="Associado">{m?.name}</td><td data-label="Parceiro">{partner?.name}</td><td data-label="Data">{shortDate(p.createdAt)}</td><td data-label="Valor">{brl(p.grossCents)}</td><td data-label="Economia">{brl(p.discountCents)}</td><td data-label="Status"><Status active={!p.reversedAt}>{p.reversedAt ? 'Estornado' : 'Registrado'}</Status></td>{!viewer && <td data-label="Ação"><button className="table-action" disabled={!!p.reversedAt || !online} onClick={() => setSelected(p.id)}>Estornar</button></td>}</tr> })}</tbody></table></div>{selected && !confirm && <div className="confirm-backdrop"><div className="confirm-card" ref={modalRef} role="dialog" aria-modal="true" aria-label="Estornar compra" tabIndex={-1}><button className="close-button" onClick={() => { setSelected(null); setReason('') }}><X size={19} /></button><div className="confirm-icon"><Receipt size={23} /></div><h2>Estornar compra?</h2><p>O registro original ficará no histórico. A economia do associado será atualizada.</p><label className="field-label">Motivo do estorno<textarea className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Descreva o motivo" /></label><Button disabled={!reason.trim() || !online} onClick={() => { const p = data.purchases.find(x => x.id === selected); if (p) reverse(p) }} className="full">Confirmar estorno</Button><Button variant="ghost" className="full" onClick={() => setSelected(null)}>Cancelar</Button></div></div>}</>}{tab === 'cobrancas' && <><PanelHeader title="Cobranças e suporte" subtitle="Acompanhe pagamentos pendentes e ações registradas." /><div className="collections-intro"><div><CircleAlert size={22} /></div><span><b>{overdue.length} associado{overdue.length === 1 ? '' : 's'} precisa{overdue.length === 1 ? '' : 'm'} de atenção</b><small>Benefícios indisponíveis desde a falha no pagamento. O parceiro vê essa situação ao validar o cartão.</small></span></div><div className="surface-card table-card"><table className="responsive-table"><thead><tr><th>Associado</th><th>CPF</th><th>Situação</th><th>Mensalidade</th><th>Última tentativa</th>{!viewer && <th>Ações</th>}</tr></thead><tbody>{overdue.map(m => <tr key={m.id}><td data-label="Associado"><span className="table-person"><Avatar member={m} size="tiny" /><span><b>{m.name}</b><small>{m.email}</small></span></span></td><td data-label="CPF">{maskedCpf(m.cpf)}</td><td data-label="Situação"><Status active={false}>Pagamento pendente</Status></td><td data-label="Mensalidade">{brl(6960)}</td><td data-label="Última tentativa">{shortDate(m.paidThrough)}</td>{!viewer && <td data-label="Ações"><div className="row-actions"><button disabled={!online} onClick={() => { setSelected(m.id); setConfirm('link') }}>Enviar link</button><button disabled={!online} onClick={() => { setSelected(m.id); setConfirm('retry') }}>Retentar fatura</button></div></td>}</tr>)}</tbody></table></div><div className="surface-card collection-history"><div className="small-section-head"><h3>Histórico de ações</h3><small>Simulação local auditável</small></div>{data.collectionLogs.length ? data.collectionLogs.map(item => <div className="dash-row" key={item.id}><span className="purchase-icon"><CreditCard size={18} /></span><span><b>{item.action === 'link' ? 'Link enviado' : 'Retentativa solicitada'} · {data.members.find(m => m.id === item.memberId)?.name}</b><small>{item.actor} · {shortDate(item.createdAt)} · {item.invoiceRef}</small></span></div>) : <p className="empty-copy">Nenhuma ação de cobrança registrada.</p>}</div>{confirm && selected && <div className="confirm-backdrop"><div className="confirm-card" ref={modalRef} role="dialog" aria-modal="true" aria-label="Confirmar ação de cobrança" tabIndex={-1}><button className="close-button" onClick={() => { setConfirm(null); setSelected(null) }}><X size={19} /></button><div className="confirm-icon"><CreditCard size={23} /></div><h2>{confirm === 'link' ? 'Enviar link de cobrança?' : 'Retentar fatura existente?'}</h2><p>{data.members.find(m => m.id === selected)?.name} · Mensalidade {brl(6960)}. Esta é uma ação simulada com confirmação e sem cobrança real.</p><div className="demo-hint"><ShieldCheck size={16} /><span>A operação real deverá auditar a ação e proteger contra cobranças duplicadas.</span></div><Button className="full" disabled={!online || actionBusy} onClick={collect}>{actionBusy ? 'Registrando...' : 'Confirmar ação'}</Button><Button className="full" variant="ghost" onClick={() => { setConfirm(null); setSelected(null) }}>Cancelar</Button></div></div>}</>}{tab === 'parceiros' && <AdminPartners data={data} update={update} notify={notify} online={online} viewer={viewer} />}{tab === 'equipe' && <AdminEmployees data={data} update={update} notify={notify} online={online} viewer={viewer} />}</main></div></div>
}

function LegalPage({ type, go }: { type: string; go: (p: string) => void }) { return <div className="legal-page shell"><header className="simple-header"><button className="brand-button" onClick={() => go('/')}><Brand /></button><button className="back-link" onClick={() => go('/cadastro')}><ArrowLeft size={16} /> Cadastro</button></header><div className="legal-card" role="main"><Eyebrow>DOCUMENTO DE TESTE</Eyebrow><h1>{type === 'termos' ? 'Termos de uso' : 'Aviso de privacidade'}</h1><div className="legal-warning">{LEGAL_WARNING}</div>{type === 'termos' ? <><p>Este protótipo demonstra um clube de benefícios para maiores de 18 anos. A mensalidade ilustrativa é {brl(6960)}. O associado paga suas compras diretamente ao parceiro credenciado.</p><p>O cartão digital pode ser exibido offline. A validação da assinatura e o registro de compra exigem que o parceiro esteja online. Falha de pagamento remove o acesso ao benefício imediatamente.</p><p>Todo cadastro, pagamento e aceite nesta versão são simulados. O texto definitivo depende de revisão jurídica.</p></> : <><p>O protótipo armazena dados fictícios no navegador para demonstrar cadastro, cartão, compras e economia. A foto é analisada apenas para detectar a presença de um rosto.</p><p>O CPF é mostrado mascarado nas telas. A versão demonstrativa usa armazenamento local e não deve receber dados reais. Dados salvos podem permanecer offline até serem apagados pelo navegador ou pelo usuário.</p><p>Este texto deverá ser substituído e aprovado antes do uso em produção.</p></>}</div></div> }

export default App
