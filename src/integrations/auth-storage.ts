// Supabase sessions and PKCE verifiers live in IndexedDB, never localStorage.
// The in-memory fallback keeps the current tab usable if browser storage fails.
const memory = new Map<string, string>()
const volatile = new Set<string>()
const pending = new Map<string, Promise<unknown>>()
const databaseName = 'rkmed-auth-storage-v1'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('sessions')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Armazenamento indisponível'))
  })
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('sessions', mode)
      const request = action(tx.objectStore('sessions'))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
function serialized<T>(key: string, action: () => Promise<T>): Promise<T> {
  const operation = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(action)
  pending.set(key, operation)
  void operation.finally(() => { if (pending.get(key) === operation) pending.delete(key) }).catch(() => {})
  return operation
}
async function writeItem(key: string, value: string) {
  memory.set(key, value)
  try { await transaction('readwrite', store => store.put(value, key)); memory.delete(key); volatile.delete(key) } catch { volatile.add(key) /* Current tab retains the session. */ }
  try { localStorage.removeItem(key) } catch { /* Storage is optional. */ }
}
export const authStorage = {
  getItem(key: string): Promise<string | null> {
    return serialized(key, async () => {
      try {
        const value = await transaction('readonly', store => store.get(key))
        if (typeof value === 'string') {
          memory.delete(key); volatile.delete(key)
          try { localStorage.removeItem(key) } catch { /* Storage is optional. */ }
          return value
        }
        // Promote a write that only reached memory if storage became available.
        if (volatile.has(key) && memory.has(key)) { const value = memory.get(key)!; await writeItem(key, value); return value }
        // A successful read is authoritative across tabs, including deletions.
        memory.delete(key)
      } catch { if (memory.has(key)) return memory.get(key)! }
      let legacy: string | null = null
      try { legacy = localStorage.getItem(key) } catch { /* Storage is optional. */ }
      if (legacy !== null) await writeItem(key, legacy)
      return legacy
    })
  },
  setItem(key: string, value: string): Promise<void> { return serialized(key, () => writeItem(key, value)) },
  removeItem(key: string): Promise<void> {
    return serialized(key, async () => {
      memory.delete(key); volatile.delete(key)
      try { await transaction('readwrite', store => store.delete(key)) } catch { /* Storage is optional. */ }
      try { localStorage.removeItem(key) } catch { /* Storage is optional. */ }
    })
  },
}
export function authStorageKey(environment: string, projectRef: string) { return `rkmed-auth-${environment}-${projectRef || 'local'}` }
export async function clearAuthStorage(environment: string, projectRef: string) {
  const key = authStorageKey(environment, projectRef)
  await Promise.all([authStorage.removeItem(key), authStorage.removeItem(`${key}-code-verifier`)])
}
