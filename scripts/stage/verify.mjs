import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { readEnvironment, serializeEnvironment, projectRoot } from '../env/files.mjs'
import { resolve } from 'node:path'
const ref = 'wfgiokooedjalmvqgbub'
const env = readEnvironment('stage', {})
if (env.VITE_SUPABASE_PROJECT_REF !== ref || env.VITE_SUPABASE_URL !== `https://${ref}.supabase.co`) throw Error('Verificação exclusiva do stage aprovado.')
const accessPath = resolve(projectRoot, '.local/stage-fixtures-access.env')
const access = parseEnv(readFileSync(accessPath, 'utf8'))
const clients = []
const check = (value, message) => { if (!value) throw Error(message) }
async function login(email) {
 const client = createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const { error } = await client.auth.signInWithPassword({email,password:access.FIXTURE_PASSWORD})
 check(!error, `Falha ao autenticar fixture: ${error?.code || 'erro'}`)
 clients.push(client); return client
}
async function rpc(client,name,args={}) {
 const {data,error}=await client.rpc(name,args)
 check(!error,`RPC ${name} recusada: ${error?.code || 'erro'}`)
 return data
}
async function pages(client,name,args,expected,label) {
 let cursor=null, previous=null, previousCursor=null, count=0, pageCount=0
 const seen=new Set()
 do {
  const value=await rpc(client,name,{...args,p_limit:25,p_at:cursor?.at||null,p_id:cursor?.id||null})
  check(Array.isArray(value.items),`${label}: página inválida`)
  for(const row of value.items){check(!seen.has(row.id),`${label}: item repetido`);seen.add(row.id)}
  count+=value.items.length;pageCount++
  if(pageCount===2){previous=value.items.map(v=>v.id).join(',');previousCursor=cursor}
  check(!value.hasMore||value.nextCursor,`${label}: cursor ausente`)
  cursor=value.hasMore?value.nextCursor:null
  check(pageCount<300,`${label}: paginação não encerra`)
 }while(cursor)
 check(count===expected,`${label}: total esperado ${expected}, obtido ${count}`)
 if(previous){const replay=await rpc(client,name,{...args,p_limit:25,p_at:previousCursor.at,p_id:previousCursor.id});check(replay.items.map(v=>v.id).join(',')===previous,`${label}: releitura divergiu`)}
 console.log(`${label}: ${count} registros, ${pageCount} páginas; sem duplicações, cursor estável.`)
}
try {
 const admin=await login(access.ADMIN_EMAIL)
 check((await rpc(admin,'rk_context')).role==='admin','Perfil administrador fictício inválido')
 await pages(admin,'rk_members_page',{p_query:'FICTÍCIO STAGE'},240,'Associados')
 await pages(admin,'rk_members_page',{p_query:'FICTÍCIO STAGE',p_past_due:true},60,'Cobranças atrasadas')
 await pages(admin,'rk_staff_accounts',{p_query:'@stage.rkmed.invalid'},120,'Acessos internos e parceiros')
 await pages(admin,'rk_support_requests',{},400,'Atendimentos')
 await pages(admin,'rk_support_requests',{p_status:'open'},134,'Atendimentos abertos')
 const answered=await rpc(admin,'rk_support_requests',{p_status:'answered',p_limit:25})
 check(answered.items.every(row=>row.deliveryStatus!==null),'Atendimentos sem vínculo com entrega fictícia')
 await pages(admin,'rk_purchases_page',{},3720,'Compras gerais')
 const partners=await rpc(admin,'rk_staff_partners')
 const partner=partners.find(p=>p.id==='f17e0002-0000-4000-8000-000000000001')
 check(partner?.establishmentCode,'Código do estabelecimento fictício ausente')
 check(partners.filter(p=>p.id.startsWith('f17e0002-')).length===60,'Parceiros fictícios ausentes')
 access.ESTABLISHMENT_CODE=partner.establishmentCode
 writeFileSync(accessPath,serializeEnvironment(access),{mode:0o600})
 const employees=await rpc(admin,'rk_partner_employees',{p_partner:partner.id})
 check(employees.length===40,'Lista de funcionários do parceiro 001 incompleta')
 await pages(admin,'rk_partner_purchases_page',{p_partner:partner.id},180,'Compras do parceiro 001')
 const member=await login(access.MEMBER_EMAIL)
 const context=await rpc(member,'rk_context')
 check(context.role==='member'&&context.member.eligible,'Associado ativo fictício indisponível')
 check(/^\*{3}\.\*{3}\.\*{3}-\d{2}$/.test(context.member.cpf),'CPF não está mascarado')
 check(!!context.member.photoPath,'Foto privada do associado 001 ausente')
 const photo=await member.storage.from('member-photos').createSignedUrl(context.member.photoPath,60)
 check(!photo.error&&photo.data?.signedUrl,'Foto privada não autorizada ao próprio associado')
 const image=await fetch(photo.data.signedUrl)
 check(image.ok&&(await image.arrayBuffer()).byteLength>0,'Foto privada não pode ser carregada')
 await pages(member,'rk_purchases_page',{},150,'Histórico do associado 001')
 await pages(member,'rk_support_requests',{},81,'Atendimentos do associado 001')
 const partnerClient=await login(access.PARTNER_EMAIL)
 await rpc(partnerClient,'rk_start_work',{p_code:access.FIRST_EMPLOYEE_CODE,p_establishment_code:access.ESTABLISHMENT_CODE})
 check(!!(await rpc(partnerClient,'rk_context')).workSession,'Código do funcionário fictício não abre atendimento')
 const validation=await rpc(partnerClient,'rk_validate_member',{p_lookup:context.member.cardToken,p_method:'qr'})
 check(validation.found&&validation.eligible&&validation.photoPath,'QR do associado fictício não autoriza conferência no parceiro')
 await pages(partnerClient,'rk_purchases_page',{},180,'Histórico da conta do parceiro 001')
 check((await member.rpc('rk_staff_accounts')).error,'Associado acessou equipe')
 check((await partnerClient.rpc('rk_members_page')).error,'Parceiro acessou diretório interno')
 console.log('PASS: paginação completa, filtros, acesso de administrador/associado/parceiro e isolamento verificados no stage. Nenhum pagamento ou envio externo executado.')
} finally { await Promise.allSettled(clients.map(c=>c.auth.signOut({scope:'local'}))) }
