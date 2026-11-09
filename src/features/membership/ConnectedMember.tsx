import { PartnerLocation } from '../../components/PartnerLocation'
import { MemberSupportHistory } from './MemberSupportHistory'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import QRCode from 'qrcode'
import { ArrowRight, HelpCircle } from 'lucide-react'
import { readMemberSnapshot, saveMemberSnapshot, type MemberSnapshot } from '../../offline/member'
import { Brand } from '../../components/identity'
import { Button } from '../../components/ui/button'
import type { MemberEconomy, Portal, PortalMember } from '../../integrations/portal'
import type { PublicPartner } from '../../integrations/contracts'
import { brl, shortDate } from '../../lib/format'
import { PurchaseTable } from '../partner/PurchaseTable'
import { PageControls } from '../../components/PageControls'
import { mergeHistory, savedHistoryPage, type PageCursor } from '../../lib/pagination'
import { useCursorPage } from '../../lib/useCursorPage'
import { reportMoney } from '../../lib/reports'
import { MemberInstallPrompt } from '../../components/MemberInstallPrompt'
import { PartnerMap } from '../../PartnerMap'
import { MemberSubscriptionPanel } from './MemberSubscription'

export type MemberSection = 'inicio' | 'parceiros' | 'economia' | 'conta' | 'assinatura'

