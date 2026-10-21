import { createHash, randomInt, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fixturePassword, localClients, login } from './local.mjs'

// Test-only fixtures. Never accepts a database URL or a remote project/container.
export async function scaleFixture({ members = 2000, purchases = 10000, history = 60 } = {}) {
  if (![members, purchases, history].every(Number.isSafeInteger) || members < 30 || members > 9999 || purchases < 30 || purchases > 100000 || history < 0 || history > 1000) throw new Error('Volume de fixture inválido.')
  const local = localClients()
  const run = randomUUID()
  const prefix = 'Escala ' + run.slice(0, 8)
  const cpfPrefix = String(randomInt(1000000, 9999999))
  const sql = statement => execFileSync('docker', ['exec', '-i', 'supabase_db_rkmed', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'], { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  if (sql("select value from private.settings where key='environment'") !== 'local') throw new Error('Fixture permitida somente no Docker local.')
  const uuid = (kind, number) => {
    const hex = createHash('md5').update(`${run}:${kind}:${number}`).digest('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  const actors = [], clients = []
  let memberId
  async function cleanup() {
    await Promise.allSettled(clients.map(client => client.auth.signOut({ scope: 'local' })))
    const photoRemoval = memberId ? await local.service.storage.from('member-photos').remove([memberId + '/photo.jpg']) : null
    const ids = actors.map(actor => `'${actor.id}'`).join(',') || 'null'
    const memberSelection = `id in (select md5('${run}:member:'||i)::uuid from generate_series(2,${members}) i)${memberId ? ` or id='${memberId}'` : ''}`
    // This connection alone bypasses immutable-record triggers to remove generated test rows.
    // The predicates are tied to this random run and its newly created Auth users. Never reset seed/user data.
    sql(`begin;
      set local session_replication_role=replica;
      create temporary table scale_cleanup_members as select id from private.members where ${memberSelection};
      delete from private.reversals where purchase_id in (select id from private.purchases where member_id in (select id from scale_cleanup_members));
      delete from private.purchases where member_id in (select id from scale_cleanup_members);
      delete from private.validations where member_id in (select id from scale_cleanup_members);
      delete from private.notification_outbox where member_id in (select id from scale_cleanup_members);
      delete from private.audit where actor_id in (${ids});
      delete from private.credentials where member_id in (select id from scale_cleanup_members);
      delete from private.consents where member_id in (select id from scale_cleanup_members);
      delete from private.subscriptions where member_id in (select id from scale_cleanup_members);
      delete from private.member_identity where member_id in (select id from scale_cleanup_members);
      delete from private.roles where user_id in (select id from scale_cleanup_members) or user_id in (${ids});
      delete from private.members where id in (select id from scale_cleanup_members);
      delete from private.employees where partner_id in ('${uuid('partner', 1)}','${uuid('partner', 2)}');
      delete from private.partners where id in ('${uuid('partner', 1)}','${uuid('partner', 2)}');
      delete from auth.users where id in (select id from scale_cleanup_members) and id not in (${ids});
      set local session_replication_role=origin;
      update public.rk_operational_signal set revision=revision+1,changed_at=now() where id=1;
      analyze private.members; analyze private.purchases; analyze private.subscriptions;
      commit;`)
    for (const actor of actors) {
      const removed = await local.service.auth.admin.deleteUser(actor.id)
      if (removed.error) throw new Error('Não foi possível remover uma identidade sintética da fixture.')
    }
    if (photoRemoval?.error) throw new Error('Não foi possível remover a foto sintética da fixture.')
    if (sql(`select count(*) from private.members where ${memberSelection}`) !== '0') throw new Error('Limpeza incompleta da fixture.')
  }
  try {
    for (const role of ['member', 'partner1', 'partner2']) {
      const email = `${role}-${run}@rkmed.test`
      const { data, error } = await local.service.auth.admin.createUser({ email, password: fixturePassword, email_confirm: true })
      if (error || !data.user) throw new Error('Não foi possível criar a identidade sintética local.')
      actors.push({ id: data.user.id, email, role })
    }
    memberId = actors[0].id
    sql(`begin;
      insert into private.partners(id,name,segment,address,discount_bps) values
        ('${uuid('partner', 1)}','${prefix} Parceiro 1','Testes','Fixture local',2000),
        ('${uuid('partner', 2)}','${prefix} Parceiro 2','Testes','Fixture local',1000);
      insert into private.employees(id,partner_id,name,code_hash) values
        ('${uuid('employee', 1)}','${uuid('partner', 1)}','Funcionário escala 1',extensions.crypt('2468',extensions.gen_salt('bf',6))),
        ('${uuid('employee', 2)}','${uuid('partner', 2)}','Funcionário escala 2',extensions.crypt('1357',extensions.gen_salt('bf',6)));
      insert into auth.users(id,email) select md5('${run}:member:'||i)::uuid,'scale-${run}-'||i||'@rkmed.test' from generate_series(2,${members}) i;
      insert into private.members(id,name,birth_date,created_at,photo_path)
      select case when i=1 then '${memberId}'::uuid else md5('${run}:member:'||i)::uuid end,
        '${prefix} '||lpad(i::text,4,'0'),'1990-01-01','2030-01-01',case when i=1 then '${memberId}/photo.jpg' end from generate_series(1,${members}) i;
      insert into private.member_identity(member_id,cpf) select id,'${cpfPrefix}'||right(name,4) from private.members where name like '${prefix} %';
      insert into private.subscriptions(member_id,state,paid_through) select id,
        case when id='${memberId}' then 'active' when right(name,4)::integer%3=0 then 'past_due' else 'incomplete' end,now()+interval '30 days'
        from private.members where name like '${prefix} %';
      insert into private.roles(user_id,role) select id,'member' from private.members where name like '${prefix} %';
      insert into private.roles(user_id,role,partner_id) values
        ('${actors[1].id}','partner','${uuid('partner', 1)}'),('${actors[2].id}','partner','${uuid('partner', 2)}');
      do $$ declare token text:=encode(extensions.gen_random_bytes(32),'hex'); begin
        insert into private.credentials(member_id,token_hash,encrypted_token) values('${memberId}',extensions.digest(token,'sha256'),extensions.pgp_sym_encrypt(token,(select value from private.settings where key='qr_key')));
      end $$;
      with receipts as (
        insert into private.validations(id,member_id,session_id,employee_id,partner_id,consumed_at)
        select md5('${run}:receipt:'||i)::uuid,
          case when i>${purchases} or (i-1)%${members}=0 then '${memberId}'::uuid else md5('${run}:member:'||((i-1)%${members}+1))::uuid end,
          gen_random_uuid(),case when i%2=1 then '${uuid('employee', 1)}'::uuid else '${uuid('employee', 2)}'::uuid end,
          case when i%2=1 then '${uuid('partner', 1)}'::uuid else '${uuid('partner', 2)}'::uuid end,now()
        from generate_series(1,${purchases + history}) i returning *
      ) insert into private.purchases(operation_id,receipt_id,member_id,partner_id,employee_id,employee_name,actor_id,gross_cents,discount_bps,discount_cents,final_cents,created_at)
        select gen_random_uuid(),id,member_id,partner_id,employee_id,'TESTE de escala','${actors[1].id}',10000,2000,2000,8000,'2030-01-01' from receipts;
      analyze private.members; analyze private.purchases; analyze private.subscriptions;
      commit;`)
    const photo = await local.service.storage.from('member-photos').upload(memberId + '/photo.jpg', await readFile('tests/fixtures/face-portrait.jpg'), { contentType: 'image/jpeg', upsert: true })
    if (photo.error) throw new Error('Foto sintética não foi carregada.')
    for (const actor of actors) clients.push(await login(local, actor.email))
    return { local, run, prefix, memberId, memberEmail: actors[0].email, cpf: cpfPrefix + '0001', actors, clients, sql, uuid, members, purchases: purchases + history, cleanup }
  } catch (error) { await cleanup(); throw error }
}
