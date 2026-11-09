// Real local PostgreSQL connections contend for the same durable money operation.
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const database = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
function sql(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', [database, '-XAt', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] })
    let output = '', error = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { error += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(error)))
    child.stdin.end(statement)
  })
}
const invoice = `in_Concurrency${randomUUID().replaceAll('-', '')}`
const claims = [randomUUID(), randomUUID()]
try {
  await sql(`insert into private.wedea_shares(invoice_id,member_id,customer_id,subscription_id,active_members,paid_amount,amount_cents,status)
    values('${invoice}','00000000-0000-4000-8000-000000000001','cus_Concurrency','sub_Concurrency',201,6990,1587,'pending');`)
  const results = await Promise.all(claims.map(owner => sql(`begin;
    set local request.jwt.claims='{"role":"service_role"}';
    select public.rk_wedea_claim('${invoice}','${owner}','acct_Wedea','ch_Concurrency',true) is not null;
    select pg_sleep(0.2);
    commit;`)))
  assert.equal(results.filter(result => result.split('\n').includes('t')).length, 1)
  assert.equal(results.filter(result => result.split('\n').includes('f')).length, 1)
  assert.equal(await sql(`select count(*) from private.wedea_shares where invoice_id='${invoice}' and status='sending' and first_attempt_at is not null;`), '1')
  console.log('Wedea: two concurrent PostgreSQL workers produced exactly one transfer reservation.')
} finally {
  // Removes only this script's uniquely named synthetic ledger fixture, never member data.
  await sql(`delete from private.wedea_shares where invoice_id='${invoice}';`)
}
