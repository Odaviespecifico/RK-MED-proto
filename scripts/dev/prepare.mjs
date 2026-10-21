import { readFile, writeFile, access } from 'node:fs/promises'
import { localClients } from './local.mjs'
const local = localClients()
const publicEnv = { VITE_APP_MODE: 'demo', VITE_APP_ENV: 'local', VITE_SUPABASE_URL: local.url, VITE_SUPABASE_PUBLISHABLE_KEY: local.key, VITE_SUPABASE_PROJECT_REF: '' }
let existing = await readFile('.env.local', 'utf8').catch(() => '')
// Preserve unrelated settings; never copy the status service key into browser configuration.
for (const [key, value] of Object.entries(publicEnv)) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  existing = pattern.test(existing) ? existing.replace(pattern, line) : `${existing.trimEnd()}\n${line}\n`
}
await writeFile('.env.local', existing.trimStart(), { mode: 0o600 })
try { await access('supabase/functions/.env') } catch { await writeFile('supabase/functions/.env', await readFile('supabase/functions/.env.example'), { mode: 0o600 }) }
await import('./fixtures.mjs')
console.log('Configuração pública local preparada. Rode npm run dev:sandbox e npm run functions:serve em terminais separados.')
