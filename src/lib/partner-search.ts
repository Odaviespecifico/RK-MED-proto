import { formatCnpj } from './format.ts'

export type ComboboxPartner = {
  id: string
  name: string
  cnpj?: string | null
  segment?: string
  active?: boolean
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

export function matchesPartnerQuery(partner: ComboboxPartner, rawQuery: string) {
  const query = rawQuery.trim()
  if (!query) return true
  const normalized = normalizeText(query)
  if (normalizeText(partner.name).includes(normalized)) return true
  if (partner.segment && normalizeText(partner.segment).includes(normalized)) return true
  const docQuery = query.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (docQuery && partner.cnpj && partner.cnpj.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(docQuery)) return true
  return false
}

export function formatPartnerOptionLabel(partner: ComboboxPartner) {
  const parts = [partner.name]
  if (partner.cnpj) parts.push(formatCnpj(partner.cnpj))
  if (partner.active === false) parts.push('(inativo)')
  return parts.join(' · ')
}