export function ConnectedMember({ api, member, partners, online, refresh, snapshot, section = 'inicio', go }: { api: Portal; member: PortalMember; partners: PublicPartner[]; online: boolean; refresh: () => Promise<void>; snapshot?: MemberSnapshot; section?: MemberSection; go: (path: string) => void }) {
  const [qr, setQr] = useState('')
  const [savings, setSavings] = useState<string | null>(snapshot ? snapshot.savingsCents || snapshot.purchases.filter(p => !p.reversedAt).reduce((sum, p) => sum + BigInt(p.discountCents), 0n).toString() : null)
  const [photo, setPhoto] = useState<string | null>(snapshot?.photo || null)
  const [economy, setEconomy] = useState<MemberEconomy | null>(null)
  const [economyError, setEconomyError] = useState('')
  const [supportMessage, setSupportMessage] = useState('')
  const [supportBusy, setSupportBusy] = useState(false)
  const [supportNotice, setSupportNotice] = useState('')
  const [supportError, setSupportError] = useState('')
  const [supportRevision, setSupportRevision] = useState(0)
  const load = useCallback((cursor: PageCursor | null) => online ? api.purchasesPage(cursor, cursor === null) : Promise.resolve(savedHistoryPage(snapshot?.purchases || [], cursor)), [api, online, snapshot])
  const history = useCursorPage(load, online || !!snapshot)
  const [error, setError] = useState('')
  useEffect(() => { let current = true; QRCode.toDataURL(member.cardToken, { width: 240, margin: 2 }).then(value => { if (current) setQr(value) }); return () => { current = false } }, [member.cardToken])
  useEffect(() => {
    if (history.data?.savingsCents !== null && history.data?.savingsCents !== undefined) setSavings(history.data.savingsCents)
  }, [history.data])
  useEffect(() => {
    if (!online) return
    let active = true
    api.memberEconomy().then(value => { if (active) { setEconomy(value); setSavings(value.savingsCents); setEconomyError('') } })
      .catch(() => { if (active) setEconomyError('Não foi possível carregar o resumo da economia.') })
    return () => { active = false }
  }, [api, online])
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
  async function sendSupport(e: FormEvent) {
    e.preventDefault()
    if (!online || supportBusy) return
    const message = supportMessage.trim()
    if (message.length < 5) { setSupportError('Escreva uma mensagem com pelo menos 5 caracteres.'); return }
    setSupportBusy(true); setSupportError(''); setSupportNotice('')
    try {
      await api.openSupport(message)
      setSupportRevision(value => value + 1)
      setSupportMessage('')
      setSupportNotice('Solicitação registrada. A resposta aparecerá aqui e será enviada por e-mail.')
    } catch (e) { setSupportError(e instanceof Error ? e.message : 'Não foi possível enviar a mensagem.') } finally { setSupportBusy(false) }
  }
  const recordedPurchases = economy?.purchases ?? snapshot?.purchases.filter(p => !p.reversedAt).length ?? history.data?.items.filter(p => !p.reversedAt).length ?? 0
  const partnersVisited = economy?.partners ?? new Set((snapshot?.purchases || history.data?.items || []).filter(p => !p.reversedAt).map(p => p.partnerId)).size
  const totalSavings = economy?.savingsCents ?? savings
  const subscription = <section className="surface-card account-plan">
    <div><h3>Minha assinatura</h3><span className={`status-badge ${member.eligible ? 'status-active' : 'status-blocked'}`}><span className="status-dot" />{member.eligible ? 'Benefício disponível' : 'Benefício indisponível'}</span></div>
    <p>Linha Gold · {brl(6990)} / mês</p>
    <p>{member.blocked ? 'Acesso bloqueado. Entre em contato com a equipe RKMED.' : member.billingState === 'active' ? 'Pagamento em dia' : member.billingState === 'past_due' ? 'Pagamento pendente' : member.billingState === 'canceled' ? 'Assinatura cancelada' : 'Assinatura incompleta'}</p>
    {member.paidThrough && <p>Período pago até {shortDate(member.paidThrough)}</p>}
    {member.cancelAtPeriodEnd && <p>Cancelamento agendado para o fim do período pago.</p>}
    <Button disabled={!online} onClick={() => go('/app/assinatura')}>Gerenciar assinatura</Button>
  </section>
  const support = <section className="surface-card support-card">
    <HelpCircle size={25} />
    <h3>Precisa de ajuda?</h3>
    <p>Escreva para a equipe RKMED. A resposta ficará no seu histórico e será enviada ao seu e-mail verificado.</p>
    <form onSubmit={sendSupport}>
      <label className="field-label">Sua mensagem<textarea className="input" required minLength={5} maxLength={2000} value={supportMessage} onChange={e => setSupportMessage(e.target.value)} placeholder="Como podemos ajudar?" disabled={!online || supportBusy} /></label>
      <Button type="submit" disabled={!online || supportBusy}>{supportBusy ? 'Enviando...' : 'Enviar mensagem'}</Button>
    </form>
    {supportNotice && <p role="status" className="inline-success">{supportNotice}</p>}
    {supportError && <p role="alert" className="inline-error">{supportError}</p>}
    {!online && <small>Mensagens exigem conexão.</small>}
    <MemberSupportHistory api={api} online={online} revision={supportRevision} />
  </section>
  return <><MemberInstallPrompt />
    {section === 'inicio' && <>
      <div className="welcome-row"><div><h1>Olá, {member.name.split(' ')[0]}.</h1><p>Seu cartão e seus benefícios em um só lugar.</p></div></div>
      {!online && <p className="member-note" role="status">Você está offline. Última sincronização: {snapshot ? new Date(snapshot.syncedAt).toLocaleString('pt-BR', { timeZone: 'America/Recife' }) : 'indisponível'}. A situação salva não comprova direito ao benefício; o parceiro faz a validação online.</p>}
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="member-overview"><section className="member-card-block"><div className="digital-card"><div className="digital-card-top"><Brand /><span>LINHA GOLD</span></div><div className="digital-card-center"><span>Seu cuidado.<br />Sua economia.</span><span className="card-flower">✳</span></div><div className="digital-card-bottom"><span><small>ASSOCIADO</small><b>{member.name}</b><small>{member.cpf}</small></span></div></div><div className="qr-panel"><h2>Seu cartão digital</h2><p>{member.eligible ? 'Situação atual: benefício disponível.' : 'Benefício indisponível. Consulte sua assinatura.'}</p>{qr && <div className="qr-wrap"><img className="qr-img" src={qr} alt="QR do cartão do associado" /></div>}<p>O parceiro confere sua foto e a situação da assinatura antes de registrar a compra.</p></div></section>
        <div className="member-side"><section className="savings-card"><span>ECONOMIA ACUMULADA</span><strong>{totalSavings === null ? '—' : reportMoney(totalSavings)}</strong><small>{recordedPurchases} compra(s) registrada(s)</small><button onClick={() => go('/app/economia')}>Ver minha economia <ArrowRight size={17} /></button></section>{subscription}</div></div>
    </>}
    {section === 'parceiros' && <>
      <div className="welcome-row"><div><h1>Parceiros</h1><p>Consulte a rede credenciada, os descontos e os endereços.</p></div></div>
      <section className="surface-card counter-flow"><div className="small-section-head"><h2>Rede credenciada</h2><small>{partners.length} parceiro(s)</small></div>{partners.length ? partners.map(p => <article className="partner-directory-entry" key={p.id}><div className="dash-row"><span><b>{p.name}</b><small>{p.segment} · {p.address}</small></span><strong>{p.discount}%</strong></div><PartnerLocation partner={p} /></article>) : <p className="empty-copy">Nenhum parceiro disponível.</p>}</section>
      <PartnerMap partners={partners} />
    </>}
    {section === 'economia' && <>
      <div className="welcome-row"><div><h1>Minha economia</h1><p>Descontos registrados nas suas compras.</p></div></div>
      {!online && <p className="member-note" role="status">Mostrando apenas o histórico salvo neste aparelho. Ele pode estar incompleto ou desatualizado.</p>}
      {economyError && <p role="alert" className="inline-error">{economyError}</p>}
      <div className="stats-row"><div className="stat-large"><span>TOTAL ECONOMIZADO</span><strong>{totalSavings === null ? '—' : reportMoney(totalSavings)}</strong><small>Desde o início na Linha Gold</small></div><div className="stat-mini"><span>COMPRAS REGISTRADAS</span><strong>{recordedPurchases}</strong><small>Na sua jornada Gold</small></div><div className="stat-mini"><span>PARCEIROS VISITADOS</span><strong>{partnersVisited}</strong><small>Mais opções para você</small></div></div>
      <section className="surface-card counter-flow"><div className="small-section-head"><h2>Histórico de compras</h2><small>Valores das compras</small></div>{history.loading && <p role="status">Carregando histórico...</p>}{history.error && <p role="alert" className="inline-error">{history.error}</p>}{history.data && <PurchaseTable purchases={history.data.items} />}<PageControls label="Páginas do meu histórico" page={history} /></section>
    </>}
    {section === 'assinatura' && <MemberSubscriptionPanel api={api} member={member} online={online} refresh={refresh} go={go} />}
    {section === 'conta' && <>
      <div className="welcome-row"><div><h1>Minha conta</h1><p>Seus dados e sua assinatura em um só lugar.</p></div></div>
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="account-grid"><div className="surface-card account-profile">{photo ? <span className="avatar avatar-large"><img src={photo} alt={`Foto de ${member.name}`} /></span> : <span className="avatar avatar-large">{member.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span>}<h3>{member.name}</h3><span className={`status-badge ${member.eligible ? 'status-active' : 'status-blocked'}`}><span className="status-dot" />{member.eligible ? 'Benefício disponível' : 'Benefício indisponível'}</span><div className="account-fields"><div><span>E-mail verificado</span><b>{member.email || 'Disponível quando online'}</b></div><div><span>SMS verificado</span><b>{member.phone || 'Disponível quando online'}</b></div><div><span>CPF</span><b>{member.cpf}</b></div><div><span>Associado desde</span><b>{shortDate(member.joinedAt)}</b></div></div></div><div>{subscription}{support}</div></div>
    </>}
  </>
}
