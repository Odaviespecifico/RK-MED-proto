import test from 'node:test'
import assert from 'node:assert/strict'
import { generateOtp, otpDigest } from '../../supabase/functions/_shared/otp-crypto.ts'
import { createOtpService } from '../../supabase/functions/_shared/otp-service.ts'
import { createSmsDev } from '../../supabase/functions/_shared/providers/smsdev.ts'

const id='a0000000-0000-4000-8000-000000000001'
const env={APP_ENV:'sandbox',SMSDEV_MODE:'test',SMSDEV_API_KEY:'private-key',SMS_ALLOWED_TEST_NUMBERS:'+5581999990001'}
test('SMS Dev sends one short message in a POST body and retains the accepted message id', async()=>{
 let calls=0
 const sms=createSmsDev(env,async(url,opts)=>{
  calls++; assert.equal(url,'https://api.smsdev.com.br/v1/send');assert.equal(opts.method,'POST');assert.equal(opts.redirect,'error')
  const [body]=JSON.parse(opts.body);assert.equal(body.key,'private-key');assert.equal(body.type,9);assert.equal(body.number,5581999990001);assert.equal(body.refer,id);assert.ok(body.msg.length<=160);assert.ok(body.msg.includes('123456'))
  return new Response(JSON.stringify([{situacao:'OK',codigo:'1',id:'12345',descricao:'MENSAGEM NA FILA'}]))
 })
 assert.deepEqual(await sms.sendCode('+5581999990001','123456',id),{messageId:'12345'});assert.equal(calls,1)
})
test('SMS Dev rejects disabled/unlisted destinations, API errors and timeouts without retry or leaking credentials',async()=>{
 let calls=0
 const transport=async()=>{calls++;return new Response(JSON.stringify({situacao:'ERRO',codigo:'9',descricao:'private-key'}))}
 await assert.rejects(()=>createSmsDev({},transport).sendCode('+5581999990001','123456',id));assert.equal(calls,0)
 await assert.rejects(()=>createSmsDev(env,transport).sendCode('+5581999990002','123456',id));assert.equal(calls,0)
 await assert.rejects(()=>createSmsDev(env,transport).sendCode('+5581999990001','123456',id),e=>!e.message.includes('private-key'));assert.equal(calls,1)
 calls=0;await assert.rejects(()=>createSmsDev(env,async()=>{calls++;throw Error('private-key')}).sendCode('+5581999990001','123456',id),e=>!e.message.includes('private-key'));assert.equal(calls,1)
 for(const body of [[],[{situacao:'OK',codigo:'1'}],{situacao:'OK',codigo:'0',id:123},[{situacao:'OK',codigo:'1',id:1},{situacao:'OK',codigo:'1',id:2}]]) await assert.rejects(()=>createSmsDev(env,async()=>new Response(JSON.stringify(body))).sendCode('+5581999990001','123456',id))
})
test('RKMED code generation uses rejection sampling and HMAC binds code to its challenge',async()=>{
 let count=0;assert.equal(generateOtp(a=>{a[0]=count++===0?4294967295:42;return a}),'000042');assert.equal(count,2)
 const secret='x'.repeat(40)
 assert.notEqual(await otpDigest(secret,id,'123456'),await otpDigest(secret,'other','123456'))
 await assert.rejects(()=>otpDigest('short',id,'123456'))
})
function harness({known=true,failSend=false}={}){
 const challenges=new Map();let sent;let completions=0
 const identity={id:'member',email:'m@example.invalid',emailVerified:true,phoneVerified:true}
 const service=createOtpService('secret'.repeat(8),{
  identity:async()=>known?identity:null,
  begin:async args=>{challenges.set(args.id,{...args,status:'sending'});return true},
  delivered:async(id,provider,success)=>Object.assign(challenges.get(id),{status:success?'sent':'failed',provider}),
  send:async(channel,to,code,id)=>{sent={channel,to,code,id};if(failSend)throw Error('secret');return 'provider-id'},
  consume:async args=>{const c=challenges.get(args.id);if(!c||c.status!=='sent'||c.codeHash!==args.codeHash||c.contactHash!==args.contactHash||c.purpose!==args.purpose||c.actorId!==args.actorId)return null;c.status='used';return {userId:c.userId}},
  complete:async()=>{completions++;return {userId:'member'}},
 })
 return {service,challenges,get sent(){return sent},get completions(){return completions}}
}
test('provider-independent verification rejects wrong/contact-swapped/replayed codes and issues only one session',async()=>{
 const h=harness();const r=await h.service.request('+5581999990001','sms','login',null)
 assert.ok(!JSON.stringify(r).includes(h.sent.code));assert.equal(h.challenges.get(r.challengeId).provider,'provider-id')
 await assert.rejects(()=>h.service.verify(r.challengeId,'+5581999990002','sms','login',null,h.sent.code))
 await assert.rejects(()=>h.service.verify(r.challengeId,'+5581999990001','sms','login',null,'xxxxxx'))
 assert.deepEqual(await h.service.verify(r.challengeId,'+5581999990001','sms','login',null,h.sent.code),{userId:'member'})
 await assert.rejects(()=>h.service.verify(r.challengeId,'+5581999990001','sms','login',null,h.sent.code));assert.equal(h.completions,1)
})
test('unknown identities and uncertain deliveries cannot authorize a session',async()=>{
 const unknown=harness({known:false});const r=await unknown.service.request('+5581999990001','sms','login',null)
 assert.equal(unknown.sent,undefined);assert.equal(unknown.challenges.get(r.challengeId).status,'failed')
 const h=harness({failSend:true});await assert.rejects(()=>h.service.request('+5581999990001','sms','login',null));assert.equal([...h.challenges.values()][0].status,'failed');assert.equal(h.completions,0)
})
test('email signup uses the same independent challenge engine and phone attach remains actor-bound',async()=>{
 const h=harness();const r=await h.service.request('m@example.invalid','email','signup',null);assert.equal(h.sent.channel,'email')
 await h.service.verify(r.challengeId,'m@example.invalid','email','signup',null,h.sent.code)
 await assert.rejects(()=>h.service.request('+5581999990001','sms','attach',null))
 await assert.rejects(()=>h.service.request('+5581999990001','sms','signup',null))
})

import { startMemberSession } from '../../supabase/functions/_shared/session-bridge.ts'
test('session adapter refuses a link or redeemed session for a different identity',async()=>{
 const user={id:'member',email:'m@example.invalid'}
 const db={auth:{admin:{generateLink:async()=>({error:null,data:{user:{id:'other'},properties:{hashed_token:'private'}}})}}}
 let verified=0
 const sessionClient={auth:{verifyOtp:async()=>{verified++;return {error:null,data:{user:{id:'other'},session:{}}}}}}
 await assert.rejects(()=>startMemberSession(db,sessionClient,user));assert.equal(verified,0)
 db.auth.admin.generateLink=async()=>({error:null,data:{user,properties:{hashed_token:'private'}}})
 await assert.rejects(()=>startMemberSession(db,sessionClient,user));assert.equal(verified,1)
})
