import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
const browser=await chromium.launch({executablePath:'/usr/bin/brave-browser',headless:true,args:['--no-sandbox']})
try {
 const context=await browser.newContext({viewport:{width:1280,height:900}})
 const first=await context.newPage();await first.goto('http://127.0.0.1:5174/acesso-admin')
 await first.getByLabel('E-mail',{exact:true}).fill('admin@rkmed.test');await first.getByLabel('Senha',{exact:true}).fill('RKMED-local-test-2026!');await first.getByRole('button',{name:'Entrar',exact:true}).click();await first.waitForURL('http://127.0.0.1:5174/admin')
 const second=await context.newPage();await second.goto('http://127.0.0.1:5174/admin/equipe');await second.getByRole('button',{name:'Adicionar administrador'}).waitFor()
 await second.getByRole('button',{name:'Adicionar administrador'}).click();await second.getByLabel('E-mail do novo acesso (obrigatório)').fill('multitab@example.test')
 assert.ok(await second.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('rkmed-registration-draft:'))))
 await first.getByRole('button',{name:'Sair',exact:true}).click();await first.waitForURL('http://127.0.0.1:5174/')
 await second.getByRole('heading',{name:'Entre para continuar'}).waitFor()
 assert.equal(await second.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('rkmed-registration-draft:')||key.startsWith('rkmed-auth-'))),false)
 assert.equal(await second.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('rkmed-auth-storage-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});try{return await new Promise((resolve,reject)=>{const r=db.transaction('sessions').objectStore('sessions').get('rkmed-auth-local-local');r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error)})}finally{db.close()}}),null)
 console.log('PASS: sessão compartilhada entre abas, logout propagado e remoção de sessão e rascunho nas duas abas.')
}finally{await browser.close()}
