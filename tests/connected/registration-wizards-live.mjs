import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'
import { localClients, login } from '../../scripts/dev/local.mjs'
const reloadDraft = process.env.RKMED_TEST_RELOAD !== '0'
const local = localClients(), admin = await login(local, 'admin@rkmed.test')
const suffix = randomUUID().replace(/-/g, '').slice(0, 10)
const partnerName = `Parceiro cadastro ${suffix}`, email = `wizard-${suffix}@rkmed.test`, password = 'Synthetic-password-2026!'
const numeric = Array.from(suffix, c => (parseInt(c, 16) % 10).toString()).join('') + '01'
function digit(value) { const sum = [...value].reduce((acc, c, i) => acc + Number(c) * (((value.length - i - 1) % 8) + 2), 0); const rem = sum % 11; return rem < 2 ? '0' : String(11 - rem) }
const cnpj = numeric + digit(numeric) + digit(numeric + digit(numeric))
const sql = input => execFileSync('docker', ['exec','-i','supabase_db_rkmed','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tA'], { input, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim()
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--no-sandbox','--disable-gpu'] })
let accountId
try {
 const page = await browser.newPage({ viewport: { width: 360, height: 900 } })
 page.on('pageerror', error => console.error('pageerror:', error.message))
 await page.route('https://viacep.com.br/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"erro":true}' }))
 await page.goto('http://127.0.0.1:5174/acesso-admin')
 await page.getByLabel('E-mail', { exact:true }).fill('admin@rkmed.test'); await page.getByLabel('Senha', { exact:true }).fill('RKMED-local-test-2026!'); await page.getByRole('button', { name:'Entrar', exact:true }).click(); await page.waitForURL('http://127.0.0.1:5174/admin')
 // Simulate an existing localStorage session from the previous application version.
 const migrated = await page.evaluate(async () => {
  const key='rkmed-auth-local-local'
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('rkmed-auth-storage-v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  const value=await new Promise((resolve,reject)=>{const request=db.transaction('sessions','readonly').objectStore('sessions').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  if(!value) { db.close();return false }
  localStorage.setItem(key,value);localStorage.setItem(`${key}-code-verifier`,'synthetic-legacy-verifier')
  await new Promise((resolve,reject)=>{const tx=db.transaction('sessions','readwrite');tx.objectStore('sessions').delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})
  db.close();return true
 });assert.equal(migrated,true)
 await page.reload();await page.waitForURL('http://127.0.0.1:5174/admin');await page.getByRole('heading',{name:'Visão geral'}).waitFor()
 await page.waitForFunction(()=>!localStorage.getItem('rkmed-auth-local-local-code-verifier'))
 assert.equal(await page.evaluate(()=>Object.entries(localStorage).some(([key,value])=>key.startsWith('rkmed-auth-')||value.includes('access_token')||value.includes('refresh_token'))),false)
 await page.goto('http://127.0.0.1:5174/admin/parceiros')
 assert.equal(await page.getByRole('button', { name: 'Criar parceiro de teste' }).count(), 0)
 await page.getByLabel('Buscar parceiro por nome, categoria, endereço ou CNPJ').fill('sem-correspondencia-sintetica')
 await page.getByRole('button', { name:'Adicionar parceiro' }).click()
 await page.getByLabel('Nome do parceiro (obrigatório)').fill(partnerName); if (reloadDraft) { await page.reload(); await page.getByText('Recuperamos seu preenchimento.', { exact:false }).waitFor(); assert.equal(await page.getByLabel('Nome do parceiro (obrigatório)').inputValue(), partnerName) }
 for (const [label,value] of [['Nome do parceiro (obrigatório)',partnerName],['Categoria (obrigatório)','Academia'],['CNPJ (obrigatório)',cnpj],['Descrição (obrigatório)','Parceiro sintético'],['Desconto em % (obrigatório)','20']]) await page.getByLabel(label,{exact:true}).fill(value)
 await page.getByRole('button',{name:'Continuar'}).click()
 for (const [label,value] of [['CEP','50000000'],['Rua / logradouro','Rua teste'],['Bairro','Centro'],['Cidade','Recife'],['UF','PE']]) await page.getByLabel(label,{exact:true}).fill(value)
 await page.getByRole('button',{name:'Continuar'}).click();await page.getByRole('button',{name:'Cadastrar parceiro',exact:true}).click()
 await page.getByText(new RegExp(`Parceiro ${partnerName} cadastrado`)).waitFor(); if (!reloadDraft) { await page.getByText(/O registro não corresponde à busca atual/).waitFor(); assert.equal(await page.getByLabel('Buscar parceiro por nome, categoria, endereço ou CNPJ').inputValue(),'sem-correspondencia-sintetica') }
 assert.equal(sql(`select count(*) from private.partners where name='${partnerName}';`),'1')
 await page.goto('http://127.0.0.1:5174/admin/equipe')
 await page.getByRole('button',{name:'Adicionar administrador'}).click();await page.getByLabel('E-mail do novo acesso (obrigatório)').fill(email);await page.getByRole('button',{name:'Continuar'}).click();await page.getByLabel('Senha inicial (obrigatório; 12 a 128 caracteres)').fill(password);await page.getByRole('button',{name:'Continuar'}).click();await page.reload();await page.getByText('Recuperamos seu preenchimento.', { exact:false }).waitFor();await page.getByRole('button',{name:'Criar administrador'}).click();await page.getByText('Informe novamente uma senha entre 12 e 128 caracteres.').waitFor();await page.getByLabel('Senha inicial (obrigatório; 12 a 128 caracteres)').fill(password);await page.getByRole('button',{name:'Continuar'}).click();await page.getByRole('button',{name:'Criar administrador'}).click();await page.getByText(/A senha inicial deve ser comunicada/).waitFor({timeout:60000})
 const accounts=await admin.rpc('rk_staff_accounts',{p_query:email});assert.equal(accounts.error,null);accountId=accounts.data.items.find(a=>a.email===email)?.id;assert.ok(accountId);assert.equal(accounts.data.items.find(a=>a.id===accountId).role,'admin')
 assert.equal((await page.evaluate(()=>JSON.stringify(localStorage))).includes(password),false)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await page.getByRole('button',{name:'Adicionar administrador'}).click();await page.getByLabel('E-mail do novo acesso (obrigatório)').fill('draft-before-logout@example.test')
 const saved=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('rkmed-registration-draft:')&&localStorage.getItem(k)?.includes('draft-before-logout@example.test'));return {key,value:key&&localStorage.getItem(key)}});assert.ok(saved.key)
 await page.keyboard.press('Escape');await page.evaluate(({key,value})=>{localStorage.setItem(key,value);localStorage.setItem('rkmed-registration-draft:other-user:staff','other')},saved)
 await page.getByRole('button',{name:'Abrir navegação'}).click();await page.getByRole('button',{name:'Sair',exact:true}).click();await page.waitForURL('http://127.0.0.1:5174/');assert.equal(await page.evaluate(key=>localStorage.getItem(key),saved.key),null);assert.equal(await page.evaluate(()=>localStorage.getItem('rkmed-registration-draft:other-user:staff')),'other')
 console.log('PASS: modais completos com React, RPC, Edge e Auth locais; rascunhos recuperados, administrador criado e senha fora do localStorage.')
} finally {
 await browser.close()
 if (!accountId) { const accounts=await admin.rpc('rk_staff_accounts',{p_query:email});accountId=accounts.data?.items?.find(a=>a.email===email)?.id }
 if (accountId) { const result=await local.service.auth.admin.deleteUser(accountId);assert.equal(result.error,null) }
 sql(`delete from private.partners where name='${partnerName}';`)
 await admin.auth.signOut({scope:'local'})
}
