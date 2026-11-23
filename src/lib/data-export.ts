import { decimalCents, recifeDate } from './reports.ts'
import { formatCnpj } from './format.ts'
import { wedeaStatusLabel } from './billing-metrics.ts'

export type ExportDataset = 'partners' | 'members' | 'financial'

export type ExportColumn = {
  key: string
  label: string
  defaultSelected: boolean
  format: (row: Record<string, unknown>) => string
}

export type DataExportPayload = {
  dataset: ExportDataset
  generatedAt: string
  from: string
  to: string
  rows: Record<string, unknown>[]
}

const recifeDateTime = (value: unknown) => {
  if (!value) return ''
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(String(value)))
}

const shortIsoDate = (value: unknown) => {
  if (!value) return ''
  const text = String(value)
  const parts = text.slice(0, 10).split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : text
}

const money = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '0,00'
  return decimalCents(String(value))
}

const boolLabel = (value: unknown) => (value ? 'Sim' : 'Não')

const billingStateLabel = (value: unknown) => {
  if (value === 'active') return 'Ativa'
  if (value === 'past_due') return 'Inadimplente'
  if (value === 'canceled') return 'Cancelada'
  return 'Incompleta'
}

const maskedCpf = (value: unknown) => {
  const text = String(value || '')
  if (!/^\*{3}\.\*{3}\.\*{3}-\d{2}$/.test(text)) throw new Error('CPF não mascarado. Exportação interrompida.')
  return text
}

export const EXPORT_DATASETS: Record<ExportDataset, { label: string; description: string; periodNote: string; filePrefix: string }> = {
  partners: {
    label: 'Parceiros',
    description: 'Estabelecimentos credenciados, descontos, contatos e movimento de compras no período.',
    periodNote: 'O período filtra o total de compras e descontos consolidados de cada estabelecimento.',
    filePrefix: 'rkmed-parceiros',
  },
  members: {
    label: 'Associados',
    description: 'Base de associados cadastrados no período, CPF mascarado, situação da assinatura e economia.',
    periodNote: 'O período filtra pela data de cadastro do associado (horário de Recife).',
    filePrefix: 'rkmed-associados',
  },
  financial: {
    label: 'Financeiro',
    description: 'Faturas de mensalidade pagas via Stripe, taxas operacionais e líquido RKMED.',
    periodNote: 'O período filtra pela data de confirmação do pagamento da fatura (horário de Recife).',
    filePrefix: 'rkmed-financeiro',
  },
}

