-- RF-PP/QR/DG: real PostgreSQL authorization and transaction invariants, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('rkmed.test.purchase_baseline',(select count(*)::text from private.purchases where partner_id='10000000-0000-4000-8000-000000000001'),true);

insert into auth.sessions(id,user_id,created_at,updated_at,aal)
  select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,now(),now(),'aal1'
  from generate_series(1,7) i;

select ok(not exists(select 1 from pg_tables t join pg_class c on c.relname=t.tablename join pg_namespace n on n.oid=c.relnamespace and n.nspname='private'
  where t.schemaname='private' and not c.relrowsecurity),'All domain tables have RLS');
select ok(not has_table_privilege('authenticated','private.member_identity','select'),'Raw CPF cannot be selected by authenticated users');
select ok(not has_function_privilege('anon','public.rk_context()','execute'),'Anonymous callers cannot open a context');
select ok(not has_function_privilege('authenticated','private.eligible(uuid)','execute'),'Eligibility helper cannot be called directly');
select ok(not has_function_privilege('authenticated','private.actor()','execute'),'Actor helper cannot be called directly');

-- Metadata cannot promote a member.
update auth.users set raw_user_meta_data='{"role":"admin"}' where id='00000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"30000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select is(public.rk_context()->>'role','member','Editable metadata does not grant administration');
select is(public.rk_context()->'member'->>'cpf','***.***.***-09','Member projection returns masked CPF');
select throws_ok('select public.rk_admin_members()','42501','Acesso negado','Member cannot list other members');
select throws_ok('select public.rk_start_work(''2468'')','42501','Acesso negado','Member cannot establish a partner work session');
select throws_ok('select * from private.member_identity','42501',null,'Direct private reads are denied');
reset role;

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"30000000-0000-4000-8000-000000000003"}',true);
set local role authenticated;
select ok(public.rk_start_work('1357') ? 'error','Employee code from another partner is rejected');
select is(public.rk_start_work('2468')->'workSession'->>'employeeName','Marina — TESTE','Valid employee is bound to a server work session');
select is(public.rk_validate_member('98765432100','cpf')->>'eligible','false','Blocked member is ineligible');
select is(public.rk_validate_member('98765432100','cpf')->>'receipt',null::text,'Blocked member receives no purchase receipt');
select set_config('rkmed.test.receipt',public.rk_validate_member('12345678909','cpf')->>'receipt',true);
select is(public.rk_quote(current_setting('rkmed.test.receipt')::uuid,20000)->>'finalCents','16000','Quote uses server partner rate');
select set_config('rkmed.test.purchase',public.rk_commit_purchase(current_setting('rkmed.test.receipt')::uuid,20000,'40000000-0000-4000-8000-000000000001',2000)->>'id',true);
select is(public.rk_commit_purchase(current_setting('rkmed.test.receipt')::uuid,20000,'40000000-0000-4000-8000-000000000001',2000)->>'duplicate','true','Retry returns the same purchase');
select throws_ok(format('select public.rk_commit_purchase(%L,20000,%L,2000)',current_setting('rkmed.test.receipt'),'40000000-0000-4000-8000-000000000002'),
  '42501','Validação expirada ou inválida','Receipt cannot authorize a second purchase');
select throws_ok(format('select public.rk_commit_purchase(%L,30000,%L,2000)',current_setting('rkmed.test.receipt'),'40000000-0000-4000-8000-000000000001'),
  'P0001','Chave de operação reutilizada com outros dados','Idempotency key cannot change purchase amount');
select throws_ok('select public.rk_admin_members()','42501','Acesso negado','Partner cannot list all members');
select throws_ok(format('select public.rk_reverse_purchase(%L,''motivo de teste'')',current_setting('rkmed.test.purchase')),'42501','Acesso negado','Partner cannot reverse a purchase');
select set_config('rkmed.test.second_receipt',public.rk_validate_member('12345678909','cpf')->>'receipt',true);
reset role;

