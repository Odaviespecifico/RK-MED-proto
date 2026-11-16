import { useEffect, useState } from 'react'
import { clearRegistrationDraft, draftKey, readRegistrationDraft, saveRegistrationDraft } from './registration-draft'

type Values = Record<string, string | boolean>

// Writes synchronously on each edit, so closing cannot race a pending debounce.
export function useRegistrationDraft<T extends Values>(userId: string, kind: 'partner' | 'staff', initial: T, allowed: readonly string[], maxStep: number) {
  const scope = `${import.meta.env.VITE_SUPABASE_PROJECT_REF || 'local'}:${userId}`
  const key = draftKey(scope, kind)
  const [restored] = useState(() => {
    const value = readRegistrationDraft(key, allowed, maxStep)
    if (value && Object.entries(value.fields).some(([name, entry]) => typeof entry !== typeof initial[name])) { clearRegistrationDraft(key); return null }
    return value
  })
  const [fields, setFields] = useState<T>(() => ({ ...initial, ...restored?.fields }))
  const [step, setStep] = useState(restored?.step ?? 0)
  const [open, setOpen] = useState(!!restored)
  const [recovered, setRecovered] = useState(!!restored)
  const [storage, setStorage] = useState<'saved' | 'unavailable' | null>(null)
  function persist(nextFields: T, nextStep: number) {
    setStorage(saveRegistrationDraft(key, nextStep, nextFields, allowed) ? 'saved' : 'unavailable')
  }
  function update(next: T) { setFields(next); persist(next, step) }
  function changeStep(next: number) { setStep(next); persist(fields, next) }
  function discard() { clearRegistrationDraft(key); setOpen(false); setFields(initial); setStep(0); setRecovered(false); setStorage(null) }
  function start() { setFields(initial); setStep(0); setRecovered(false); setStorage(null); setOpen(true) }
  useEffect(() => {
    const onNavigation = () => { clearRegistrationDraft(key); setOpen(false); setRecovered(false); setStorage(null) }
    window.addEventListener('rkmed:internal-navigation', onNavigation)
    return () => window.removeEventListener('rkmed:internal-navigation', onNavigation)
  }, [key])
  return { fields, step, open, recovered, storage, update, changeStep, discard, start }
}
