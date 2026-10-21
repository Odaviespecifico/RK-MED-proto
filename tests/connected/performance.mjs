import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { cpus, platform } from 'node:os'
import { scaleFixture } from '../../scripts/dev/scale-fixture.mjs'
import { login } from '../../scripts/dev/local.mjs'

const fixture = await scaleFixture()
const readers = []
const timings = { pages: [], lookups: [], quotes: [], commits: [] }
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(`${name}: ${error.code || 'request-failed'}`)
  if (data?.error) throw new Error(`${name}: request-rejected`)
  return data
}
async function measured(group, action) {
  const start = performance.now()
  try { return await action() } finally { timings[group].push(performance.now() - start) }
}
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return { requests: values.length, p50Ms: +sorted[Math.ceil(sorted.length * .5) - 1].toFixed(2), p95Ms: +sorted[Math.ceil(sorted.length * .95) - 1].toFixed(2), maxMs: +sorted.at(-1).toFixed(2) }
}
async function checkedAll(tasks) {
  const results = await Promise.allSettled(tasks)
  const failed = results.find(r => r.status === 'rejected')
  if (failed) throw failed.reason
  return results.map(r => r.value)
}
let result
try {
  const [member, partner1, partner2] = fixture.clients
  const viewer = await login(fixture.local, 'diretoria@rkmed.test'); readers.push(viewer)
  const first = await rpc(viewer, 'rk_members_page', { p_query: fixture.prefix })
  const secondArgs = { p_query: fixture.prefix, p_at: first.nextCursor.at, p_id: first.nextCursor.id }
  const own = await rpc(member, 'rk_purchases_page', { p_savings: true })
  assert.equal(first.items.length, 25); assert.equal(own.items.length, 25)
  assert.ok(first.items.every(m => m.email === null && m.phone === null))
  const tasks = [
    () => rpc(viewer, 'rk_members_page', { p_query: fixture.prefix }),
    () => rpc(viewer, 'rk_members_page', secondArgs),
    () => rpc(viewer, 'rk_members_page', { p_query: fixture.prefix, p_past_due: true }),
    () => rpc(member, 'rk_purchases_page', { p_savings: true }),
  ]
  for (let i = 0; i < 8; i++) await tasks[i % tasks.length]()
  let index = 0
  await checkedAll(Array.from({ length: 10 }, async () => {
    while (index < 200) { const current = index++; const page = await measured('pages', tasks[current % tasks.length]); assert.ok(page.items.length <= 25) }
  }))
  await rpc(partner1, 'rk_start_work', { p_code: '2468' })
  await rpc(partner2, 'rk_start_work', { p_code: '1357' })
  const requests = Array.from({ length: 50 }, (_, i) => ({ client: i % 2 ? partner1 : partner2, operation: crypto.randomUUID() }))
  const receipts = await checkedAll(requests.map(r => measured('lookups', () => rpc(r.client, 'rk_validate_member', { p_lookup: fixture.cpf, p_method: 'cpf' }))))
  const quotes = await checkedAll(requests.map((r, i) => measured('quotes', () => rpc(r.client, 'rk_quote', { p_receipt: receipts[i].receipt, p_gross: 10000 }))))
  const commits = await checkedAll(requests.map((r, i) => measured('commits', () => rpc(r.client, 'rk_commit_purchase', { p_receipt: receipts[i].receipt, p_gross: quotes[i].grossCents, p_quote_bps: quotes[i].discountBps, p_operation: r.operation }))))
  assert.equal(new Set(commits.map(c => c.id)).size, 50)
  assert.ok(commits.every(c => !c.duplicate))
  const after = await rpc(member, 'rk_purchases_page', { p_savings: true })
  assert.equal(BigInt(after.savingsCents) - BigInt(own.savingsCents), 75000n)
  const summary = Object.fromEntries(Object.entries(timings).map(([name, values]) => [name, stats(values)]))
  result = {
    measuredAt: new Date().toISOString(), environment: 'Supabase Docker local on loopback; no external provider calls',
    machine: { platform: platform(), cpu: cpus()[0]?.model, logicalCpus: cpus().length },
    dataset: { syntheticMembers: fixture.members, syntheticPurchasesBefore: fixture.purchases },
    methodology: { warmupRequests: 8, pageRequests: 200, pageConcurrency: 10, concurrentDistinctCommits: 50, partnerSessions: 2 },
    results: summary,
    targets: { apiP95Ms: 500, lookupP95Ms: 2000 },
    targetsMetLocally: Object.values(summary).every(value => value.p95Ms <= 500) && summary.lookups.p95Ms <= 2000,
    limits: 'Local warm benchmark. Does not establish hosted SLA, internet/mobile latency, cold starts or external provider behavior.',
  }
} finally {
  await Promise.allSettled(readers.map(client => client.auth.signOut({ scope: 'local' })))
  await fixture.cleanup()
}
result.generatedFixtureRemoved = true
await writeFile('docs/performance-local.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
if (!result.targetsMetLocally) process.exitCode = 1