select is((select count(*) from private.purchases where partner_id='10000000-0000-4000-8000-000000000001'),current_setting('rkmed.test.purchase_baseline')::bigint+1,'Exactly one purchase is committed independently of the visible page');

-- State changes between validation and confirmation must deny the sale.
update private.members set blocked=true where id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok(format('select public.rk_commit_purchase(%L,20000,%L,2000)',current_setting('rkmed.test.second_receipt'),'40000000-0000-4000-8000-000000000003'),
  '42501','Associado sem benefício disponível','Eligibility is checked again at commit');
reset role;
update private.members set blocked=false where id='00000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","session_id":"30000000-0000-4000-8000-000000000004"}',true);
set local role authenticated;
select is(public.rk_start_work('1357')->'workSession'->>'employeeName','Pedro — TESTE','Second partner has its own employee');
select is((select count(*) from jsonb_array_elements(public.rk_purchases()) p where p->>'partnerId'<>'10000000-0000-4000-8000-000000000002'),0::bigint,'Second partner cannot read first partner purchases');
select throws_ok(format('select public.rk_commit_purchase(%L,20000,%L,1000)',current_setting('rkmed.test.second_receipt'),'40000000-0000-4000-8000-000000000004'),
  '42501','Validação expirada ou inválida','Receipt cannot cross partner or session');
select set_config('rkmed.test.round_receipt',public.rk_validate_member('12345678909','cpf')->>'receipt',true);
select is(public.rk_quote(current_setting('rkmed.test.round_receipt')::uuid,5)->>'discountCents','1','Half-cent rounds upward on the server');
reset role;

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000007","role":"authenticated","session_id":"30000000-0000-4000-8000-000000000007"}',true);
set local role authenticated;
select is(public.rk_admin_members()->0->>'email',null::text,'Viewer does not receive member contacts');
select throws_ok(format('select public.rk_reverse_purchase(%L,''motivo de teste'')',current_setting('rkmed.test.purchase')),'42501','Acesso negado','Viewer cannot reverse');
select throws_ok('select public.rk_set_block(''00000000-0000-4000-8000-000000000001'',true,''teste'')','42501','Acesso negado','Viewer cannot block members');
select throws_ok('select public.rk_employees()','42501','Acesso negado','Viewer cannot list operational employee data');
reset role;

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated","session_id":"30000000-0000-4000-8000-000000000006"}',true);
set local role authenticated;
select lives_ok(format('select public.rk_reverse_purchase(%L,''Correção de registro de teste'')',current_setting('rkmed.test.purchase')),'Support can reverse with a reason');
select lives_ok(format('select public.rk_reverse_purchase(%L,''Repetição da correção'')',current_setting('rkmed.test.purchase')),'Repeated reversal is idempotent');
reset role;
select is((select count(*) from private.reversals where purchase_id=current_setting('rkmed.test.purchase')::uuid),1::bigint,'Only one linked reversal exists');
select throws_ok('delete from private.audit','42501','Registro imutável','Audit cannot be erased');
select throws_ok('delete from private.purchases','42501','Registro imutável','Original purchase cannot be erased');
select is((select count(*) from private.audit where session_id='30000000-0000-4000-8000-000000000003' and action='work.start'),2::bigint,'Invalid employee attempt is durably audited without its code');

-- Staff idle timeout and revoked sessions are enforced on the server.
update private.staff_activity set last_seen=now()-interval '31 minutes' where session_id='30000000-0000-4000-8000-000000000006';
set local role authenticated;
select throws_ok('select public.rk_context()','42501','Sessão da equipe expirada. Entre novamente.','Staff idle session is rejected');
reset role;
delete from auth.sessions where id='30000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"30000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select throws_ok('select public.rk_context()','42501','Sessão expirada. Entre novamente.','Revoked session cannot read card data');
reset role;

select * from finish();
rollback;
