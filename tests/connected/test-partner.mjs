import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { localClients, login } from '../../scripts/dev/local.mjs'
import { verifiedSessionId } from '../../supabase/functions/_shared/staff-access.ts'
import { createTestPartner } from '../../supabase/functions/_shared/test-partner.ts'
const local=localClients()
const admin=await login(local,'admin@rkmed.test')
const actor='00000000-0000-4000-8000-000000000005'
const session=verifiedSessionId((await admin.auth.getSession()).data.session.access_token)
const body={ name:'Parceiro sintético '+randomUUID(),segment:'Academia',address:'Rua de teste, 100, Recife',discountBps:2000,email:`test-partner-${randomUUID()}@rkmed.test`,password:'Synthetic-password-2026!',employeeName:'Funcionário sintético',employeeCode:'468246',operationId:randomUUID() }
function sql(input){return execFileSync('docker',['exec','-i','supabase_db_rkmed','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tA'],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
let partnerId,authUser
try {
 await admin.rpc('rk_context')
 // Simulate a lost/failed finalization after a real Auth commit. Recovery must
 // keep that exact identity blocked and then reuse it, without another account.
 const failing={auth:local.service.auth,rpc:(name,args)=>name==='rk_backend_test_partner_finish'?Promise.resolve({error:{code:'NETWORK',message:'Synthetic failure'}}):local.service.rpc(name,args)}
 await assert.rejects(()=>createTestPartner(failing,actor,session,body,'local'))
 const pending=local.client();assert.equal((await pending.auth.signInWithPassword({email:body.email,password:body.password})).error,null)
 assert.match((await pending.rpc('rk_context')).error.message,/em andamento/)
 assert.equal(sql(`select count(*) from private.partners where name='${body.name}';`),'0')
 await pending.auth.signOut({scope:'local'})
 // Concurrent requests share one reservation; a busy loser can safely retry.
 const attempts=await Promise.allSettled([createTestPartner(local.service,actor,session,body,'local'),createTestPartner(local.service,actor,session,body,'local')])
 assert.ok(attempts.some(a=>a.status==='fulfilled'))
 const result=await createTestPartner(local.service,actor,session,body,'local');partnerId=result.partnerId
 assert.equal(result.isTest,true);assert.match(result.establishmentCode,/^[A-Z0-9]{10}$/)
 const listing=await admin.rpc('rk_staff_accounts',{p_query:body.email});assert.equal(listing.error,null);authUser=listing.data.items[0].id;assert.equal(listing.data.items[0].isTest,true)
 const publicList=await local.client().rpc('rk_partners');assert.equal(publicList.error,null);assert.ok(!publicList.data.some(p=>p.id===partnerId))
 const partner=local.client();assert.equal((await partner.auth.signInWithPassword({email:body.email,password:body.password})).error,null)
 const context=await partner.rpc('rk_context');assert.equal(context.error,null);assert.equal(context.data.partner.name,body.name);assert.equal(context.data.partner.isTest,true)
 const wrong=await partner.rpc('rk_start_work',{p_code:body.employeeCode,p_establishment_code:'INVALID000'});assert.ok(wrong.data.error)
 const work=await partner.rpc('rk_start_work',{p_code:body.employeeCode,p_establishment_code:result.establishmentCode});assert.equal(work.error,null);assert.equal(work.data.workSession.employeeName,body.employeeName)
 const member=await login(local,'ana@rkmed.test');assert.ok(!(await member.rpc('rk_partners')).data.some(p=>p.id===partnerId));await member.auth.signOut({scope:'local'})
 const support=await login(local,'suporte@rkmed.test');const supportSession=verifiedSessionId((await support.auth.getSession()).data.session.access_token)
 await assert.rejects(()=>createTestPartner(local.service,'00000000-0000-4000-8000-000000000006',supportSession,{...body,email:'other-'+body.email,operationId:randomUUID()},'local'));await support.auth.signOut({scope:'local'})
 assert.equal(sql(`select count(*) from private.partners where id='${partnerId}';`),'1')
 assert.equal(sql(`select count(*) from private.audit where action='partner.test.created' and target_id='${partnerId}';`),'1')
 assert.equal(sql(`select details::text like '%${body.password}%' from private.test_partner_operations where email='${body.email}';`),'f')
 await partner.auth.signOut({scope:'local'})
 console.log('PASS: cadastro real, concorrência/replay, diretório oculto, login, contexto e turno com os dois códigos; suporte negado.')
} finally {
 const found=sql(`select auth_user_id from private.test_partner_operations where email='${body.email}';`)
 if(found){authUser=found;partnerId=sql(`select partner_id from private.roles where user_id='${authUser}';`)
 sql(`delete from private.work_sessions where user_id='${authUser}'; delete from private.roles where user_id='${authUser}';${partnerId?`delete from private.employees where partner_id='${partnerId}';delete from private.partners where id='${partnerId}';`:''}delete from private.test_partner_operations where email='${body.email}';`)
 assert.equal((await local.service.auth.admin.deleteUser(authUser)).error,null)}
 await admin.auth.signOut({scope:'local'})
}
