export type Role = 'member' | 'partner' | 'admin' | 'viewer'
export type MemberStatus = 'active' | 'blocked' | 'canceled'
export type Member = {
  id: string
  name: string
  cpf: string
  email: string
  phone: string
  cardToken: string
  status: MemberStatus
  photo?: string
  joinedAt: string
  emailVerified: boolean
  phoneVerified: boolean
  paidThrough: string
}
export type Purchase = {
  id: string
  memberId: string
  partnerId: string
  employee: string
  grossCents: number
  discountCents: number
  finalCents: number
  createdAt: string
  reversedAt?: string
  reversedBy?: string
  reversalReason?: string
}
export type Partner = { id: string; name: string; segment: string; discount: number; address: string; initials: string; tone: string }
export type Employee = { id: string; name: string; partnerId: string; code: string; active: boolean }
export type CollectionLog = { id: string; memberId: string; action: 'link' | 'retry'; createdAt: string; actor: string; invoiceRef: string }
export type DemoState = { members: Member[]; purchases: Purchase[]; partners: Partner[]; employees: Employee[]; collectionLogs: CollectionLog[] }

export const DEMO_OTP = '123456'
export const DEMO_PASSWORD = 'demo123'
export const DEMO_EMPLOYEE_CODE = '2468'
export const LEGAL_WARNING = 'Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.'
export const demoPartners: Partner[] = [
  { id: 'vida', name: 'Laboratório Vida', segment: 'Laboratório', discount: 20, address: 'Rua da Matriz, 145 · Carpina, PE', initials: 'LV', tone: 'sage' },
  { id: 'movimento', name: 'Movimento Studio', segment: 'Academia', discount: 15, address: 'Av. Estácio Coimbra, 218 · Carpina, PE', initials: 'MS', tone: 'sand' },
  { id: 'essencial', name: 'Essencial Nutrition', segment: 'Suplementos', discount: 12, address: 'Rua São Sebastião, 82 · Carpina, PE', initials: 'EN', tone: 'rose' },
  { id: 'corpo', name: 'Corpo & Equilíbrio', segment: 'Academia', discount: 10, address: 'Praça do Comércio, 32 · Carpina, PE', initials: 'CE', tone: 'blue' },
]

const today = new Date()
const dateOffset = (days: number) => new Date(today.getTime() + days * 86400000).toISOString()
export const initialDemo: DemoState = {
  partners: demoPartners,
  employees: [{ id: 'employee-marina', name: 'Marina Costa', partnerId: 'vida', code: DEMO_EMPLOYEE_CODE, active: true }],
  collectionLogs: [],
  members: [
    { id: 'member-ana', name: 'Ana Paula Lima', cpf: '12345678909', email: 'ana@exemplo.com', phone: '81999990001', cardToken: 'RKMED-GOLD-ANA-8F4D7C2A', status: 'active', photo: '/demo-ana.webp', joinedAt: dateOffset(-65), emailVerified: true, phoneVerified: true, paidThrough: dateOffset(25) },
    { id: 'member-carlos', name: 'Carlos Henrique Silva', cpf: '98765432100', email: 'carlos@exemplo.com', phone: '81999990002', cardToken: 'RKMED-GOLD-CARLOS-3A9B6E1F', status: 'blocked', joinedAt: dateOffset(-48), emailVerified: true, phoneVerified: true, paidThrough: dateOffset(-3) },
  ],
  purchases: [
    { id: 'purchase-1', memberId: 'member-ana', partnerId: 'vida', employee: 'Marina Costa', grossCents: 24000, discountCents: 4800, finalCents: 19200, createdAt: dateOffset(-5) },
    { id: 'purchase-2', memberId: 'member-ana', partnerId: 'movimento', employee: 'Marina Costa', grossCents: 18000, discountCents: 2700, finalCents: 15300, createdAt: dateOffset(-23) },
  ],
}

const DATA_KEY = 'rkmed-prototype-data-v1'
export function loadDemo(): DemoState {
  try {
    const stored = localStorage.getItem(DATA_KEY)
    if (!stored) return initialDemo
    const parsed = JSON.parse(stored) as Partial<DemoState>
    return { ...initialDemo, ...parsed, members: (parsed.members ?? initialDemo.members).map(member => member.id === 'member-ana' && !member.photo ? { ...member, photo: '/demo-ana.webp' } : member), employees: parsed.employees ?? initialDemo.employees, collectionLogs: parsed.collectionLogs ?? [] }
  } catch { return initialDemo }
}
export function saveDemo(state: DemoState) {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(state)) } catch { /* storage unavailable */ }
}
export function resetDemo() { localStorage.removeItem(DATA_KEY) }
export function brl(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100) }
export function shortDate(iso: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) }
export function maskedCpf(cpf: string) { return `***.***.***-${cpf.slice(-2)}` }
export function onlyDigits(value: string) { return value.replace(/\D/g, '') }
export function validCpf(value: string) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  const digit = (length: number) => {
    const sum = Array.from(cpf.slice(0, length)).reduce((acc, v, i) => acc + Number(v) * (length + 1 - i), 0)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}
export function isAdult(date: string) {
  const birth = new Date(`${date}T12:00:00`)
  if (!Number.isFinite(birth.getTime())) return false
  const now = new Date()
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
  return birth <= cutoff
}
export function statusLabel(status: MemberStatus) { return status === 'active' ? 'Ativo' : status === 'blocked' ? 'Bloqueado' : 'Cancelado' }
export function isEligible(member: Member) { return member.status === 'active' && new Date(member.paidThrough).getTime() > Date.now() }
export function calculateDiscount(grossCents: number, percent: number) {
  const discountCents = Math.round(grossCents * percent / 100)
  return { discountCents, finalCents: grossCents - discountCents }
}
export function memberSavings(memberId: string, purchases: Purchase[]) { return purchases.filter(p => p.memberId === memberId && !p.reversedAt).reduce((sum, p) => sum + p.discountCents, 0) }