export const EXPORT_COLUMNS: Record<ExportDataset, ExportColumn[]> = {
  partners: [
    { key: 'name', label: 'Nome do parceiro', defaultSelected: true, format: r => String(r.name || '') },
    { key: 'segment', label: 'Categoria', defaultSelected: true, format: r => String(r.segment || '') },
    { key: 'cnpj', label: 'CNPJ', defaultSelected: true, format: r => r.cnpj ? formatCnpj(String(r.cnpj)) : '' },
    { key: 'discountPercent', label: 'Desconto (%)', defaultSelected: true, format: r => `${Number(r.discountPercent ?? 0).toFixed(2).replace('.', ',')}%` },
    { key: 'active', label: 'Ativo', defaultSelected: true, format: r => boolLabel(r.active) },
    { key: 'purchasesCount', label: 'Compras no período', defaultSelected: true, format: r => String(r.purchasesCount ?? 0) },
    { key: 'grossCents', label: 'Valor bruto no período (BRL)', defaultSelected: true, format: r => money(r.grossCents) },
    { key: 'discountCents', label: 'Desconto no período (BRL)', defaultSelected: true, format: r => money(r.discountCents) },
    { key: 'address', label: 'Endereço completo', defaultSelected: false, format: r => String(r.address || '') },
    { key: 'city', label: 'Cidade', defaultSelected: false, format: r => String(r.city || '') },
    { key: 'state', label: 'UF', defaultSelected: false, format: r => String(r.state || '') },
    { key: 'phone', label: 'Telefone', defaultSelected: false, format: r => String(r.phone || '') },
    { key: 'email', label: 'E-mail de contato', defaultSelected: false, format: r => String(r.email || '') },
    { key: 'createdAt', label: 'Cadastro (Recife)', defaultSelected: false, format: r => recifeDateTime(r.createdAt) },
    { key: 'id', label: 'ID do parceiro', defaultSelected: false, format: r => String(r.id || '') },
  ],
  members: [
    { key: 'name', label: 'Nome do associado', defaultSelected: true, format: r => String(r.name || '') },
    { key: 'cpf', label: 'CPF mascarado', defaultSelected: true, format: r => maskedCpf(r.cpf) },
    { key: 'billingState', label: 'Situação da assinatura', defaultSelected: true, format: r => billingStateLabel(r.billingState) },
    { key: 'eligible', label: 'Benefício ativo', defaultSelected: true, format: r => boolLabel(r.eligible) },
    { key: 'paidThrough', label: 'Pago até (Recife)', defaultSelected: true, format: r => recifeDateTime(r.paidThrough) },
    { key: 'purchasesCount', label: 'Compras válidas', defaultSelected: true, format: r => String(r.purchasesCount ?? 0) },
    { key: 'savingsCents', label: 'Economia acumulada (BRL)', defaultSelected: true, format: r => money(r.savingsCents) },
    { key: 'joinedAt', label: 'Cadastro (Recife)', defaultSelected: true, format: r => recifeDateTime(r.joinedAt) },
    { key: 'birthDate', label: 'Data de nascimento', defaultSelected: false, format: r => shortIsoDate(r.birthDate) },
    { key: 'blocked', label: 'Bloqueio administrativo', defaultSelected: false, format: r => boolLabel(r.blocked) },
    { key: 'cancelAtPeriodEnd', label: 'Cancelamento agendado', defaultSelected: false, format: r => boolLabel(r.cancelAtPeriodEnd) },
    { key: 'id', label: 'ID do associado', defaultSelected: false, format: r => String(r.id || '') },
  ],
  financial: [
    { key: 'invoiceId', label: 'Fatura Stripe', defaultSelected: true, format: r => String(r.invoiceId || '') },
    { key: 'memberName', label: 'Associado', defaultSelected: true, format: r => String(r.memberName || '') },
    { key: 'cpf', label: 'CPF mascarado', defaultSelected: true, format: r => maskedCpf(r.cpf) },
    { key: 'paidAmountCents', label: 'Valor pago (BRL)', defaultSelected: true, format: r => money(r.paidAmountCents) },
    { key: 'operationalFeeCents', label: 'Taxa operacional (BRL)', defaultSelected: true, format: r => money(r.operationalFeeCents) },
    { key: 'netRkmedCents', label: 'Líquido RKMED (BRL)', defaultSelected: true, format: r => money(r.netRkmedCents) },
    { key: 'feeStatus', label: 'Situação da taxa', defaultSelected: true, format: r => wedeaStatusLabel(String(r.feeStatus || '')) },
    { key: 'createdAt', label: 'Pagamento (Recife)', defaultSelected: true, format: r => recifeDateTime(r.createdAt) },
    { key: 'activeMembersAtPayment', label: 'Pagantes ativos na data', defaultSelected: false, format: r => String(r.activeMembersAtPayment ?? 0) },
    { key: 'completedAt', label: 'Conclusão da taxa (Recife)', defaultSelected: false, format: r => recifeDateTime(r.completedAt) },
  ],
}

export function defaultSelectedFields(dataset: ExportDataset): string[] {
  return EXPORT_COLUMNS[dataset].filter(column => column.defaultSelected).map(column => column.key)
}

function safeCsvCell(input: string): string {
  let value = input.replace(/[\u0000-\u001f\u007f]/g, ' ')
  if (/^[=+\-@]/.test(value.normalize('NFKC').trimStart())) value = `Texto: ${value}`
  return `"${value.replace(/"/g, '""')}"`
}

export function buildDatasetCsv(dataset: ExportDataset, rows: readonly Record<string, unknown>[], selectedKeys: readonly string[]): string {
  const columns = EXPORT_COLUMNS[dataset].filter(column => selectedKeys.includes(column.key))
  if (!columns.length) throw new Error('Selecione ao menos um campo para incluir na planilha.')
  const lines = [columns.map(column => column.label)]
  for (const row of rows) {
    lines.push(columns.map(column => column.format(row)))
  }
  return '\uFEFF' + lines.map(line => line.map(safeCsvCell).join(';')).join('\r\n') + '\r\n'
}

export function periodRange(preset: 'month' | '30d' | '90d' | '365d', now = new Date()): { from: string; to: string } {
  const to = recifeDate(now)
  if (preset === 'month') return { from: `${to.slice(0, 8)}01`, to }
  const days = preset === '30d' ? 29 : preset === '90d' ? 89 : 364
  const start = new Date(now.getTime() - days * 86400000)
  return { from: recifeDate(start), to }
}
