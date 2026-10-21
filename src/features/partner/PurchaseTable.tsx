import { Button } from '../../components/ui/button'
import type { PortalPurchase } from '../../integrations/portal'
import { brl, shortDate } from '../../lib/format'

export function PurchaseTable({ purchases, reverse }: { purchases: PortalPurchase[]; reverse?: (purchase: PortalPurchase) => void }) {
  return purchases.length ? <div className="table-card"><table className="responsive-table"><thead><tr><th>Associado</th><th>Parceiro / funcionário</th><th>Data</th><th>Bruto</th><th>Economia</th><th>Final</th><th>Status</th>{reverse && <th>Ação</th>}</tr></thead><tbody>{purchases.map(p => <tr key={p.id}><td data-label="Associado">{p.memberName}</td><td data-label="Parceiro / funcionário">{p.partnerName} · {p.employee}</td><td data-label="Data">{shortDate(p.createdAt)}</td><td data-label="Bruto">{brl(p.grossCents)}</td><td data-label="Economia">{brl(p.discountCents)}</td><td data-label="Final">{brl(p.finalCents)}</td><td data-label="Status">{p.reversedAt ? 'Estornada' : 'Registrada'}</td>{reverse && <td data-label="Ação"><Button variant="outline" disabled={!!p.reversedAt} onClick={() => reverse(p)}>Estornar</Button></td>}</tr>)}</tbody></table></div> : <p className="empty-copy">Nenhuma compra registrada.</p>
}
