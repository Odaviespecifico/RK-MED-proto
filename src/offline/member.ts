import type { PublicPartner } from '../integrations/contracts'
import type { PortalMember, PortalPurchase } from '../integrations/portal'
export type MemberSnapshot = { version: 1; account: string; member: PortalMember; purchases: PortalPurchase[]; partners: PublicPartner[]; photo: string | null; syncedAt: string; savingsCents?: string; historyPartial?: boolean }
const accountKey = 'rkmed-sandbox-offline-account-v1'
let epoch = 0
let queue = Promise.resolve()
function db(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open('rkmed-sandbox-member-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('snapshots'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
async function transaction(mode: IDBTransactionMode, action: (store: IDBObjectStore) => void) { const database = await db(); try { await new Promise<void>((resolve, reject) => { const tx = database.transaction('snapshots', mode); action(tx.objectStore('snapshots')); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error) }) } finally { database.close() } }
export function offlineAccount(account: string | null) {
  if (localStorage.getItem(accountKey) === account) return queue
  epoch++
  if (account) localStorage.setItem(accountKey, account); else localStorage.removeItem(accountKey)
  queue = queue.catch(() => {}).then(() => transaction('readwrite', store => store.clear())).catch(() => {})
  return queue
}
export async function saveMemberSnapshot(snapshot: MemberSnapshot) {
  const generation = epoch
  queue = queue.catch(() => {}).then(async () => {
    if (epoch !== generation || localStorage.getItem(accountKey) !== snapshot.account) return
    await transaction('readwrite', store => store.put(snapshot, snapshot.account))
  })
  await queue
}
export async function readMemberSnapshot(): Promise<MemberSnapshot | null> {
  const account = localStorage.getItem(accountKey)
  if (!account) return null
  await queue
  let value: MemberSnapshot | null = null
  try { await transaction('readonly', store => { const request = store.get(account); request.onsuccess = () => { const data = request.result; if (data?.version === 1 && data.account === account && data.member?.id === account && /^\*{3}/.test(data.member.cpf) && Array.isArray(data.purchases) && Array.isArray(data.partners) && (data.savingsCents === undefined || (typeof data.savingsCents === 'string' && /^\d+$/.test(data.savingsCents)))) value = data } }); return localStorage.getItem(accountKey) === account ? value : null } catch { return null }
}
