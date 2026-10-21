import type { SupabaseClient } from '@supabase/supabase-js'
import type { PublicPartner } from './contracts'
import type { PurchaseExport, PurchaseReport, ReportFilter } from '../lib/reports'
import { watchOperations, type OperationalSummary, type OperationalConnection } from './operational.ts'
import type { CursorPage, PageCursor } from '../lib/pagination'

export class PortalConnectionError extends Error {}
export type PortalMember = { id: string; name: string; cpf: string; photoPath: string | null; cardToken: string; eligible: boolean; blocked: boolean; paidThrough: string | null; billingState: string; cancelAtPeriodEnd: boolean; joinedAt: string }
export type PortalContext = { userId: string; role: 'pending' | 'member' | 'partner' | 'admin' | 'support' | 'viewer'; partnerId?: string; member?: PortalMember; workSession?: { employeeId: string; employeeName: string; partnerId: string } }
export type PortalPurchase = { id: string; memberId: string; memberName: string; partnerId: string; partnerName: string; employee: string; grossCents: number; discountCents: number; finalCents: number; createdAt: string; reversedAt: string | null }
export type AdminMember = Pick<PortalMember, 'id' | 'name' | 'cpf' | 'eligible' | 'blocked' | 'billingState' | 'paidThrough' | 'joinedAt'> & { email: string | null; phone: string | null; invoiceId: string | null; amountDue: number | null; savingsCents: string }
export type PortalEmployee = { id: string; name: string; partnerId: string; active: boolean }
export type Validation = { found: boolean; id?: string; name?: string; photoPath?: string; cpf?: string; eligible?: boolean; receipt?: string }
export type Quote = { grossCents: number; discountBps: number; discountCents: number; finalCents: number }

export function portal(client: SupabaseClient) {
  async function rpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
    const { data, error, status } = await client.rpc(name, params)
    if (error && status === 0) throw new PortalConnectionError('Conexão indisponível. Tentaremos atualizar quando ela voltar.')
    if (error) throw new Error(error.code === 'P0001' || error.code === '42501' ? error.message : error.code === '23505' ? 'Registro já existente. Atualize os dados antes de tentar novamente.' : 'Não foi possível concluir a operação. Tente novamente.')
    if (data?.error) throw new Error(String(data.error))
    return data as T
  }
  return {
    context: () => rpc<PortalContext>('rk_context'),
    operationalSummary: () => rpc<OperationalSummary>('rk_operational_summary'),
    watchOperations: (changed: () => void, state: (value: OperationalConnection) => void) => watchOperations(client, changed, state),
    staffPartners: () => rpc<(PublicPartner & { active: boolean })[]>('rk_staff_partners'),
    report: (filter: ReportFilter) => rpc<PurchaseReport>('rk_report', { p_from: filter.from, p_to: filter.to, p_partner: filter.partnerId }),
    exportPurchases: (filter: ReportFilter) => rpc<PurchaseExport>('rk_export_purchases', { p_from: filter.from, p_to: filter.to, p_partner: filter.partnerId }),
    partners: () => rpc<PublicPartner[]>('rk_partners'),
    purchasesPage: (cursor: PageCursor | null = null, savings = false) => rpc<CursorPage<PortalPurchase>>('rk_purchases_page', { p_at: cursor?.at || null, p_id: cursor?.id || null, p_savings: savings }),
    membersPage: (cursor: PageCursor | null = null, query = '', pastDue = false) => rpc<CursorPage<AdminMember>>('rk_members_page', { p_at: cursor?.at || null, p_id: cursor?.id || null, p_query: query, p_past_due: pastDue }),
    queue: () => rpc<{ id: string; memberName: string; kind: string; status: string; attempts: number; createdAt: string }[]>('rk_delivery_queue'),
    employees: () => rpc<PortalEmployee[]>('rk_employees'),
    startWork: (code: string) => rpc<PortalContext>('rk_start_work', { p_code: code }),
    endWork: () => rpc<void>('rk_end_work'),
    validate: (lookup: string, method: 'qr' | 'cpf') => rpc<Validation>('rk_validate_member', { p_lookup: lookup, p_method: method }),
    quote: (receipt: string, gross: number) => rpc<Quote>('rk_quote', { p_receipt: receipt, p_gross: gross }),
    commit: (receipt: string, quote: Quote, operation: string) => rpc<{ id: string; duplicate: boolean }>('rk_commit_purchase', { p_receipt: receipt, p_gross: quote.grossCents, p_quote_bps: quote.discountBps, p_operation: operation }),
    reverse: (purchase: string, reason: string) => rpc<string>('rk_reverse_purchase', { p_purchase: purchase, p_reason: reason }),
    block: (member: string, blocked: boolean, reason: string) => rpc<void>('rk_set_block', { p_member: member, p_blocked: blocked, p_reason: reason }),
    savePartner: (partner: { name: string; segment: string; address: string; discountBps: number; id?: string; active?: boolean }) => rpc<string>('rk_save_partner', { p_name: partner.name, p_segment: partner.segment, p_address: partner.address, p_discount_bps: partner.discountBps, p_id: partner.id || null, p_active: partner.active ?? true }),
    saveEmployee: (employee: { name: string; partnerId: string; code: string; id?: string; active?: boolean }) => rpc<string>('rk_save_employee', { p_name: employee.name, p_partner: employee.partnerId, p_code: employee.code, p_id: employee.id || null, p_active: employee.active ?? true }),
    documents: () => rpc<{ version: string; kind: string; content: string; testOnly: boolean }[]>('rk_documents'),
    enroll: (name: string, cpf: string, birth: string, versions: string[]) => rpc<string>('rk_enroll', { p_name: name, p_cpf: cpf, p_birth: birth, p_versions: versions }),
    async photo(path: string | null) {
      if (!path) return null
      const { data, error } = await client.storage.from('member-photos').createSignedUrl(path, 60)
      if (error || !data) return null
      return data.signedUrl
    },
    async command<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
      const { data, error } = await client.functions.invoke('rkmed-api', { body: { action, ...body } })
      if (error || data?.error) {
        let message = data?.error
        if (!message && error && 'context' in error && error.context instanceof Response) { try { message = (await error.context.json()).error } catch {} }
        throw new Error(typeof message === 'string' && message.length < 200 ? message : 'Integração indisponível. Confira a configuração do ambiente de testes.')
      }
      return data as T
    },
  }
}
export type Portal = ReturnType<typeof portal>
