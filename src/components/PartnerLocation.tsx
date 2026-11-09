import { useEffect, useState } from 'react'
import { ArrowUpRight, MapPin } from 'lucide-react'
import { partnerMapLinks } from '../lib/partner-map'
import type { PublicPartner } from '../integrations/contracts'

type Location = Pick<PublicPartner, 'name' | 'address'>

export function EmbeddedPartnerMap({ partner }: { partner: Location }) {
  const [online, setOnline] = useState(navigator.onLine)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const links = partnerMapLinks(partner.address, import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY)
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine)
    window.addEventListener('online', changed); window.addEventListener('offline', changed)
    return () => { window.removeEventListener('online', changed); window.removeEventListener('offline', changed) }
  }, [])
  useEffect(() => { setFailed(false); setLoading(true) }, [partner.address, online])
  if (!links) return <p className="empty-copy">Endereço não informado para este parceiro.</p>
  if (!online) return <p className="empty-copy" role="status">Conecte-se à internet para explorar o mapa. Endereço: {partner.address}</p>
  return <div className="partner-map-view">
    {!failed && loading && <p className="helper" role="status">Carregando mapa…</p>}
    {failed ? <p role="alert">Não foi possível carregar o mapa. <button type="button" className="text-link" onClick={() => { setFailed(false); setAttempt(value => value + 1) }}>Tentar novamente</button></p>
      : <iframe key={`${partner.address}:${attempt}`} title={`Mapa de ${partner.name}`} src={links.embed} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen onLoad={() => setLoading(false)} onError={() => setFailed(true)} />}
    <a href={links.external} target="_blank" rel="noopener noreferrer">Abrir no Google Maps <ArrowUpRight size={16} /></a>
  </div>
}

export function PartnerLocation({ partner }: { partner: Location }) {
  const [open, setOpen] = useState(false)
  return <details className="partner-location" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary aria-label={`Ver ${partner.name} no mapa`}><MapPin size={16} aria-hidden="true" /> Ver no mapa</summary>
    {open && <div className="partner-location-content"><p>{partner.address}</p><EmbeddedPartnerMap partner={partner} /></div>}
  </details>
}
