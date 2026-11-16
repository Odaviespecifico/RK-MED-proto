import { useCallback } from 'react'
import type { Portal, PortalPurchase } from '../../integrations/portal'
import type { PageCursor } from '../../lib/pagination'
import { useCursorPage } from '../../lib/useCursorPage'
import { PageControls } from '../../components/PageControls'
import { PurchaseTable } from './PurchaseTable'
import { ShoppingBag } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'

export function PurchaseHistory({ api, online, revision, reverse, partnerId }: { api: Portal; online: boolean; revision: number; reverse?: (purchase: PortalPurchase) => void; partnerId?: string }) {
  const load = useCallback((cursor: PageCursor | null) => partnerId ? api.partnerPurchasesPage(partnerId, cursor) : api.purchasesPage(cursor), [api, partnerId])
  const page = useCursorPage(load, online, revision)
  return <>
    {page.loading && <p role="status">Carregando compras...</p>}
    {page.error && <p role="alert" className="inline-error">{page.error}</p>}
    {page.data && (page.data.items.length ? <PurchaseTable purchases={page.data.items} reverse={reverse} /> : <EmptyState icon={ShoppingBag} title="Nenhuma compra registrada" description="As compras registradas aparecerão aqui." />)}
    <PageControls label="Páginas de compras" page={page} />
  </>
}
