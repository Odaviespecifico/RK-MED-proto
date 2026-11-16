// Only explicitly allowed fields may be persisted. Passwords, tokens and files
// must stay in memory and are never accepted by this helper.
const prefix = 'rkmed-registration-draft:'
const lifetime = 24 * 60 * 60 * 1000
const forbidden = /password|senha|token|secret|segredo|file|arquivo/i

type Draft = { version: 1; updatedAt: number; step: number; fields: Record<string, string | boolean> }

export function draftKey(userId: string, kind: 'partner' | 'staff') {
  return `${prefix}${encodeURIComponent(userId)}:${kind}`
}

export function saveRegistrationDraft(key: string, step: number, fields: Record<string, string | boolean>, allowed: readonly string[]): boolean {
  try {
    if (!Number.isInteger(step) || step < 0 || !key.startsWith(prefix)) return false
    const safe: Record<string, string | boolean> = {}
    for (const name of allowed) {
      if (forbidden.test(name)) continue
      const value = fields[name]
      if (typeof value === 'string' && value.length <= 1000 || typeof value === 'boolean') safe[name] = value
    }
    localStorage.setItem(key, JSON.stringify({ version: 1, updatedAt: Date.now(), step, fields: safe } satisfies Draft))
    return true
  } catch { return false }
}

export function readRegistrationDraft(key: string, allowed: readonly string[], maxStep: number, maxAge = lifetime): Draft | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const value = JSON.parse(raw)
    if (value?.version !== 1 || !Number.isFinite(value.updatedAt) || value.updatedAt > Date.now() || Date.now() - value.updatedAt > maxAge || !Number.isInteger(value.step) || value.step < 0 || value.step > maxStep || !value.fields || typeof value.fields !== 'object' || Array.isArray(value.fields)) throw new Error('invalid draft')
    const fields: Record<string, string | boolean> = {}
    for (const [name, entry] of Object.entries(value.fields)) {
      if (!allowed.includes(name) || forbidden.test(name) || !(typeof entry === 'boolean' || typeof entry === 'string' && entry.length <= 1000)) throw new Error('invalid field')
      fields[name] = entry
    }
    return { version: 1, updatedAt: value.updatedAt, step: value.step, fields }
  } catch { try { localStorage.removeItem(key) } catch {} return null }
}

export function clearRegistrationDraft(key: string) { try { localStorage.removeItem(key) } catch {} }
export function clearRegistrationDrafts(userId: string) {
  for (const kind of ['partner', 'staff'] as const) clearRegistrationDraft(draftKey(userId, kind))
}
