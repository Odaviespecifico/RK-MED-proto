import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Menu, X } from 'lucide-react'

export function WorkspaceSidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const navigationRef = useDialogFocus<HTMLElement>(open, () => setOpen(false))
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const breakpoint = window.matchMedia('(min-width: 801px)')
    const closeOnDesktop = () => { if (breakpoint.matches) setOpen(false) }
    breakpoint.addEventListener('change', closeOnDesktop)
    return () => { document.body.style.overflow = previous; breakpoint.removeEventListener('change', closeOnDesktop) }
  }, [open])
  return <>
    <button className="workspace-menu-toggle" aria-label="Abrir navegação" aria-expanded={open} aria-controls="workspace-navigation" onClick={() => setOpen(true)}><Menu size={22} /></button>
    {open && <div className="workspace-menu-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
    <aside id="workspace-navigation" className={`workspace-sidebar${open ? ' mobile-open' : ''}`} ref={navigationRef} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label="Navegação do painel" tabIndex={-1} onClick={event => { if ((event.target as HTMLElement).closest('nav button, .workspace-sidebar-bottom > button')) setOpen(false) }}>
      <button className="workspace-menu-close" aria-label="Fechar navegação" onClick={() => setOpen(false)}><X size={22} /></button>
      {children}
    </aside>
  </>
}

export function useDialogFocus<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!open || !ref.current) return
    const dialog = ref.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
    ;(focusables()[0] ?? dialog).focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) { event.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus() }
  }, [open])
  return ref
}

