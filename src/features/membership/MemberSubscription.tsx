import { useCallback, useEffect, useState } from 'react'
import { CreditCard, ExternalLink, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { MemberSubscription, Portal, PortalMember } from '../../integrations/portal'
import { brl, shortDate } from '../../lib/format'

const invoiceStatus: Record<string, string> = {
  paid: 'Paga', open: 'Em aberto', void: 'Cancelada', uncollectible: 'Não cobrada', draft: 'Rascunho',
}

function dateFromSeconds(value: number | null) {
  return value ? new Date(value * 1000).toISOString() : null
}

export function MemberSubscriptionPanel({ api, member, online, refresh, go }: {
  api: Portal; member: PortalMember; online: boolean; refresh: () => Promise<void>; go: (path: string) => void
}) {
  const [data, setData] = useState<MemberSubscription | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [checkout] = useState(() => new URLSearchParams(window.location.search).get('checkout'))

  const load = useCallback(async () => {
    if (!online) return
    setLoading(true); setError('')
    try { setData(await api.subscription()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar a assinatura.') }
    finally { setLoading(false) }
  }, [api, online])

  useEffect(() => { void load() }, [load])

  async function run(action: 'portal' | 'cancel' | 'resume' | 'checkout') {
    if (!online || busy) return
    setBusy(action); setError(''); setNotice('')
    try {
      const result = await api.command<{ url?: string }>(action, { operationId: crypto.randomUUID() })
      if (result.url) {
        const url = new URL(result.url)
        if (url.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com'].includes(url.hostname)) throw new Error('Destino de pagamento inválido.')
        window.location.assign(url.href)
        return
      }
      setConfirmCancel(false)
      setNotice(action === 'cancel' ? 'Cancelamento agendado para o fim do período pago.'
        : action === 'resume' ? 'Assinatura reativada. A cobrança segue normalmente.'
        : 'Situação atualizada.')
      await refresh()
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir.') }
    finally { setBusy('') }
  }

  const subscription = data?.subscription
  const currentPeriodEnd = dateFromSeconds(subscription?.currentPeriodEnd ?? null)
  const card = data?.paymentMethod
  const canCheckout = !member.eligible && ['incomplete', 'canceled'].includes(member.billingState)
  const canManage = member.billingState === 'active' || member.billingState === 'past_due'
  const canCancel = member.billingState === 'active' && !!subscription && !subscription.cancelAtPeriodEnd
  const canResume = !!subscription?.cancelAtPeriodEnd

  return <>
    <div className="welcome-row"><div><h1>Minha assinatura</h1><p>Plano, pagamento e faturas em um só lugar.</p></div></div>
    {checkout === 'processing' && <p className="member-note" role="status"><RefreshCw size={18} /> Pagamento em processamento. O benefício será liberado somente após a confirmação do provedor. <Button variant="ghost" onClick={() => void load()}>Atualizar situação</Button></p>}
    {checkout === 'canceled' && <p className="member-note" role="status">Pagamento não concluído. Você pode tentar novamente quando quiser.</p>}
    {!online && <p className="member-note" role="status">Conecte-se para consultar e alterar sua assinatura.</p>}
    {loading && <p role="status">Carregando assinatura...</p>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    {notice && <p role="status" className="inline-success">{notice}</p>}

    <div className="account-grid">
      <section className="surface-card account-plan">
        <div><h3>Linha Gold</h3><span className={`status-badge ${member.eligible ? 'status-active' : 'status-blocked'}`}><span className="status-dot" />{member.eligible ? 'Benefício disponível' : 'Benefício indisponível'}</span></div>
        <p>{brl(subscription?.amount ?? 6990)} / {subscription?.interval === 'year' ? 'ano' : 'mês'}</p>
        <p>{member.blocked ? 'Acesso bloqueado. Entre em contato com a equipe RKMED.'
          : member.billingState === 'active' ? 'Pagamento em dia.'
          : member.billingState === 'past_due' ? 'Pagamento pendente.'
          : member.billingState === 'canceled' ? 'Assinatura cancelada.'
          : 'Assinatura incompleta.'}</p>
        {currentPeriodEnd && <p>{subscription?.cancelAtPeriodEnd ? 'Acesso até' : 'Próxima cobrança'} {shortDate(currentPeriodEnd)}</p>}
        {subscription?.cancelAtPeriodEnd && <p>Cancelamento agendado para o fim do período pago.</p>}
        {canCheckout && <Button disabled={!online || !!busy} onClick={() => void run('checkout')}>{busy === 'checkout' ? 'Abrindo pagamento...' : 'Concluir assinatura'}</Button>}
        {canManage && <Button disabled={!online || !!busy} onClick={() => void run('portal')}><CreditCard size={17} /> Gerenciar no Stripe</Button>}
        {canResume && <Button disabled={!online || !!busy} onClick={() => void run('resume')}><RotateCcw size={17} /> {busy === 'resume' ? 'Reativando...' : 'Reativar assinatura'}</Button>}
        {canCancel && !confirmCancel && <Button variant="ghost" disabled={!online || !!busy} onClick={() => setConfirmCancel(true)}>Cancelar ao fim do período</Button>}
        {confirmCancel && <div role="group" aria-label="Confirmar cancelamento"><p>Você manterá acesso até o fim do período pago, salvo bloqueio ou falha de pagamento.</p><Button disabled={!online || !!busy} onClick={() => void run('cancel')}>{busy === 'cancel' ? 'Agendando...' : 'Confirmar cancelamento'}</Button><Button variant="ghost" onClick={() => setConfirmCancel(false)}>Voltar</Button></div>}
      </section>

      <div>
        <section className="surface-card">
          <div className="small-section-head"><h2>Forma de pagamento</h2><small>Stripe</small></div>
          {card ? <div className="purchase-row"><span className="purchase-icon"><CreditCard size={18} /></span><div><b>{card.brand.toUpperCase()} •••• {card.last4}</b><small>Validade {String(card.expMonth).padStart(2, '0')}/{card.expYear}</small></div><strong>Cartão</strong></div>
            : <p className="empty-copy">Nenhum cartão salvo. {canCheckout ? 'Conclua a assinatura para cadastrar.' : 'Atualize o pagamento no Stripe.'}</p>}
          {canManage && <Button variant="ghost" disabled={!online || !!busy} onClick={() => void run('portal')}>Atualizar cartão <ExternalLink size={15} /></Button>}
        </section>

        <section className="surface-card" style={{ marginTop: 18 }}>
          <div className="small-section-head"><h2>Faturas</h2><small>Últimas 6</small></div>
          {data?.invoices.length ? data.invoices.map(invoice => <div className="dash-row" key={invoice.id}>
            <span className="purchase-icon"><ShieldCheck size={18} /></span>
            <span><b>{brl(invoice.amount)} · {invoiceStatus[invoice.status || ''] || 'Fatura'}</b><small>{shortDate(dateFromSeconds(invoice.created) || '')}{invoice.number ? ` · ${invoice.number}` : ''}</small></span>
            {invoice.hostedInvoiceUrl ? <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">Ver recibo <ExternalLink size={14} /></a> : <strong>—</strong>}
          </div>) : <p className="empty-copy">As faturas aparecem aqui após a primeira cobrança.</p>}
        </section>

        {!member.eligible && <p className="member-note"><ShieldCheck size={18} /> O benefício é liberado somente após a confirmação do pagamento pelo provedor. <button className="text-link" onClick={() => go('/app')}>Voltar ao início</button></p>}
      </div>
    </div>
  </>
}
