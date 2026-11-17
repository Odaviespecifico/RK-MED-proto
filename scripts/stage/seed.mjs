import { execFileSync } from 'node:child_process'
import { randomBytes, randomInt } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { readEnvironment, serializeEnvironment } from '../env/files.mjs'

export const stageRef = 'wfgiokooedjalmvqgbub'
const root = fileURLToPath(new URL('../../', import.meta.url))
const env = readEnvironment('stage', {}, root)
if (env.VITE_SUPABASE_PROJECT_REF !== stageRef || env.VITE_SUPABASE_URL !== `https://${stageRef}.supabase.co` || env.APP_ENV !== 'sandbox') throw Error('O destino deve ser exclusivamente o projeto stage aprovado.')
const mode = process.argv[2] || '--prepare'
if (!['--prepare', '--check-local', '--apply'].includes(mode)) throw Error('Use --prepare, --check-local ou --apply.')
const directory = resolve(root, '.local')
mkdirSync(directory, { recursive: true, mode: 0o700 })
function cli(args) {
  try { return execFileSync('npx', ['--no-install', 'supabase', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 }) }
  catch (error) { writeFileSync(resolve(directory, 'stage-fixtures-error.log'), String(error.stderr || error.message), { mode: 0o600 }); throw Error('Operação cancelada; detalhes em .local/stage-fixtures-error.log.') }
}
if (mode === '--apply') {
  const before = JSON.parse(cli(['db', 'query', '--linked', '--project-ref', stageRef, "select (select value from private.settings where key='environment') as environment,exists(select 1 from private.bootstrap_metadata where key='stage-fixtures-v1') as loaded", '-o', 'json'])).rows[0]
  if (before.environment !== 'sandbox') throw Error('O banco não está configurado como sandbox.')
  if (before.loaded) { console.log('stage-fixtures-v1 já aplicada. Nenhum dado ou senha foi alterado.'); process.exit(0) }
}
const manifestPath = resolve(directory, 'stage-fixtures-manifest.json')
let manifest
if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
else {
  const password = 'Stage-' + randomBytes(30).toString('base64url')
  const passwordHash = execFileSync('python3', ['-W', 'ignore::DeprecationWarning', '-c', 'import crypt,sys; print(crypt.crypt(sys.stdin.read(),crypt.mksalt(crypt.METHOD_BLOWFISH,rounds=2**10)))'], { input: password, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  if (!/^\$2[aby]\$/.test(passwordHash)) throw Error('Hash BCrypt indisponível.')
  const used = new Map(), codes = []
  for (let i = 1; i <= 276; i++) {
    const partner = i <= 240 ? Math.floor((i - 1) / 4) + 1 : 1
    const own = used.get(partner) || new Set()
    let code
    do { code = String(randomInt(10000)).padStart(4, '0') } while (own.has(code))
    own.add(code); used.set(partner, own); codes.push(code)
  }
  manifest = { projectRef: stageRef, dataset: 'stage-fixtures-v1', password, passwordHash, codes }
  writeFileSync(manifestPath, JSON.stringify(manifest), { mode: 0o600, flag: 'wx' })
}
if (manifest.projectRef !== stageRef || manifest.dataset !== 'stage-fixtures-v1' || manifest.codes.length !== 276) throw Error('Manifesto privado pertence a outra carga.')
let sql = readFileSync(new URL('./fixtures.sql', import.meta.url), 'utf8').replaceAll('{{PASSWORD_HASH}}', manifest.passwordHash).replaceAll('{{EMPLOYEE_CODES}}', JSON.stringify(manifest.codes))
const sqlPath = resolve(directory, 'stage-fixtures-generated.sql')
writeFileSync(sqlPath, sql, { mode: 0o600 })
const accessPath = resolve(directory, 'stage-fixtures-access.env')
const savedAccess = existsSync(accessPath) ? parseEnv(readFileSync(accessPath, 'utf8')) : {}
if (savedAccess.PROJECT_REF && savedAccess.PROJECT_REF !== stageRef) throw Error('Acessos privados pertencem a outro projeto.')
writeFileSync(accessPath, serializeEnvironment({ ...savedAccess, PROJECT_REF: stageRef, ADMIN_EMAIL: 'admin@stage.rkmed.invalid', MEMBER_EMAIL: 'cliente.001@stage.rkmed.invalid', PARTNER_EMAIL: 'parceiro.001@stage.rkmed.invalid', FIXTURE_PASSWORD: manifest.password, FIRST_EMPLOYEE_CODE: manifest.codes[0] }), { mode: 0o600 })
if (mode === '--check-local') {
  sql = sql.replace('begin;\n', "begin;\nupdate private.settings set value='sandbox' where key='environment';\n").replace(/commit;\s*$/, 'rollback;\n')
  const probe = resolve(directory, 'stage-fixtures-local-probe.sql'); writeFileSync(probe, sql, { mode: 0o600 })
  const status = JSON.parse(cli(['status', '-o', 'json']))
  const url = new URL(status.DB_URL)
  if (url.hostname !== '127.0.0.1' || url.port !== '54322') throw Error('A validação deve usar somente o PostgreSQL Docker local.')
  try {
    const result = execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-q', '-f', probe], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port, PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: url.pathname.slice(1) }, timeout: 180000 })
    console.log('Validação local com rollback:', result.trim())
  } catch (error) { writeFileSync(resolve(directory, 'stage-fixtures-error.log'), String(error.stderr || error.message), { mode: 0o600 }); throw Error('Validação cancelada; consulte .local/stage-fixtures-error.log.') }
} else if (mode === '--apply') {
  const result = JSON.parse(cli(['db', 'query', '--linked', '--project-ref', stageRef, '--file', sqlPath, '-o', 'json']))
  console.log('Carga aplicada ao stage:', JSON.stringify(result.rows))
} else console.log('Carga preparada em .local/stage-fixtures-generated.sql; use --check-local antes de --apply.')
console.log('Acessos fictícios em .local/stage-fixtures-access.env. Senhas e códigos não são versionados.')
