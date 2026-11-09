-- RF-ADM/DG: support messages and aggregate overview authorization, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

insert into auth.sessions(id,user_id,created_at,updated_at,aal) values
  ('81000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',now(),now(),'aal1'),
  ('81000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003',now(),now(),'aal1'),
  ('81000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000005',now(),now(),'aal1'),
  ('81000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006',now(),now(),'aal1'),
  ('81000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000007',now(),now(),'aal1')
on conflict(id) do nothing;

select ok(not exists(select 1 from pg_tables t join pg_class c on c.relname=t.tablename join pg_namespace n on n.oid=c.relnamespace and n.nspname='private'
  where t.schemaname='private' and not c.relrowsecurity),'All domain tables have RLS, including support requests');
select ok(not has_table_privilege('authenticated','private.support_requests','select'),'Support messages cannot be selected directly');
-- Read fixtures as the owner before narrowing to the authenticated role.
select set_config('rkmed.test.phone',(select '•••• '||right(phone,4) from auth.users where id='00000000-0000-4000-8000-000000000001'),true);
select set_config('rkmed.test.purchases',(select count(*)::text from private.purchases p
  where p.member_id='00000000-0000-4000-8000-000000000001'
    and not exists(select 1 from private.reversals v where v.purchase_id=p.id)),true);

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"81000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select is(public.rk_context()->'member'->>'email','ana@rkmed.test','Member context exposes the own verified e-mail');
select is(public.rk_context()->'member'->>'phone',current_setting('rkmed.test.phone'),'Member context masks the own phone');
select is(public.rk_member_economy()->>'purchases',current_setting('rkmed.test.purchases'),'Member economy counts persisted purchases excluding reversals');
select ok(not exists(select 1 from jsonb_array_elements(public.rk_support_requests()->'items') t where t->>'memberId'<>'00000000-0000-4000-8000-000000000001'),'Member reads only own support messages');
select throws_ok('select public.rk_admin_overview()','42501','Acesso negado','Member cannot read the administration overview');
select throws_ok('select * from private.support_requests','42501',null::text,'Direct support reads are denied');
select set_config('rkmed.test.support',public.rk_open_support_request('Preciso de ajuda com a mensalidade.')::text,true);
reset role;
select is((select count(*) from private.support_requests where member_id='00000000-0000-4000-8000-000000000001'),1::bigint,'Member opens one support request');
set local role authenticated;
select throws_ok('select public.rk_answer_support_request(current_setting(''rkmed.test.support'')::uuid,''Resposta indevida'')','42501','Acesso negado','Member cannot answer support');
reset role;

insert into private.audit(actor_id,action) select '00000000-0000-4000-8000-000000000001','support.open' from generate_series(1,4);
set local role authenticated;
select throws_ok('select public.rk_open_support_request(''Mais uma mensagem de teste'')','42501','Aguarde antes de enviar outra mensagem.','Support opening is rate limited');
reset role;

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"81000000-0000-4000-8000-000000000003"}',true);
set local role authenticated;
select throws_ok('select public.rk_open_support_request(''Mensagem do parceiro'')','42501','Acesso negado','Partner cannot open member support');
reset role;

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000007","role":"authenticated","session_id":"81000000-0000-4000-8000-000000000007"}',true);
set local role authenticated;
select is(public.rk_admin_overview()->>'pastDue','1','Viewer reads the aggregate overview');
select throws_ok('select public.rk_support_requests()','42501','Acesso negado','Viewer cannot read support messages');
select throws_ok(format('select public.rk_answer_support_request(%L,''Resposta indevida'')',current_setting('rkmed.test.support')),'42501','Acesso negado','Viewer cannot answer support');
reset role;

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated","session_id":"81000000-0000-4000-8000-000000000005"}',true);
set local role authenticated;
select is(jsonb_array_length(public.rk_support_requests()->'items'),1,'Admin lists the open request');
select is(public.rk_support_requests(p_status => 'open')->'items'->0->>'memberName','Ana Paula — TESTE','Support list includes the member name');
select lives_ok(format('select public.rk_answer_support_request(%L,''Resposta de teste'')',current_setting('rkmed.test.support')),'Admin answers the request');
reset role;
select is((select status from private.support_requests where id=current_setting('rkmed.test.support')::uuid),'answered','Answer changes the request status');
reset role;

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated","session_id":"81000000-0000-4000-8000-000000000006"}',true);
set local role authenticated;
select is(jsonb_array_length(public.rk_support_requests(p_status => 'answered')->'items'),1,'Support profile lists answered requests');
select is(public.rk_admin_overview()->>'openSupport','0','Overview reflects the answered request');
reset role;

-- RF-SUP: delivery idempotency, ownership and closing preserve the original reply.
select is((select count(*) from private.notification_outbox where event_key='support.answer:'||current_setting('rkmed.test.support')),1::bigint,'One queued email per answered ticket');
set local role authenticated;
select lives_ok(format('select public.rk_answer_support_request(%L,''Resposta de teste'')',current_setting('rkmed.test.support')),'Repeated identical reply is idempotent');
select throws_ok(format('select public.rk_answer_support_request(%L,''Outra resposta'')',current_setting('rkmed.test.support')),'P0001','Solicitação já respondida ou encerrada. Atualize a lista.','Answered text cannot be overwritten');
select lives_ok(format('select public.rk_close_support_request(%L)',current_setting('rkmed.test.support')),'Support closes the request');
reset role;
select is((select response from private.support_requests where id=current_setting('rkmed.test.support')::uuid),'Resposta de teste','Closing retains the answer');
select ok(not has_function_privilege('authenticated','public.rk_backend_support_reply(uuid,uuid)','execute'),'Browser cannot read delivery recipients');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(public.rk_backend_support_reply(current_setting('rkmed.test.support')::uuid,'00000000-0000-4000-8000-000000000002'),null::jsonb,'Wrong member cannot receive another ticket');
select is(public.rk_backend_support_reply(current_setting('rkmed.test.support')::uuid,'00000000-0000-4000-8000-000000000001')->>'response','Resposta de teste','Delivery reads the saved answer');
reset role;
select * from finish();
rollback;
