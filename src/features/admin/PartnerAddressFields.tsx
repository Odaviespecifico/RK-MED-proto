import type { FieldError } from '../../components/RegistrationErrors'
import { useEffect, useRef, useState } from 'react'

export type PartnerAddress = { street: string; number: string; complement: string; neighborhood: string; postalCode: string; city: string; state: string }
export const emptyPartnerAddress: PartnerAddress = { street: '', number: '', complement: '', neighborhood: '', postalCode: '', city: '', state: '' }

export function PartnerAddressFields({ value, onChange, disabled = false, errors }: { value: PartnerAddress; onChange: (value: PartnerAddress) => void; disabled?: boolean; errors?: FieldError[] }) {
  const latest = useRef({ value, onChange })
  latest.current = { value, onChange }
  const [lookup, setLookup] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const cep = value.postalCode.replace(/\D/g, '')
    if (cep.length !== 8) { setLookup(''); setLoading(false); return }
    const initial = value
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true); setLookup('')
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal })
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (data.erro) { setLookup('CEP não encontrado. Confira o número ou preencha o endereço manualmente.'); return }
        const current = latest.current.value
        if (current.postalCode.replace(/\D/g, '') !== cep) return
        latest.current.onChange({ ...current, street: current.street === initial.street ? (data.logradouro || current.street) : current.street, neighborhood: current.neighborhood === initial.neighborhood ? (data.bairro || current.neighborhood) : current.neighborhood, city: current.city === initial.city ? (data.localidade || current.city) : current.city, state: current.state === initial.state ? (data.uf || current.state) : current.state })
        setLookup('Endereço localizado. Revise os campos e complete o número.')
      } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setLookup('Consulta indisponível. Preencha o endereço manualmente.') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 400)
    return () => { window.clearTimeout(timer); controller.abort() }
  // The lookup is intentionally keyed only by CEP, to avoid repeating it while filling returned fields.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.postalCode])
  const field = (key: keyof PartnerAddress, label: string, required = false, maxLength = 160) => { const id = errors ? `partner-address-${key}` : undefined; const error = errors?.find(item => item.id === id); return <label className="field-label" key={key}>{label}{!required && ' (opcional)'}<input id={id} className="input" inputMode={key === 'postalCode' ? 'numeric' : undefined} autoComplete={key === 'postalCode' ? 'postal-code' : key === 'street' ? 'address-line1' : key === 'city' ? 'address-level2' : key === 'state' ? 'address-level1' : undefined} placeholder={key === 'postalCode' ? 'Ex.: 50000000' : undefined} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} value={value[key]} onChange={event => onChange({ ...value, [key]: key === 'postalCode' ? event.target.value.replace(/\D/g, '').slice(0, 8) : key === 'state' ? event.target.value.toUpperCase().slice(0, 2) : event.target.value })} required={required} maxLength={maxLength} disabled={disabled} />{error && <small id={`${id}-error`} className="field-error">{error.message}</small>}</label> }
  return <fieldset className="counter-flow" disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}><legend className="field-label">Endereço obrigatório</legend>{field('postalCode', 'CEP', true, 8)}{loading && <small role="status">Consultando CEP…</small>}{lookup && <small role="status">{lookup}</small>}{field('street', 'Rua / logradouro', true, 200)}{field('number', 'Número')}{field('complement', 'Complemento', false, 120)}{field('neighborhood', 'Bairro', true)}{field('city', 'Cidade', true)}{field('state', 'UF', true, 2)}</fieldset>
}
