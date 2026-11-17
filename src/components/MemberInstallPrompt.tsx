import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Download, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react'
import { Button } from './ui/button'
import './member-install.css'

type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
const InstallContext = createContext<{ event: InstallEvent | null; installed: boolean; clear: () => void; dismissed: boolean; dismiss: () => void }>({ event: null, installed: false, clear: () => {}, dismissed: false, dismiss: () => {} })
const standalone = () => window.matchMedia('(display-mode: standalone)').matches
  || window.matchMedia('(display-mode: fullscreen)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true
const mobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 0 && (window.matchMedia('(max-width: 800px)').matches || /Macintosh/i.test(navigator.userAgent)))

// Listen before the lazy member screen loads, including when the visitor starts on the landing page.
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(standalone)
  const [dismissed, setDismissed] = useState(false)
  const memberVisit = useRef(location.pathname.startsWith('/app'))
  useEffect(() => {
    const navigation = () => queueMicrotask(() => { const next = location.pathname.startsWith('/app'); if (next && !memberVisit.current) setDismissed(false); memberVisit.current = next })
    const restored = (event: PageTransitionEvent) => { if (event.persisted) setDismissed(false) }
    window.addEventListener('rkmed:internal-navigation', navigation); window.addEventListener('popstate', navigation); window.addEventListener('pageshow', restored)
    return () => { window.removeEventListener('rkmed:internal-navigation', navigation); window.removeEventListener('popstate', navigation); window.removeEventListener('pageshow', restored) }
  }, [])
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)')
    const capture = (value: Event) => {
      if (mobile()) value.preventDefault()
      setEvent(value as InstallEvent)
    }
    const completed = () => { setInstalled(true); setEvent(null) }
    const changed = () => setInstalled(standalone())
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', completed)
    display.addEventListener('change', changed)
    return () => {
      window.removeEventListener('beforeinstallprompt', capture)
      window.removeEventListener('appinstalled', completed)
      display.removeEventListener('change', changed)
    }
  }, [])
  return <InstallContext.Provider value={{ event, installed, clear: () => setEvent(null), dismissed, dismiss: () => setDismissed(true) }}>{children}</InstallContext.Provider>
}

export function MemberInstallPrompt() {
  const { event, installed, clear, dismissed, dismiss } = useContext(InstallContext)
  const [eligible, setEligible] = useState(mobile)
  const [instructions, setInstructions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  const open = eligible && !installed && !dismissed
  useEffect(() => {
    const resize = () => setEligible(mobile())
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  async function install() {
    if (busy) return
    if (!event) { setInstructions(value => !value); return }
    setBusy(true); setError('')
    try {
      await event.prompt()
      await event.userChoice
      dismiss()
    } catch {
      setError('Não foi possível abrir a instalação. Use o menu do navegador para adicionar à tela inicial.')
    } finally { clear(); setBusy(false) }
  }
  if (!open) return null
  return <aside className="member-install-banner" aria-labelledby="member-install-title" aria-describedby="member-install-description">
    <button className="member-install-close" aria-label="Fechar convite de instalação" onClick={dismiss}><X size={20} /></button>
    <div className="member-install-mark" aria-hidden="true"><Smartphone size={30} /></div>
    <h2 id="member-install-title">Seu cartão, na tela inicial.</h2>
    <p id="member-install-description">Adicione o app RKMED ao seu celular e tenha seu cartão e seus benefícios sempre à mão.</p>
    {!event && instructions && (ios ? <ol className="member-install-steps">
      <li><Share size={20} aria-hidden="true" /><span>{/CriOS/i.test(navigator.userAgent) ? 'No Chrome, procure' : /FxiOS/i.test(navigator.userAgent) ? 'No Firefox, procure' : 'No Safari, toque em'} <strong>Compartilhar</strong>. Se a opção de adicionar não aparecer, abra esta página no Safari.</span></li>
      <li><PlusSquare size={20} aria-hidden="true" /><span>Toque em <strong>Adicionar à Tela de Início</strong> e confirme em <strong>Adicionar</strong>.</span></li>
    </ol> : <div className="member-install-instructions"><MoreVertical size={20} aria-hidden="true" /><p>Abra o menu do navegador e procure <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</p></div>)}
    {error && <p role="alert" className="inline-error">{error}</p>}
    <div className="member-install-actions">
      <Button disabled={busy} onClick={() => void install()}><Download size={18} />{busy ? 'Abrindo instalação…' : 'Instalar aplicativo'}</Button>
      <Button variant="ghost" onClick={dismiss}>Agora não</Button>
    </div>
  </aside>
}
