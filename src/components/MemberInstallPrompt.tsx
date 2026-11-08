import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Download, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react'
import { Button } from './ui/button'
import './member-install.css'

type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
const DISMISSED_KEY = 'rkmed:pwa-install-dismissed-at'
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000
const InstallContext = createContext<{ event: InstallEvent | null; installed: boolean; clear: () => void }>({ event: null, installed: false, clear: () => {} })
const standalone = () => window.matchMedia('(display-mode: standalone)').matches
  || window.matchMedia('(display-mode: fullscreen)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true
const mobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 0 && (window.matchMedia('(max-width: 800px)').matches || /Macintosh/i.test(navigator.userAgent)))

// Listen before the lazy member screen loads, including when the visitor starts on the landing page.
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(standalone)
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
  return <InstallContext.Provider value={{ event, installed, clear: () => setEvent(null) }}>{children}</InstallContext.Provider>
}

export function MemberInstallPrompt() {
  const { event, installed, clear } = useContext(InstallContext)
  const dialog = useRef<HTMLDialogElement>(null)
  const [eligible, setEligible] = useState(mobile)
  const [dismissed, setDismissed] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(DISMISSED_KEY))
      return saved > 0 && Date.now() - saved < SNOOZE_MS
    } catch { return false }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  const open = eligible && !installed && !dismissed
  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* Still dismiss for this visit if storage is unavailable. */ }
  }
  useEffect(() => {
    const resize = () => setEligible(mobile())
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  useEffect(() => {
    const element = dialog.current
    if (!open || !element) return
    element.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = previousOverflow }
  }, [open])
  async function install() {
    if (!event || busy) return
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
  return <dialog ref={dialog} className="member-install-dialog" aria-labelledby="member-install-title" aria-describedby="member-install-description"
    onCancel={e => { e.preventDefault(); dismiss() }}>
    <button className="member-install-close" aria-label="Fechar convite de instalação" onClick={dismiss}><X size={20} /></button>
    <div className="member-install-mark" aria-hidden="true"><Smartphone size={30} /></div>
    <span className="member-install-eyebrow">RKMED LINHA GOLD</span>
    <h2 id="member-install-title">Seu cartão, na tela inicial.</h2>
    <p id="member-install-description">Adicione o app RKMED ao seu celular e tenha seu cartão e seus benefícios sempre à mão.</p>
    {!event && (ios ? <ol className="member-install-steps">
      <li><Share size={20} aria-hidden="true" /><span>No Safari, abra o menu <strong>Compartilhar</strong>. Se estiver em outro navegador, abra esta página no Safari.</span></li>
      <li><PlusSquare size={20} aria-hidden="true" /><span>Toque em <strong>Adicionar à Tela de Início</strong> e confirme em <strong>Adicionar</strong>.</span></li>
    </ol> : <div className="member-install-instructions"><MoreVertical size={20} aria-hidden="true" /><p>Abra o menu do navegador e procure <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</p></div>)}
    {error && <p role="alert" className="inline-error">{error}</p>}
    <div className="member-install-actions">
      {event && <Button disabled={busy} onClick={() => void install()}><Download size={18} />{busy ? 'Abrindo instalação…' : 'Instalar app RKMED'}</Button>}
      <Button variant="ghost" onClick={dismiss}>Agora não</Button>
    </div>
  </dialog>
}
