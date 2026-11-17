import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Portal, PortalContext } from '../../integrations/portal'
import { createBilling } from '../../integrations/billing'
import { Button } from '../../components/ui/button'
import { brl } from '../../lib/format'
import { goldPlan } from '../../lib/member-experience'

export function EnrollmentPayment({ client, api, context, refresh, online, go }: { client: SupabaseClient; api: Portal; context: PortalContext | null; refresh: () => Promise<void>; online: boolean; go: (path: string) => void }) {
  const [member, setMember] = useState(context?.member)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const working = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const operation = useRef(crypto.randomUUID())
  const returned = new URLSearchParams(location.search).get('checkout')
  useEffect(() => { setMember(context?.member) }, [context?.member])
  useEffect(() => { heading.current?.focus() }, [])
  async function check() {
    setChecking(true); setError('')
    try { const current = await api.context(); setMember(current.member); await refresh() }
    catch { setError('Não foi possível atualizar o pagamento. Conecte-se e tente novamente.') }
    finally { setChecking(false) }
  }
  useEffect(() => {
    if (!online || !(returned === 'processing' || processing) || member?.eligible) return
    let active = true, running = false
    const update = async () => {
      if (running) return
      running = true
      try { const current = await api.context(); if (active) { setMember(current.member); setError('') } }
      catch { if (active) setError('Ainda não foi possível consultar a confirmação. Atualize o status em instantes.') }
      finally { running = false }
    }
    void update(); const timer = window.setInterval(() => void update(), 5000)
    return () => { active = false; clearInterval(timer) }
  }, [api, online, returned, processing, member?.eligible])
  async function openArea() {
    if (working.current || !online) return
    working.current = true; setChecking(true)
    try { await refresh(); go(needsAttention ? '/app/assinatura' : '/app') }
    catch { setError('Não foi possível abrir sua área. Atualize o status e tente novamente.') }
    finally { working.current = false; setChecking(false) }
  }
  async function pay() {
    if (!online || working.current) return
    working.current = true; setBusy(true); setError('')
    try { const result = await createBilling(client, import.meta.env.VITE_APP_ENV).createCheckout(operation.current); window.location.assign(result.url) }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível abrir o pagamento. Tente novamente.'
      if (message === 'A sessão de pagamento expirou. Tente novamente para abrir uma nova sessão.') operation.current = crypto.randomUUID()
      if (message === 'Pagamento em processamento. Aguarde a confirmação.') setProcessing(true)
      setError(message); working.current = false; setBusy(false)
    }
  }
  const state = member?.billingState
  const paid = state === 'active'
  const needsAttention = ['past_due', 'unpaid', 'incomplete_expired'].includes(state || '')
  const canCheckout = !state || ['incomplete', 'canceled', 'incomplete_expired'].includes(state)
  const pending = (returned === 'processing' || processing) && !paid && !needsAttention
  return <section className="enrollment-payment" aria-label="Pagamento da assinatura">
    <h2 ref={heading} tabIndex={-1}>{member?.eligible ? 'Pagamento confirmado' : paid ? 'Pagamento em dia' : needsAttention ? 'Pagamento não aprovado' : pending ? 'Aguardando confirmação' : 'Sua assinatura Linha Gold'}</h2>
    <p role="status">{member?.eligible ? 'Seu cartão e seus benefícios estão disponíveis.' : paid ? 'Seu pagamento está em dia, mas os benefícios estão indisponíveis. Consulte sua conta ou o suporte.' : needsAttention ? 'O pagamento não foi confirmado pelo provedor. Consulte sua assinatura para revisar a cobrança e a forma de pagamento.' : pending ? 'Estamos consultando a confirmação do pagamento. Os benefícios continuam indisponíveis até a confirmação do servidor.' : returned === 'canceled' ? 'Você voltou sem concluir o pagamento. Pode retomá-lo quando quiser.' : 'Confira seu plano antes de continuar para o pagamento seguro na Stripe.'}</p>
    <div className="enrollment-plan"><span>Plano {goldPlan.name}</span><p><strong>{brl(goldPlan.monthlyCents)}</strong><span> / mês</span></p><ul><li>Descontos nos parceiros participantes, conforme cada estabelecimento.</li><li>Cartão digital com QR e consulta de parceiros e endereços.</li><li>Histórico de compras e economia na área do associado.</li></ul></div>
    <p>Renovação mensal automática. O cancelamento pode ser solicitado na área da assinatura e é agendado para o fim do período pago.</p>
    <p>Os benefícios são liberados após a confirmação real do pagamento. O retorno da Stripe, por si só, não confirma a ativação.</p>
    <div className="enrollment-legal-links"><a href="/termos" target="_blank" rel="noopener noreferrer">Termos de uso</a><a href="/privacidade" target="_blank" rel="noopener noreferrer">Privacidade</a></div>
    {!paid && !pending && canCheckout && <><p>Ao continuar, você será direcionado à Stripe. Uma sessão de pagamento pendente será retomada quando disponível.</p><Button className="full" disabled={busy || !online} onClick={() => void pay()}>{busy ? 'Abrindo pagamento seguro…' : returned === 'canceled' ? 'Retomar pagamento' : `Continuar para pagar ${brl(goldPlan.monthlyCents)}`}</Button></>}
    {(pending || needsAttention || !canCheckout) && <Button className="full" variant="outline" disabled={checking || !online} onClick={() => void check()}>{checking ? 'Consultando pagamento…' : 'Atualizar status do pagamento'}</Button>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    {member?.eligible || needsAttention || paid ? <Button className="full" disabled={!online || checking} onClick={() => void openArea()}>{checking ? 'Atualizando sua conta…' : needsAttention ? 'Revisar minha assinatura' : 'Abrir minha área'}</Button> : null}
  </section>
}
