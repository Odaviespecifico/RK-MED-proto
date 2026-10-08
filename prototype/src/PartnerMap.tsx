import { useState } from 'react'
import { MapPin, ArrowUpRight } from 'lucide-react'
import type { Partner } from './lib/demo'

const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY?.trim()

export function PartnerMap({ partners }: { partners: Partner[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = partners.find(partner => partner.id === selectedId) ?? partners[0]
  if (!selected) return null

  const query = `${selected.address.replace(' · ', ', ')}, Brasil`
  const mapUrl = mapsKey && `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsKey)}&q=${encodeURIComponent(query)}`
  const searchUrl = (partner: Partner) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${partner.address.replace(' · ', ', ')}, Brasil`)}`

  return <section className="partner-map" aria-label="Localizações dos parceiros">
    <div className="partner-map-head"><div><h3>Onde encontrar nossos parceiros</h3><p>Selecione um parceiro para ver a localização no Google Maps.</p></div><small>Endereços de demonstração</small></div>
    <div className="partner-map-layout">
      <div className="partner-map-list">{partners.map(partner => <button type="button" key={partner.id} className={partner.id === selected.id ? 'selected' : ''} onClick={() => setSelectedId(partner.id)} aria-pressed={partner.id === selected.id}><MapPin size={17} /><span><b>{partner.name}</b><small>{partner.address}</small></span></button>)}</div>
      <div className="partner-map-view">
        {mapUrl ? <iframe key={selected.id} title={`Mapa de ${selected.name}`} src={mapUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <div className="partner-map-placeholder"><MapPin size={30} aria-hidden="true" /><b>{selected.name}</b><span>{selected.address}</span><small>Veja a localização no Google Maps.</small></div>}
        <a href={searchUrl(selected)} target="_blank" rel="noopener noreferrer">Abrir no Google Maps <ArrowUpRight size={16} /></a>
      </div>
    </div>
  </section>
}
