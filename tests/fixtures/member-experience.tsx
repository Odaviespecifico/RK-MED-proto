import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ConnectedEnrollment } from '../../src/features/auth/ConnectedEnrollment'
import { MemberLogin } from '../../src/features/auth/MemberLogin'
import { createMemberAuth } from '../../src/integrations/auth'
import type { Portal, PortalContext } from '../../src/integrations/portal'
import type { SupabaseClient } from '@supabase/supabase-js'
import '../../src/styles.css'
import '../../src/redesign.css'

const query = new URLSearchParams(location.search)
const events: Record<string, unknown>[] = []
let checkoutRequests = 0
Object.assign(window, { experienceEvents: events })
let user: { id: string; email: string; email_confirmed_at?: string; phone_confirmed_at?: string } | null = null
let current: PortalContext | null = query.get('flow') === 'payment' ? { userId: 'fixture', role: 'member', member: { id: 'fixture', photoPath: 'fixture/photo.jpg', billingState: query.get('state') || 'incomplete', eligible: query.get('state') === 'active' } as PortalContext['member'] } : null
if (current) user = { id: 'fixture', email: 'member@example.invalid', email_confirmed_at: 'confirmed', phone_confirmed_at: 'confirmed' }
const client = {
  auth: { getUser: async () => ({ data: { user } }), setSession: async () => ({ data: { user }, error: null }), getSession: async () => ({ data: { session: { user: { id: 'fixture' } } }, error: null }) },
  functions: { invoke: async (_name: string, { body }: { body: Record<string, string> }) => {
    events.push(body)
    if (body.action === 'request' && (window as unknown as { failNextSend?: boolean }).failNextSend) {
      Object.assign(window, { failNextSend: false })
      return { data: { error: 'Não foi possível confirmar o envio. Aguarde antes de solicitar outro código.' }, error: null }
    }
    if (body.action === 'checkout') {
      checkoutRequests++
      if (query.get('checkoutError') && checkoutRequests === 1) return { data: { error: query.get('checkoutError') === 'expired' ? 'Checkout expirado. Tente novamente para iniciar uma nova operação.' : 'Pagamento em processamento. Aguarde a confirmação.' }, error: null }
      await new Promise(resolve => setTimeout(resolve, 1000))
      return { data: { url: 'https://checkout.stripe.com/c/pay/synthetic', livemode: false }, error: null }
    }
    if (body.action === 'request') return { data: { challengeId: crypto.randomUUID() }, error: null }
    if (body.token !== '123456') return { data: { error: 'Código inválido, expirado ou já utilizado. Solicite outro código.' }, error: null }
    if (body.purpose === 'signup') { user = { id: 'fixture', email: body.contact, email_confirmed_at: 'confirmed' }; current = { userId: 'fixture', role: 'pending' } }
    if (body.purpose === 'attach' && user) user.phone_confirmed_at = 'confirmed'
    if (body.purpose === 'login') user = { id: 'fixture', email: body.contact }
    return { data: { userId: 'fixture', verified: true, session: { access_token: 'synthetic', refresh_token: 'synthetic' } }, error: null }
  } },
} as unknown as SupabaseClient
const api = {
  documents: async () => ['terms', 'privacy', 'photo'].map(kind => ({ kind, version: `mock-${kind}`, content: 'Documento sintético para teste.' })),
  context: async () => current,
  enroll: async (name: string, cpf: string, birth: string, versions: string[]) => {
    if (!user?.email_confirmed_at || !user.phone_confirmed_at) throw new Error('Confirme os dois contatos')
    if ((window as unknown as { failNextEnroll?: boolean }).failNextEnroll) { Object.assign(window, { failNextEnroll: false }); throw new Error('Falha sintética ao salvar cadastro') }
    events.push({ enrollment: { name, cpf, birth, versions } }); current = { userId: 'fixture', role: 'member', member: { id: 'fixture', photoPath: null, billingState: 'incomplete', eligible: false } as PortalContext['member'] } },
  command: async (name: string) => { if (name === 'photo' && current?.member) current.member.photoPath = 'fixture/photo.jpg'; return {} },
} as unknown as Portal
function Preview() {
  const [context, setContext] = useState(current)
  const go = (path: string) => { history.pushState({}, '', path + (query.get('flow') === 'payment' ? `?${query}` : '')); events.push({ navigation: path }) }
  const refresh = async () => setContext(current ? { ...current } : null)
  return query.get('flow') === 'login' ? <MemberLogin auth={createMemberAuth(client)} go={go} online onAuthenticated={() => events.push({ authenticated: true })} /> : <ConnectedEnrollment client={client} api={api} context={context} go={go} refresh={refresh} online />
}
createRoot(document.getElementById('root')!).render(<Preview />)
