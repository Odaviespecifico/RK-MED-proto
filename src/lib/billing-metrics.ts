export type BillingMonthPoint = {
  month: string
  invoices: number
  grossCents: string
  wedeaCents: string
  netCents: string
}

export type BillingStatusBreakdown = {
  active: number
  canceling: number
  pastDue: number
  canceled: number
  incomplete: number
  blocked: number
}

export type BillingDonutSegment = {
  key: string
  label: string
  count: number
  percent: number
  color: string
  dashArray: string
  dashOffset: number
}

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function shortMonthLabel(ym: string) {
  const [year, month] = ym.split('-')
  const index = Number(month) - 1
  if (!year || !Number.isInteger(index) || index < 0 || index > 11) return ym
  return `${MONTHS_PT[index]}/${year.slice(-2)}`
}

export function centsValue(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildRevenueBars(series: readonly BillingMonthPoint[]) {
  const maxCents = Math.max(1, ...series.map(point => centsValue(point.grossCents)))
  return series.map(point => {
    const gross = centsValue(point.grossCents)
    const wedea = Math.min(gross, Math.max(0, centsValue(point.wedeaCents)))
    const net = Math.max(0, gross - wedea)
    return {
      ...point,
      label: shortMonthLabel(point.month),
      grossPct: Math.round((gross / maxCents) * 1000) / 10,
      netPct: Math.round((net / maxCents) * 1000) / 10,
      wedeaPct: Math.round((wedea / maxCents) * 1000) / 10,
    }
  })
}

export function buildStatusDonut(breakdown: BillingStatusBreakdown, radius = 58): { total: number; segments: BillingDonutSegment[] } {
  const raw = [
    { key: 'active', label: 'Ativas em dia', count: breakdown.active, color: '#4d6b56' },
    { key: 'canceling', label: 'Cancelamento agendado', count: breakdown.canceling, color: '#b08b4f' },
    { key: 'pastDue', label: 'Inadimplentes', count: breakdown.pastDue, color: '#9f2525' },
    { key: 'canceled', label: 'Canceladas', count: breakdown.canceled, color: '#8f8a80' },
    { key: 'incomplete', label: 'Incompletas', count: breakdown.incomplete, color: '#c8bead' },
  ]
  const total = raw.reduce((sum, item) => sum + Math.max(0, item.count), 0)
  const circumference = 2 * Math.PI * radius
  let consumed = 0
  const segments = raw.map(item => {
    const count = Math.max(0, item.count)
    const ratio = total > 0 ? count / total : 0
    const length = ratio * circumference
    const offset = -consumed
    consumed += length
    return {
      key: item.key,
      label: item.label,
      count,
      percent: total > 0 ? Math.round(ratio * 1000) / 10 : 0,
      color: item.color,
      dashArray: `${length.toFixed(2)} ${circumference.toFixed(2)}`,
      dashOffset: Number(offset.toFixed(2)),
    }
  })
  return { total, segments }
}

export function wedeaProgress(activePayingMembers: number, threshold = 200) {
  const target = threshold + 1
  const active = Math.max(0, Math.floor(activePayingMembers))
  const eligible = active > threshold
  const percent = Math.min(100, Math.round((active / target) * 1000) / 10)
  const remaining = Math.max(0, target - active)
  return { active, target, eligible, percent, remaining }
}

export function wedeaStatusLabel(status: string) {
  if (status === 'sent') return 'Taxa processada'
  if (status === 'pending' || status === 'sending') return 'Taxa pendente'
  if (status === 'review') return 'Em revisão'
  return 'Isenta (≤ 200 ativos)'
}
