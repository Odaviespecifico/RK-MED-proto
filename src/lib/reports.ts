export type ReportFilter = { from: string; to: string; partnerId: string | null }
export type PurchaseReport = ReportFilter & {
  generatedAt: string
  totals: { recordedCount: number; validCount: number; reversedCount: number; grossCents: string; discountCents: string; finalCents: string }
}
export type PurchaseExport = ReportFilter & { generatedAt: string; rows: {
  id: string; memberName: string; cpf: string; partnerName: string; employee: string
  grossCents: string; discountCents: string; finalCents: string; createdAt: string; reversedAt: string | null
}[] }

export function decimalCents(value: string): string {
  if (!/^\d+$/.test(value)) throw new Error('Valor monetário inválido.')
  const cents = BigInt(value)
  return `${cents / 100n},${String(cents % 100n).padStart(2, '0')}`
}
export function reportMoney(value: string): string {
  const [integer, fraction] = decimalCents(value).split(',')
  return `R$ ${new Intl.NumberFormat('pt-BR').format(BigInt(integer))},${fraction}`
}
export function recifeDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find(p => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
function csvCell(input: string): string {
  // Human-readable export: dangerous prefixes become literal labeled text, not a formula.
  // Controls are flattened; NFKC is used only to detect full-width formula prefixes.
  let value = input.replace(/[\u0000-\u001f\u007f]/g, ' ')
  if (/^[=+\-@]/.test(value.normalize('NFKC').trimStart())) value = `Texto: ${value}`
  return `"${value.replace(/"/g, '""')}"`
}
export function purchasesCsv(report: PurchaseExport): string {
  const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
  const rows = [['Registro', 'Associado', 'CPF mascarado', 'Parceiro', 'Funcionário', 'Bruto (BRL)', 'Desconto (BRL)', 'Final (BRL)', 'Compra (Recife)', 'Estorno (Recife)', 'Situação']]
  for (const p of report.rows) {
    if (!/^\*{3}\.\*{3}\.\*{3}-\d{2}$/.test(p.cpf)) throw new Error('CPF não mascarado. Exportação interrompida.')
    rows.push([p.id, p.memberName, p.cpf, p.partnerName, p.employee, decimalCents(p.grossCents), decimalCents(p.discountCents), decimalCents(p.finalCents), date(p.createdAt), p.reversedAt ? date(p.reversedAt) : '', p.reversedAt ? 'Estornada' : 'Válida'])
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n'
}
