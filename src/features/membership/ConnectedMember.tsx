import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { readMemberSnapshot, saveMemberSnapshot, type MemberSnapshot } from '../../offline/member'
import { Brand } from '../../components/identity'
import { Button } from '../../components/ui/button'
import type { Portal, PortalMember } from '../../integrations/portal'
import type { PublicPartner } from '../../integrations/contracts'
import { brl, shortDate } from '../../lib/format'
import { PurchaseTable } from '../partner/PurchaseTable'
import { PageControls } from '../../components/PageControls'
import { mergeHistory, savedHistoryPage, type PageCursor } from '../../lib/pagination'
import { useCursorPage } from '../../lib/useCursorPage'
import { reportMoney } from '../../lib/reports'

export function ConnectedMember({ api, member, partners, online, refresh, snapshot }: { api: Portal; member: PortalMember; partners: PublicPartner[]; online: boolean; refresh: () => Promise<void>; snapshot?: MemberSnapshot }) {
  const [qr, setQr] = useState('')
  const [savings, setSavings] = useState<string | null>(snapshot ? snapshot.savingsCents || snapshot.purchases.filter(p => !p.reversedAt).reduce((sum, p) => sum + BigInt(p.discountCents), 0n).toString() : null)
  const [photo, setPhoto] = useState<string | null>(snapshot?.photo || null)
  const load = useCallback((cursor: PageCursor | null) => online ? api.purchasesPage(cursor, cursor === null) : Promise.resolve(savedHistoryPage(snapshot?.purchases || [], cursor)), [api, online, snapshot])
  const history = useCursorPage(load, online || !!snapshot)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  useEffect(() => { let current = true; QRCode.toDataURL(member.cardToken, { width: 240, margin: 2 }).then(value => { if (current) setQr(value) }); return () => { current = false } }, [member.cardToken])
  useEffect(() => {
    if (history.data?.savingsCents !== null && history.data?.savingsCents !== undefined) setSavings(history.data.savingsCents)
  }, [history.data])
  useEffect(() => {
    if (!online || !member.photoPath) return
    let active = true
    void (async () => {
      try {
        const url = await api.photo(member.photoPath)
        if (!url) return
        const response = await fetch(url, { cache: 'no-store' })
        if (!response.ok) return
        const blob = await response.blob()
        const value = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob) })
        if (active) setPhoto(value)
      } catch { /* History/card can still be saved when a photo cannot be refreshed. */ }
    })()
    return () => { active = false }
  }, [api, online, member.photoPath])
  useEffect(() => {
    if (!online || !history.data) return
    let active = true
    const page = history.data
    void (async () => {
      const previous = await readMemberSnapshot()
      if (!active) return
      await saveMemberSnapshot({ version: 1, account: member.id, member,
        purchases: mergeHistory(previous?.account === member.id ? previous.purchases : [], page.items),
        partners, photo: photo || (previous?.account === member.id ? previous.photo : null),
        savingsCents: page.savingsCents ?? savings ?? undefined, historyPartial: true, syncedAt: new Date().toISOString() })
    })().catch(() => { if (active) setError('Não foi possível salvar o histórico neste aparelho.') })
    return () => { active = false }
  }, [online, history.data, photo, savings, member, partners])
  async function command(action: string) {
    if (!online || busy) return
    setBusy(true); setError('')
    try {
      const result = await api.command<{ url?: string }>(action, { operationId: crypto.randomUUID() })
      if (result.url) { const url = new URL(result.url); if (url.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com'].includes(url.hostname)) throw new Error('Destino de pagamento inválido.'); window.location.assign(url.href) }
      else { setConfirmCancel(false); await refresh() }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir.') } finally { setBusy(false) }
  }
  return <><div className="welcome-row"><div><h1>Olá, {member.name.split(' ')[0]}.</h1><p>Seu cartão e seus benefícios em um só lugar.</p></div></div>
    {!online && <p className="member-note" role="status">Você está offline. Última sincronização: {snapshot ? new Date(snapshot.syncedAt).toLocaleString('pt-BR', { timeZone: 'America/Recife' }) : 'indisponível'}. A situação salva não comprova direito ao benefício; o parceiro faz a validação online.</p>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    <div className="member-overview"><section className="member-card-block"><div className="digital-card"><div className="digital-card-top"><Brand /><span>LINHA GOLD</span></div><div className="digital-card-center"><span>Seu cuidado.<br />Sua economia.</span><span className="card-flower">✳</span></div><div className="digital-card-bottom"><span><small>ASSOCIADO</small><b>{member.name}</b><small>{member.cpf}</small></span></div></div><div className="qr-panel"><h2>Seu cartão digital</h2><p>{member.eligible ? 'Situação atual: benefício disponível.' : 'Benefício indisponível. Consulte sua assinatura.'}</p>{qr && <div className="qr-wrap"><img className="qr-img" src={qr} alt="QR do cartão do associado" /></div>}<p>O parceiro confere sua foto e a situação da assinatura antes de registrar a compra.</p></div></section>
      <div className="member-side"><section className="savings-card"><span>ECONOMIA ACUMULADA</span><strong>{savings === null ? '—' : reportMoney(savings)}</strong><small>Compras registradas nos parceiros</small></section><section className="quick-block"><h2>Minha assinatura</h2><p>Mensalidade: {brl(6960)}</p><p>{member.blocked ? 'Acesso bloqueado. Entre em contato com a equipe RKMED.' : member.billingState === 'active' ? 'Pagamento em dia' : 'Pagamento pendente'}</p>{member.paidThrough && <p>Período pago até {shortDate(member.paidThrough)}</p>}{member.cancelAtPeriodEnd && <p>Cancelamento agendado para o fim do período pago.</p>}{member.billingState === 'incomplete' || member.billingState === 'canceled' ? <Button disabled={!online || busy} onClick={() => void command('checkout')}>Concluir assinatura</Button> : <Button disabled={!online || busy} onClick={() => void command('portal')}>Gerenciar pagamento</Button>}{member.billingState === 'active' && !member.cancelAtPeriodEnd && <Button variant="ghost" disabled={!online || busy} onClick={() => setConfirmCancel(true)}>Cancelar ao fim do período</Button>}{confirmCancel && <div role="group" aria-label="Confirmar cancelamento"><p>Você manterá acesso até o fim do período pago, salvo bloqueio ou falha de pagamento.</p><Button disabled={!online || busy} onClick={() => void command('cancel')}>Confirmar cancelamento</Button><Button variant="ghost" onClick={() => setConfirmCancel(false)}>Voltar</Button></div>}</section></div></div>
    <section className="surface-card counter-flow"><h2>Minha economia</h2>{history.loading && <p role="status">Carregando histórico...</p>}{history.error && <p role="alert" className="inline-error">{history.error}</p>}{!online && <p>Mostrando apenas o histórico salvo neste aparelho. Ele pode estar incompleto ou desatualizado.</p>}{history.data && <PurchaseTable purchases={history.data.items} />}<PageControls label="Páginas do meu histórico" page={history} /></section><section className="surface-card counter-flow"><h2>Parceiros</h2>{partners.map(p => <div className="dash-row" key={p.id}><span><b>{p.name}</b><small>{p.segment} · {p.address}</small></span><strong>{p.discount}%</strong></div>)}</section></>
}
