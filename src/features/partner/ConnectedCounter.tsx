import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/button'
import type { Portal, PortalContext, Quote, Validation } from '../../integrations/portal'
import { brl, onlyDigits } from '../../lib/format'
import { PurchaseHistory } from './PurchaseHistory'

export function ConnectedCounter({ api, context, refresh, online }: { api: Portal; context: PortalContext; refresh: () => Promise<void>; online: boolean }) {
  const [code, setCode] = useState('')
  const [method, setMethod] = useState<'qr' | 'cpf'>('qr')
  const [lookup, setLookup] = useState('')
  const [member, setMember] = useState<Validation | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [gross, setGross] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [historyRevision, setHistoryRevision] = useState(0)
  const [scanning, setScanning] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const operation = useRef(crypto.randomUUID())
  useEffect(() => {
    if (!online) { setMember(null); setPhoto(null); setQuote(null); setScanning(false) }
  }, [online])
  useEffect(() => {
    if (!scanning || !video.current) return
    let stopped = false
    let stop: (() => void) | undefined
    import('@zxing/browser').then(async ({ BrowserQRCodeReader }) => {
      const reader = new BrowserQRCodeReader()
      const controls = await reader.decodeFromVideoDevice(undefined, video.current!, (result, _error, controls) => {
        if (result && !stopped) { setLookup(result.getText()); controls.stop(); setScanning(false) }
      })
      stop = () => controls.stop()
      if (stopped) stop()
    }).catch(() => { if (!stopped) { setError('Não foi possível abrir a câmera. Use a busca por CPF.'); setScanning(false) } })
    return () => { stopped = true; stop?.() }
  }, [scanning])
  async function run(action: () => Promise<void>) {
    if (!online || busy) return
    setBusy(true); setError(''); setNotice('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Operação indisponível.') }
    finally { setBusy(false) }
  }
  async function validate(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      setMember(null); setQuote(null); setPhoto(null); setConfirmed(false); setGross('')
      const result = await api.validate(method === 'cpf' ? onlyDigits(lookup) : lookup.trim(), method)
      setLookup(''); setMember(result); operation.current = crypto.randomUUID()
      if (result.photoPath && result.eligible) setPhoto(await api.photo(result.photoPath))
    })
  }
  if (!context.workSession) return <section className="surface-card counter-flow"><h1>Iniciar atendimento</h1><p>Informe seu código de funcionário neste estabelecimento.</p><form onSubmit={e => { e.preventDefault(); void run(async () => { await api.startWork(code); setCode(''); await refresh() }) }}><label className="field-label">Código do funcionário<input className="input" type="password" inputMode="numeric" autoComplete="off" value={code} onChange={e => setCode(onlyDigits(e.target.value))} required minLength={4} maxLength={12} /></label><Button disabled={!online || busy} type="submit">Iniciar atendimento</Button></form>{error && <p className="inline-error" role="alert">{error}</p>}</section>
  return <><div className="welcome-row"><div><h1>Balcão de atendimento</h1><p>Funcionário: {context.workSession.employeeName}</p></div><Button variant="outline" disabled={!online || busy} onClick={() => void run(async () => { await api.endWork(); setMember(null); setPhoto(null); setQuote(null); await refresh() })}>Trocar funcionário</Button></div>
    {!online && <p role="alert" className="inline-error">Conecte-se para validar cartões e registrar compras.</p>}
    {error && <p role="alert" className="inline-error">{error}</p>}{notice && <p role="status" className="inline-success">{notice}</p>}
    <div className="counter-layout"><section className="surface-card counter-flow"><h2>Validar associado</h2><div className="row-actions"><Button variant={method === 'qr' ? 'primary' : 'outline'} onClick={() => { setMethod('qr'); setLookup(''); setMember(null); setPhoto(null); setQuote(null) }}>QR do cartão</Button><Button variant={method === 'cpf' ? 'primary' : 'outline'} onClick={() => { setMethod('cpf'); setLookup(''); setMember(null); setPhoto(null); setQuote(null); setScanning(false) }}>Buscar por CPF</Button></div>
      {method === 'qr' && <><Button variant="outline" disabled={!online || busy} onClick={() => setScanning(!scanning)}>{scanning ? 'Fechar câmera' : 'Abrir câmera'}</Button>{scanning && <video ref={video} muted playsInline style={{ width: '100%' }} />}</>}
      <form onSubmit={validate}><label className="field-label">{method === 'qr' ? 'Código do cartão' : 'CPF exato'}<input className="input" autoComplete="off" inputMode={method === 'cpf' ? 'numeric' : 'text'} value={lookup} onChange={e => setLookup(e.target.value)} required maxLength={128} /></label><Button type="submit" disabled={!online || busy}>Buscar</Button></form>
      {member && (!member.found ? <p role="status">Associado não encontrado.</p> : <div className="member-note"><span>{photo && <img src={photo} alt="Foto do associado para conferência" width={110} height={110} />}<b>{member.name}</b><small>{member.cpf}</small><p>{member.eligible ? 'Benefício disponível' : 'Benefício indisponível'}</p>{member.eligible && <label><input type="checkbox" checked={confirmed} disabled={!photo} onChange={e => setConfirmed(e.target.checked)} /> Conferi a pessoa com a foto</label>}{member.eligible && !photo && <p>Foto indisponível. Atualize a consulta antes de prosseguir.</p>}</span></div>)}
    </section><section className="surface-card purchase-form"><h2>Registrar compra</h2><form onSubmit={e => { e.preventDefault(); void run(async () => { const value = gross.trim(); if (!/^\d+(?:[,.]\d{1,2})?$/.test(value)) throw new Error('Informe um valor em reais, com até dois centavos.'); const [whole, decimals = ''] = value.replace(',', '.').split('.'); const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0')); if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Valor inválido.'); setQuote(await api.quote(member!.receipt!, cents)) }) }}><label className="field-label">Valor bruto (R$)<input className="input" inputMode="decimal" placeholder="0,00" value={gross} onChange={e => { setGross(e.target.value); setQuote(null) }} disabled={!member?.receipt || !online} required /></label><Button type="submit" disabled={!online || busy || !confirmed || !member?.receipt}>Revisar valores</Button></form>
      {quote && <div className="member-note"><span><p>Valor bruto: {brl(quote.grossCents)}</p><p>Desconto: {brl(quote.discountCents)} ({quote.discountBps / 100}%)</p><p><b>Total ao parceiro: {brl(quote.finalCents)}</b></p><Button disabled={!online || busy || !confirmed} onClick={() => void run(async () => { await api.commit(member!.receipt!, quote, operation.current); setMember(null); setPhoto(null); setQuote(null); setConfirmed(false); setGross(''); setNotice('Compra registrada!'); setHistoryRevision(value => value + 1) })}>{busy ? 'Registrando...' : 'Confirmar registro'}</Button></span></div>}
    </section></div><section className="surface-card counter-flow"><h2>Compras deste estabelecimento</h2><PurchaseHistory api={api} online={online} revision={historyRevision} /></section></>
}

