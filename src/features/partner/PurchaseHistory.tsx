import { useCallback } from 'react'
import type { Portal, PortalPurchase } from '../../integrations/portal'
import type { PageCursor } from '../../lib/pagination'
import { useCursorPage } from '../../lib/useCursorPage'
import { PageControls } from '../../components/PageControls'
import { PurchaseTable } from './PurchaseTable'

export function PurchaseHistory({ api, online, revision, reverse }: { api: Portal; online: boolean; revision: number; reverse?: (purchase: PortalPurchase) => void }) {
  const load = useCallback((cursor: PageCursor | null) => api.purchasesPage(cursor), [api])
  const page = useCursorPage(load, online, revision)
  return <>
    {page.loading && <p role="status">Carregando compras...</p>}
    {page.error && <p role="alert" className="inline-error">{page.error}</p>}
    {page.data && <PurchaseTable purchases={page.data.items} reverse={reverse} />}
    <PageControls label="Páginas de compras" page={page} />
  </>
}
