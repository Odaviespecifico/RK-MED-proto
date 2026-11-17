import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { readEnvironment, projectRoot } from '../env/files.mjs'
const ref='wfgiokooedjalmvqgbub',env=readEnvironment('stage',{})
if(env.VITE_SUPABASE_PROJECT_REF!==ref||env.APP_ENV!=='sandbox'||env.VITE_SUPABASE_URL!==`https://${ref}.supabase.co`)throw Error('Destino diferente do stage aprovado.')
function cli(args){return execFileSync('npx',['--no-install','supabase',...args],{cwd:projectRoot,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000})}
const state=JSON.parse(cli(['db','query','--linked','--project-ref',ref,"select (select value from private.settings where key='environment') as environment,exists(select 1 from private.bootstrap_metadata where key='stage-fixtures-v1') as seeded",'-o','json'])).rows[0]
if(state.environment!=='sandbox'||!state.seeded)throw Error('A carga de stage precisa estar aplicada.')
// Storage CLI rejects this account's token; obtain the project's existing server
// credential in memory only. It is never logged, written to disk or bundled.
const keys=JSON.parse(cli(['projects','api-keys','--project-ref',ref,'-o','json']))
const key=keys.find(row=>row.name==='service_role'&&row.type==='legacy')?.api_key
if(!key)throw Error('Credencial administrativa de Storage indisponível.')
const payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString())
if(payload.ref!==ref||payload.role!=='service_role')throw Error('Credencial pertence a outro projeto.')
const client=createClient(env.VITE_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}})
for(let i=1;i<=3;i++){
 const id='f17e0001-0000-4000-8000-'+String(i).padStart(12,'0'),path=id+'/photo.jpg'
 const exists=JSON.parse(cli(['db','query','--linked','--project-ref',ref,`select exists(select 1 from storage.objects where bucket_id='member-photos' and name='${path}') as present`,'-o','json'])).rows[0].present
 if(!exists){const result=await client.storage.from('member-photos').upload(path,readFileSync(new URL('../../tests/fixtures/face-portrait.jpg',import.meta.url)),{contentType:'image/jpeg',upsert:false});if(result.error)throw Error('Não foi possível enviar a foto fictícia privada.')}
 cli(['db','query','--linked','--project-ref',ref,`update private.members set photo_path='${path}' where id='${id}' and photo_path is null and exists(select 1 from storage.objects where bucket_id='member-photos' and name='${path}')`,'-o','json'])
}
console.log('Três fotos de fixture disponíveis no Storage privado; nenhum upload de foto pública ou identidade real de associado.')
