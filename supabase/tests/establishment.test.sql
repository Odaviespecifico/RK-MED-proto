-- D33: establishment code + employee code, always scoped to the authenticated partner.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('rkmed.test.establishment1',(select entry_code from private.partners where id='10000000-0000-4000-8000-000000000001'),true);
select set_config('rkmed.test.establishment2',(select entry_code from private.partners where id='10000000-0000-4000-8000-000000000002'),true);
insert into auth.sessions(id,user_id,created_at,updated_at,aal)
  select ('93000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,now(),now(),'aal1'
  from generate_series(1,7) i;

select ok(not exists(select 1 from private.partners where entry_code !~ '^[A-Z0-9]{10}$'),'Existing partners receive a valid code');
select is((select count(*) from private.partners),(select count(distinct entry_code) from private.partners),'Establishment codes are unique');
select is(to_regprocedure('public.rk_start_work(text)'),null::regprocedure,'Old code-only entry point is removed');
select ok(not has_function_privilege('anon','public.rk_start_work(text,text)','execute'),'Anonymous callers cannot start work');
set local role anon;
select ok(not exists(select 1 from jsonb_array_elements(public.rk_partners()) p where p ? 'establishmentCode' or p ? 'entry_code'),'Public partner directory never exposes entry codes');
reset role;

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"93000000-0000-4000-8000-000000000003"}',true);
set local role authenticated;
select ok(public.rk_start_work('2468','INVALID000') ? 'error','Unknown establishment code rejected');
select ok(public.rk_start_work('2468',current_setting('rkmed.test.establishment2')) ? 'error','Valid code of another establishment rejected');
select ok(public.rk_start_work('1357',current_setting('rkmed.test.establishment1')) ? 'error','Employee from another establishment rejected');
select ok(public.rk_start_work('2468',null) ? 'error','Missing establishment code rejected');
select is(public.rk_context()->'workSession',null::jsonb,'Invalid combinations create no work session');
select is(public.rk_start_work('2468',' '||lower(current_setting('rkmed.test.establishment1'))||' ')->'workSession'->>'employeeName','Marina — TESTE','Correct pair starts work and normalizes establishment code');
select is(public.rk_context()->'workSession'->>'partnerId','10000000-0000-4000-8000-000000000001','Session remains bound to the authenticated establishment');
select throws_ok('select public.rk_staff_partners()','42501','Acesso negado','Partner cannot enumerate internal establishment codes');
select public.rk_end_work();
reset role;
update private.employees set active=false where partner_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(public.rk_start_work('2468',current_setting('rkmed.test.establishment1')) ? 'error','Inactive employee rejected even with correct establishment code');
reset role;
update private.employees set active=true where partner_id='10000000-0000-4000-8000-000000000001';
update private.partners set active=false where id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(public.rk_start_work('2468',current_setting('rkmed.test.establishment1')) ? 'error','Inactive establishment rejected');
reset role;

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"93000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select throws_ok('select public.rk_start_work(''2468'',current_setting(''rkmed.test.establishment1''))','42501','Acesso negado','Member cannot use establishment codes');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000007","role":"authenticated","session_id":"93000000-0000-4000-8000-000000000007"}',true);
set local role authenticated;
select ok(not exists(select 1 from jsonb_array_elements(public.rk_staff_partners()) p where p->>'establishmentCode' is not null),'Viewer does not receive establishment codes');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated","session_id":"93000000-0000-4000-8000-000000000005"}',true);
set local role authenticated;
select ok(not exists(select 1 from jsonb_array_elements(public.rk_staff_partners()) p where p->>'establishmentCode' is null),'Administration can distribute establishment codes');
reset role;
select * from finish();
rollback;
