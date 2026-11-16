import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from './ui/button'

export function RegistrationDialog({ title, description, step, steps, stepDescriptions, onClose, busy, children }: {
  title: string; description: string; step: number; steps: readonly string[]; stepDescriptions: readonly string[]; onClose: () => void; busy: boolean; children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const id = useId()
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (element && !element.open) element.showModal()
    return () => { if (element?.open) element.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  useEffect(() => { heading.current?.focus() }, [step])
  return <dialog ref={dialog} className="registration-dialog" aria-modal="true" aria-labelledby={id} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onKeyDown={event => {
    if (event.key !== 'Tab') return
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length > 0)
    if (!focusable.length) { event.preventDefault(); heading.current?.focus(); return }
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current || !event.currentTarget.contains(document.activeElement))) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }}>
    <div className="registration-dialog-shell">
      <header className="registration-dialog-header"><div><span className="registration-eyebrow">RKMED · Novo cadastro</span><h2 id={id}>{title}</h2><p id={`${id}-description`}>{description}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Fechar e descartar cadastro" disabled={busy} onClick={onClose}><X size={20} aria-hidden="true" /></Button></header>
      <ol className="registration-steps" aria-label={`Etapas do cadastro · Etapa ${step + 1} de ${steps.length}`}>{steps.map((name, index) => <li key={name} data-state={index < step ? 'complete' : index === step ? 'current' : 'pending'} aria-current={index === step ? 'step' : undefined}><span className="registration-step-number" aria-hidden="true">{index < step ? <Check size={16} /> : index + 1}</span><span className="registration-step-label"><span className="sr-only">{index < step ? 'Concluída: ' : index === step ? 'Atual: ' : 'Pendente: '}</span>{name}</span></li>)}</ol>
      <div key={step} className="registration-dialog-body"><div className="registration-step-heading"><h3 ref={heading} tabIndex={-1}>{steps[step]}</h3><p>{stepDescriptions[step]}</p></div>{children}</div>
      <p className="registration-discard-note">Fechar ou cancelar descarta o preenchimento.</p>
    </div>
  </dialog>
}
