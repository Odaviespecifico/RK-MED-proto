import test from 'node:test'
import assert from 'node:assert/strict'
import { createTestPartner } from '../../supabase/functions/_shared/test-partner.ts'
const actor='a0000000-0000-4000-8000-000000000001',session='a0000000-0000-4000-8000-000000000002',operation='a0000000-0000-4000-8000-000000000003',user='a0000000-0000-4000-8000-000000000004'
const body={ name:'Estabelecimento',segment:'Academia',address:'Endereço de teste',discountBps:2000,email:'test@example.invalid',password:'Synthetic-only-password-2026!',employeeName:'Funcionário',employeeCode:'2468',operationId:operation }
const result={partnerId:'partner',name:body.name,email:body.email,employeeName:body.employeeName,establishmentCode:'ABC1234567',isTest:true}
function dbMock({status='pending',existing=false,createError=false,finishError=false}={}){
 const calls=[];let exists=existing
 const identity={id:user,email:body.email,app_metadata:{rkmed_test_partner_operation:operation}}
 return {calls,rpc:async(name,args)=>{calls.push([name,args]);if(name.endsWith('_begin'))return{data:status==='succeeded'?{status,result}:status==='busy'?{status}:{status,operationId:operation,authUserId:user}};if(name.endsWith('_finish'))return finishError?{error:{code:'NETWORK',message:body.password}}:{data:result};return{data:null}},auth:{admin:{getUserById:async id=>{calls.push(['get',id]);return exists?{data:{user:identity},error:null}:{data:{user:null},error:{status:404}}},createUser:async args=>{calls.push(['create',args]);exists=true;return createError?{data:{user:null},error:{message:body.password}}:{data:{user:identity},error:null}}}}}
}
test('test partner refuses production and malformed input before backend calls',async()=>{
 const db=dbMock();await assert.rejects(()=>createTestPartner(db,actor,session,body,'production'),/indisponível/)
 await assert.rejects(()=>createTestPartner(db,actor,session,{...body,employeeCode:'bad'},'sandbox'),/código/);assert.equal(db.calls.length,0)
})
test('provisioning reserves before Auth and keeps credentials out of the journal payload',async()=>{
 const db=dbMock();assert.deepEqual(await createTestPartner(db,actor,session,body,'sandbox'),result)
 assert.deepEqual(db.calls.map(c=>c[0]),['rk_backend_test_partner_begin','get','create','rk_backend_test_partner_finish','rk_backend_test_partner_release'])
 const create=db.calls.find(c=>c[0]==='create')[1];assert.equal(create.id,user);assert.equal(create.password,body.password)
 assert.equal(create.app_metadata.rkmed_test_partner_operation,operation)
 assert.ok(!JSON.stringify(db.calls.filter(c=>c[0].startsWith('rk_'))).includes(body.password))
 assert.ok(!('employeeCode' in db.calls[0][1].p_details))
})
test('completed and concurrent operations never create duplicate Auth identities',async()=>{
 const done=dbMock({status:'succeeded'});assert.deepEqual(await createTestPartner(done,actor,session,body,'sandbox'),result);assert.equal(done.calls.length,1)
 const busy=dbMock({status:'busy'});await assert.rejects(()=>createTestPartner(busy,actor,session,body,'sandbox'),/andamento/);assert.equal(busy.calls.length,1)
})
test('an uncertain Auth response reconciles only the reserved user ID',async()=>{
 const db=dbMock({createError:true});assert.deepEqual(await createTestPartner(db,actor,session,body,'sandbox'),result);assert.equal(db.calls.filter(c=>c[0]==='get').length,2)
 const resumed=dbMock({existing:true});assert.deepEqual(await createTestPartner(resumed,actor,session,body,'sandbox'),result);assert.ok(!resumed.calls.some(c=>c[0]==='create'))
})
test('failed finalization is redacted and releases only its lease without deleting Auth',async()=>{
 const db=dbMock({finishError:true});await assert.rejects(()=>createTestPartner(db,actor,session,body,'sandbox'),e=>!e.message.includes(body.password))
 assert.equal(db.calls.at(-1)[0],'rk_backend_test_partner_release')
})
test('administrator denial occurs before Auth access',async()=>{
 const db=dbMock();db.rpc=async()=>({error:{code:'42501',message:'Acesso negado'}})
 await assert.rejects(()=>createTestPartner(db,actor,session,body,'sandbox'));assert.equal(db.calls.length,0)
})
