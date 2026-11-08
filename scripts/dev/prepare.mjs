import { writeFile, chmod } from 'node:fs/promises'
import { localClients } from './local.mjs'
import { ensureEnvironmentFiles, environmentPath, readEnvironment, serializeEnvironment } from '../env/files.mjs'
ensureEnvironmentFiles()
const local = localClients()
const publicEnv = { VITE_APP_MODE: 'demo', VITE_APP_ENV: 'local', VITE_SUPABASE_URL: local.url, VITE_SUPABASE_PUBLISHABLE_KEY: local.key, VITE_SUPABASE_PROJECT_REF: '' }
// Preserve provider secrets and unrelated settings; never copy the service key.
const file = environmentPath('test')
await writeFile(file, serializeEnvironment({ ...readEnvironment('test', {}), ...publicEnv,
  APP_ENV: 'local', APP_ORIGIN: 'http://127.0.0.1:5174' }), { mode: 0o600 })
await chmod(file, 0o600)
await import('./fixtures.mjs')
console.log('.env.test preparado para o Supabase local. Rode npm run dev:sandbox e npm run functions:serve em terminais separados.')
