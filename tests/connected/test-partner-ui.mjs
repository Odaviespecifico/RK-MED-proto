import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'
import { localClients } from '../../scripts/dev/local.mjs'
const local=localClients(), origin='http://127.0.0.1:5174'
const email=`partner-ui-${randomUUID()}@rkmed.test`,name='Parceiro de teste navegador'
const password='Synthetic-browser-password-2026!',code='135790'
function sql(input){return execFileSync('docker',['exec','-i','supabase_db_rkmed','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tA'],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
const browser=await chromium.launch({executablePath:'/usr/bin/brave-browser',headless:true,args:['--no-sandbox','--disable-gpu']})
try{
 const context=await browser.newContext({viewport:{width:360,height:800}}),page=await context.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 async function login(email,password){await page.goto(origin+'/acesso-admin');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click()}
 await login('admin@rkmed.test','RKMED-local-test-2026!');await page.waitForURL(origin+'/admin');await page.goto(origin+'/admin/parceiros')
 await page.getByRole('button',{name:'Criar parceiro de teste',exact:true}).click()
 for(const [label,value] of [['Nome do estabelecimento de teste',name],['Categoria do estabelecimento de teste','Academia'],['Endereço do estabelecimento de teste','Rua de teste, Recife'],['Desconto do parceiro de teste (%)','20'],['E-mail do parceiro de teste',email],['Senha inicial do parceiro de teste',password],['Nome do primeiro funcionário','Funcionário de teste'],['Código do primeiro funcionário',code]])await page.getByLabel(label,{exact:true}).fill(value)
 await page.getByRole('button',{name:'Revisar cadastro de teste'}).click()
 const review=page.getByRole('region',{name:'Revisar parceiro de teste'})
 assert.ok(!(await review.textContent()).includes(password));assert.ok(!(await review.textContent()).includes(code))
 await page.getByRole('button',{name:'Revisar dados do cadastro'}).click()
 assert.equal(await page.getByLabel('Nome do estabelecimento de teste',{exact:true}).inputValue(),name)
 await page.getByRole('button',{name:'Revisar cadastro de teste'}).click()
 await page.getByRole('button',{name:'Confirmar criação do parceiro de teste'}).click()
 const success=page.getByRole('status',{name:'Parceiro de teste criado'});await success.waitFor({timeout:60000})
 const text=await success.textContent(),entry=text.match(/Código do estabelecimento: ([A-Z0-9]{10})/)[1]
 assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth),false)
 assert.ok(!(await page.evaluate(()=>JSON.stringify({...localStorage}))).includes(password))
 await page.screenshot({path:'/tmp/rkmed-test-partner-created.png',fullPage:true})
 await context.close()
 const partnerContext=await browser.newContext({viewport:{width:360,height:800}}),partnerPage=await partnerContext.newPage()
 await partnerPage.goto(origin+'/acesso-admin');await partnerPage.getByLabel('E-mail',{exact:true}).fill(email);await partnerPage.getByLabel('Senha',{exact:true}).fill(password);await partnerPage.getByRole('button',{name:'Entrar',exact:true}).click()
 await partnerPage.getByText('Parceiro de teste · ambiente de homologação',{exact:true}).waitFor()
 await partnerPage.getByLabel('Código do estabelecimento').fill(entry);await partnerPage.getByLabel('Código do funcionário').fill(code);await partnerPage.getByRole('button',{name:'Iniciar atendimento'}).click()
 await partnerPage.getByRole('button',{name:'Buscar por CPF'}).waitFor()
 assert.equal(await partnerPage.locator('body').evaluate(e=>e.scrollWidth>innerWidth),false)
 assert.deepEqual(errors,[])
 console.log('PASS: cadastro completo pelo navegador via Edge/Auth/RPC reais, revisão sem credenciais, resultado móvel e login/turno do parceiro oculto.')
}finally{
 await browser.close()
 const user=sql(`select auth_user_id from private.test_partner_operations where email='${email}';`)
 if(user){const partner=sql(`select partner_id from private.roles where user_id='${user}';`);sql(`delete from private.work_sessions where user_id='${user}';delete from private.roles where user_id='${user}';${partner?`delete from private.employees where partner_id='${partner}';delete from private.partners where id='${partner}';`:''}delete from private.test_partner_operations where email='${email}';`);assert.equal((await local.service.auth.admin.deleteUser(user)).error,null)}
}
