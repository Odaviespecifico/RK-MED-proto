import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { formatCnpj } from '../lib/format.ts'
import { formatPartnerOptionLabel, matchesPartnerQuery, type ComboboxPartner } from '../lib/partner-search.ts'

export function PartnerCombobox({
  id,
  partners,
  value,
  onChange,
  disabled = false,
  required = false,
  invalid = false,
  describedBy,
  placeholder = 'Digite o nome ou CNPJ do estabelecimento',
}: {
  id: string
  partners: ComboboxPartner[]
  value: string
  onChange: (partnerId: string) => void
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  describedBy?: string
  placeholder?: string
}) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = useMemo(() => partners.find(partner => partner.id === value) || null, [partners, value])
  const [query, setQuery] = useState(selected ? formatPartnerOptionLabel(selected) : '')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  useEffect(() => {
    if (!open) setQuery(selected ? formatPartnerOptionLabel(selected) : '')
  }, [selected, open])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.setCustomValidity(required && !value ? 'Selecione um estabelecimento da lista.' : '')
  }, [required, value])

  const filtered = useMemo(() => {
    if (!open) return partners
    if (selected && query === formatPartnerOptionLabel(selected)) return partners
    return partners.filter(partner => matchesPartnerQuery(partner, query))
  }, [partners, query, open, selected])

  useEffect(() => {
    setHighlighted(0)
  }, [query, open])

  function selectPartner(partner: ComboboxPartner) {
    onChange(partner.id)
    setQuery(formatPartnerOptionLabel(partner))
    setOpen(false)
  }

  function clear() {
    onChange('')
    setQuery('')
    setOpen(true)
    inputRef.current?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) { setOpen(true); return }
      setHighlighted(index => Math.min(filtered.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted(index => Math.max(0, index - 1))
    } else if (event.key === 'Enter' && open) {
      if (filtered[highlighted]) {
        event.preventDefault()
        selectPartner(filtered[highlighted])
      }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      setQuery(selected ? formatPartnerOptionLabel(selected) : '')
    }
  }

  return <div className="partner-combobox" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false)
      setQuery(selected ? formatPartnerOptionLabel(selected) : '')
    }
  }}>
    <div className="partner-combobox-control">
      <Search size={16} className="partner-combobox-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="input partner-combobox-input"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={event => {
          const next = event.target.value
          setQuery(next)
          setOpen(true)
          if (value) onChange('')
        }}
        onKeyDown={handleKeyDown}
      />
      {(query || value) && !disabled && <button type="button" className="partner-combobox-clear" aria-label="Limpar estabelecimento" onMouseDown={event => event.preventDefault()} onClick={clear}><X size={15} aria-hidden="true" /></button>}
      <button type="button" className="partner-combobox-toggle" aria-label={open ? 'Fechar lista de estabelecimentos' : 'Abrir lista de estabelecimentos'} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => { setOpen(current => !current); inputRef.current?.focus() }}><ChevronDown size={16} aria-hidden="true" /></button>
    </div>
    {open && !disabled && <ul id={listId} role="listbox" className="partner-combobox-list" aria-label="Estabelecimentos encontrados">
      {filtered.length ? filtered.map((partner, index) => <li
        key={partner.id}
        role="option"
        aria-selected={partner.id === value}
        className={index === highlighted ? 'partner-combobox-option active' : 'partner-combobox-option'}
        onMouseDown={event => { event.preventDefault(); selectPartner(partner) }}
        onMouseEnter={() => setHighlighted(index)}
      >
        <strong>{partner.name}{partner.active === false ? ' (inativo)' : ''}</strong>
        <small>{[partner.cnpj ? formatCnpj(partner.cnpj) : 'CNPJ não informado', partner.segment].filter(Boolean).join(' · ')}</small>
      </li>) : <li className="partner-combobox-empty" role="status">Nenhum estabelecimento encontrado para “{query}”.</li>}
    </ul>}
  </div>
}
