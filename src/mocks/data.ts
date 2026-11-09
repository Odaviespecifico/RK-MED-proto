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
  employeeId?: string
  grossCents: number
  discountCents: number
  finalCents: number
  createdAt: string
  reversedAt?: string
  reversedBy?: string
  reversalReason?: string
}
export type Partner = import('../integrations/contracts').PublicPartner & { establishmentCode?: string }
export type Employee = { id: string; name: string; partnerId: string; code: string; active: boolean }
export type CollectionLog = { id: string; memberId: string; action: 'link' | 'retry'; createdAt: string; actor: string; invoiceRef: string }
export type DemoState = { members: Member[]; purchases: Purchase[]; partners: Partner[]; employees: Employee[]; collectionLogs: CollectionLog[] }
export type WorkSession = { employeeId: string; partnerId: string }

export function activeWorkAssignment(state: Pick<DemoState, 'partners' | 'employees'>, session: WorkSession | null) {
  if (!session) return null
  const partner = state.partners.find(item => item.id === session.partnerId)
  const employee = state.employees.find(item => item.id === session.employeeId && item.active && item.partnerId === session.partnerId)
  return partner && employee ? { partner, employee } : null
}

export const DEMO_OTP = '123456'
export const DEMO_PASSWORD = 'demo123'
export const DEMO_EMPLOYEE_CODE = '2468'
export const LEGAL_WARNING = 'Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.'
export const demoPartners: Partner[] = [
  { id: 'vida', establishmentCode: 'RKMED00001', name: 'Laboratório Vida', segment: 'Laboratório', discount: 20, address: 'Rua da Matriz, 145 · Carpina, PE', initials: 'LV', tone: 'sage' },
  { id: 'movimento', establishmentCode: 'RKMED00002', name: 'Movimento Studio', segment: 'Academia', discount: 15, address: 'Av. Estácio Coimbra, 218 · Carpina, PE', initials: 'MS', tone: 'sand' },
  { id: 'essencial', establishmentCode: 'RKMED00003', name: 'Essencial Nutrition', segment: 'Suplementos', discount: 12, address: 'Rua São Sebastião, 82 · Carpina, PE', initials: 'EN', tone: 'rose' },
  { id: 'corpo', establishmentCode: 'RKMED00004', name: 'Corpo & Equilíbrio', segment: 'Academia', discount: 10, address: 'Praça do Comércio, 32 · Carpina, PE', initials: 'CE', tone: 'blue' },
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
    return { ...initialDemo, ...parsed, partners: (parsed.partners ?? initialDemo.partners).map(partner => ({ ...partner, establishmentCode: partner.establishmentCode || demoPartners.find(item => item.id === partner.id)?.establishmentCode || crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase() })), members: (parsed.members ?? initialDemo.members).map(member => member.id === 'member-ana' && !member.photo ? { ...member, photo: '/demo-ana.webp' } : member), employees: parsed.employees ?? initialDemo.employees, collectionLogs: parsed.collectionLogs ?? [] }
  } catch { return initialDemo }
}
export function saveDemo(state: DemoState) {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(state)) } catch { /* storage unavailable */ }
}
export function resetDemo() { localStorage.removeItem(DATA_KEY) }
export function statusLabel(status: MemberStatus) { return status === 'active' ? 'Ativo' : status === 'blocked' ? 'Bloqueado' : 'Cancelado' }
export function isEligible(member: Member) { return member.status === 'active' && new Date(member.paidThrough).getTime() > Date.now() }
export function calculateDiscount(grossCents: number, percent: number) {
  const discountCents = Math.round(grossCents * percent / 100)
  return { discountCents, finalCents: grossCents - discountCents }
}
export function memberSavings(memberId: string, purchases: Purchase[]) { return purchases.filter(p => p.memberId === memberId && !p.reversedAt).reduce((sum, p) => sum + p.discountCents, 0) }
