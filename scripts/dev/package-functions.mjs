import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// MCP accepts text files. Embed the unchanged model bytes as a source module;
// sanitizePhoto retains exactly the same validation and injected asset reader.
const root = path.resolve(fileURLToPath(new URL('../../supabase/functions/', import.meta.url)))
const output = process.argv[2]
const testOrigin = process.argv[3]
if (testOrigin) {
  const url = new URL(testOrigin)
  if (url.protocol !== 'https:' || url.origin !== testOrigin) throw new Error('Use uma origem HTTPS sem caminho ou barra final.')
}
if (!output) throw new Error('Informe um diretório de saída fora de supabase/functions.')
const target = path.resolve(output)
if (target === root || target.startsWith(root + path.sep)) throw new Error('Não grave pacotes dentro das funções de origem.')
const shared = []
async function collect(dir) {
  for (const item of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, item.name)
    if (item.isDirectory()) await collect(relative)
    else if (item.name.endsWith('.ts')) shared.push({ name: relative, content: await readFile(path.join(root, relative), 'utf8') })
  }
}
await collect('_shared')
const manifest = await readFile(path.join(root, '_shared/models/model.json'), 'utf8')
const weights = await readFile(path.join(root, '_shared/models/group1-shard1of1.bin'))
const encoded = weights.toString('base64')
if (!Buffer.from(encoded, 'base64').equals(weights)) throw new Error('Model encoding mismatch')
const assets = { name: '_shared/model-assets.ts', content: `// Generated from the versioned model; no external model requests.\nconst manifest = ${JSON.stringify(manifest)}\nconst weights = ${JSON.stringify(encoded)}\nexport async function readModelAsset(url: URL): Promise<Uint8Array> {\n  if (url.pathname.endsWith('/models/model.json')) return new TextEncoder().encode(manifest)\n  if (url.pathname.endsWith('/models/group1-shard1of1.bin')) return Uint8Array.from(atob(weights), c => c.charCodeAt(0))\n  throw new Error('Unknown model asset')\n}\n` }
const config = { name: 'deno.json', content: await readFile(path.join(root, 'deno.json'), 'utf8') }
await mkdir(target, { recursive: true })
for (const original of ['rkmed-api','stripe-webhook','phone-code','auth-sms','auth-email','provider-jobs']) {
  const name = original === 'stripe-webhook' ? 'rkmed-stripe-webhook' : original
  let content = await readFile(path.join(root, original, 'index.ts'), 'utf8')
  if (testOrigin) {
    const environment = 'const env = Deno.env.toObject()'
    if (content.split(environment).length !== 2) throw new Error('Environment reader changed; review packager')
    // Public sandbox routing only. Provider secrets stay in Supabase secrets.
    content = content.replace(environment, `const env = { ...Deno.env.toObject(), APP_ENV: 'sandbox', APP_ORIGIN: ${JSON.stringify(testOrigin)} }`)
  }
  const files = [config, ...shared]
  if (original === 'rkmed-api') {
    const reader = 'path => Deno.readFile(path)'
    if (content.split(reader).length !== 2) throw new Error('Asset reader changed; review packager')
    content = `import { readModelAsset } from '../_shared/model-assets.ts'\n` + content.replace(reader, 'readModelAsset')
    files.push(assets)
  }
  files.push({ name: `${name}/index.ts`, content })
  const payload = { name, entrypoint_path: `${name}/index.ts`, import_map_path: 'deno.json', verify_jwt: false, files }
  await writeFile(path.join(target, `${name}.json`), JSON.stringify(payload), { mode: 0o600 })
  console.log(`${name}: ${files.length} arquivos preparados`)
}
