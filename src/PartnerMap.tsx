import { useState } from 'react'
import { MapPin } from 'lucide-react'
import type { PublicPartner as Partner } from './integrations/contracts'
import { EmbeddedPartnerMap } from './components/PartnerLocation'
import { PageControls } from './components/PageControls'
import { useClientPage } from './lib/useClientPage'

export function PartnerMap({ partners }: { partners: Partner[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const mapPage = useClientPage(partners, 4)
  const selected = mapPage.items.find(partner => partner.id === selectedId) ?? mapPage.items[0] ?? partners[0]
  if (!selected) return null

  return <section className="partner-map" aria-label="Localizações dos parceiros">
    <div className="partner-map-head">
      <div><h3>Onde encontrar nossos parceiros</h3><p>Selecione um parceiro para ver a localização no Google Maps.</p></div>
      {mapPage.totalPages > 1 && <small>Exibindo {mapPage.start}–{mapPage.end} de {mapPage.totalItems}</small>}
    </div>
    <div className="partner-map-layout">
      <div className="partner-map-sidebar">
        <div className="partner-map-list">{mapPage.items.map(partner => <button type="button" key={partner.id} className={partner.id === selected.id ? 'selected' : ''} onClick={() => setSelectedId(partner.id)} aria-pressed={partner.id === selected.id}><MapPin size={17} /><span><b>{partner.name}</b><small>{partner.address}</small></span></button>)}</div>
        {mapPage.totalPages > 1 && <PageControls label="Páginas de parceiros no mapa" page={mapPage} />}
      </div>
      <EmbeddedPartnerMap key={selected.id} partner={selected} />
    </div>
  </section>
}
