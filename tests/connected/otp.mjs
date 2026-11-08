import assert from 'node:assert/strict'
import { localClients } from '../../scripts/dev/local.mjs'
import { createOtpService } from '../../supabase/functions/_shared/otp-service.ts'
import { startMemberSession } from '../../supabase/functions/_shared/session-bridge.ts'
const local=localClients()
const client=local.client()
const rpc=async(name,args)=>{const {data,error}=await local.service.rpc(name,args);assert.equal(error,null,`${name}: ${error?.code}`);return data}
let capturedCode
const service=createOtpService(crypto.randomUUID()+crypto.randomUUID(),{
 identity:(contact,channel)=>rpc('rk_otp_identity',{p_contact:contact,p_channel:channel}),
 begin:a=>rpc('rk_otp_begin',{p_id:a.id,p_contact_hash:a.contactHash,p_channel:a.channel,p_purpose:a.purpose,p_user:a.userId,p_actor:a.actorId,p_code_hash:a.codeHash}),
 delivered:(id,provider,success)=>rpc('rk_otp_sent',{p_id:id,p_provider:provider,p_success:success}),
 consume:a=>rpc('rk_otp_consume',{p_id:a.id,p_contact_hash:a.contactHash,p_channel:a.channel,p_purpose:a.purpose,p_actor:a.actorId,p_code_hash:a.codeHash}),
 send:async(_channel,_contact,code)=>{capturedCode=code;return 'synthetic-delivery'},
 complete:({identity})=>startMemberSession(local.service,client,identity),
})
try{
 const challenge=await service.request('ana@rkmed.test','email','login',null)
 await assert.rejects(()=>service.verify(challenge.challengeId,'ana@rkmed.test','email','login',null,capturedCode==='000000'?'111111':'000000'))
 const result=await service.verify(challenge.challengeId,'ana@rkmed.test','email','login',null,capturedCode)
 assert.ok(result.session.access_token);assert.ok(result.session.refresh_token)
 const context=await client.rpc('rk_context');assert.equal(context.error,null);assert.equal(context.data.role,'member')
 assert.equal(context.data.userId,result.userId)
 await assert.rejects(()=>service.verify(challenge.challengeId,'ana@rkmed.test','email','login',null,capturedCode))
 console.log('PASS: RKMED code validates against real local DB, exchanges the verified identity for a persistent managed session, and rejects replay. No external delivery.')
}finally{await client.auth.signOut()}
