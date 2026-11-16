import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

export type FieldError = { id: string; label: string; message: string }
export function useRegistrationErrors() {
  const [errors, setErrors] = useState<FieldError[]>([])
  function onInvalid(event: FormEvent<HTMLFormElement>) {
    const fields = [...event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:invalid, select:invalid, textarea:invalid')]
    setErrors(fields.map((field, index) => {
      if (!field.id) field.id = `registration-invalid-${index}`
      const label = field.labels?.[0]?.firstChild?.textContent?.trim() || field.getAttribute('aria-label') || 'Campo obrigatório'
      const validity = field.validity
      const message = validity.valueMissing ? 'Preencha este campo.' : validity.typeMismatch ? 'Informe um valor no formato correto.' : validity.tooShort ? `Use pelo menos ${field.getAttribute('minlength')} caracteres.` : validity.tooLong ? `Use no máximo ${field.getAttribute('maxlength')} caracteres.` : validity.rangeUnderflow || validity.rangeOverflow || validity.stepMismatch || validity.badInput ? 'Informe um valor dentro do intervalo permitido.' : 'Confira este campo.'
      return { id: field.id, label, message }
    }))
  }
  return { errors, onInvalid, clear: () => setErrors([]) }
}
export function RegistrationErrors({ errors }: { errors: FieldError[] }) {
  const summary = useRef<HTMLDivElement>(null)
  useEffect(() => { if (errors.length) summary.current?.focus() }, [errors])
  if (!errors.length) return null
  return <div ref={summary} tabIndex={-1} role="alert" className="inline-error"><p>Confira os campos destacados para continuar:</p><ul>{errors.map(error => <li key={error.id}><a href={`#${error.id}`} onClick={event => { event.preventDefault(); document.getElementById(error.id)?.focus() }}>{error.label}: {error.message}</a></li>)}</ul></div>
}
