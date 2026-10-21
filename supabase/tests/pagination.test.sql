-- RF-ADM/DG/PP/QR: bounds, literal search, tenant isolation, stable traversal and exact totals.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select set_config('rkmed.test.savings',(select coalesce(sum(p.discount_cents),0)::text from private.purchases p where member_id='00000000-0000-4000-8000-000000000001' and not exists(select 1 from private.reversals v where v.purchase_id=p.id)),true);
insert into auth.sessions(id,user_id,created_at,updated_at,aal)
select ('83000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,now(),now(),'aal1' from generate_series(1,7) i;
insert into auth.users(id,email) select ('81000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'page-'||i||'@rkmed.test' from generate_series(1,121) i;
insert into private.members(id,name,birth_date,created_at)
select ('81000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=120 then 'Paginacao %_literal' else 'Paginacao #'||i end,'1990-01-01','2030-01-01' from generate_series(1,121) i;
insert into private.member_identity(member_id,cpf) select ('81000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'000'||lpad(i::text,8,'0') from generate_series(1,121) i;
insert into private.subscriptions(member_id,state) select ('81000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i%2=0 then 'past_due' else 'incomplete' end from generate_series(1,121) i;
insert into private.validations(id,member_id,session_id,employee_id,partner_id)
select ('84000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001' from generate_series(1,303) i;
insert into private.purchases(id,operation_id,receipt_id,member_id,partner_id,employee_id,employee_name,actor_id,gross_cents,discount_bps,discount_cents,final_cents,created_at)
select ('85000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,gen_random_uuid(),('84000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 case when i>300 then '81000000-0000-4000-8000-000000000121'::uuid when i%2=1 then '00000000-0000-4000-8000-000000000001'::uuid else '00000000-0000-4000-8000-000000000002'::uuid end,
 case when i%2=1 then '10000000-0000-4000-8000-000000000001'::uuid else '10000000-0000-4000-8000-000000000002'::uuid end,
 '20000000-0000-4000-8000-000000000001','TESTE','00000000-0000-4000-8000-000000000003',
 case when i>300 then 9007199254740991 else 20000 end,case when i>300 then 10000 else 2000 end,
 case when i>300 then 9007199254740991 else 4000 end,case when i>300 then 0 else 16000 end,'2030-01-01'
from generate_series(1,303) i;
insert into private.reversals(purchase_id,actor_id,reason) values
 ('85000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','Estorno teste página'),
 ('85000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000005','Estorno teste precisão');
select ok(not has_function_privilege('anon','public.rk_members_page(integer,timestamptz,uuid,text,boolean)','execute'),'Anonymous members page denied');
select ok(not has_function_privilege('anon','public.rk_purchases_page(integer,timestamptz,uuid,boolean)','execute'),'Anonymous purchases page denied');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"83000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select throws_ok('select public.rk_members_page()','42501','Acesso negado','Member cannot list members');
select is(jsonb_array_length(public.rk_purchases_page()->'items'),25,'Default page is 25 rows');
select is(public.rk_purchases_page()->>'hasMore','true','More rows indicated explicitly');
select is((select count(*) from jsonb_array_elements(public.rk_purchases_page()->'items') p where p->>'memberId'<>'00000000-0000-4000-8000-000000000001'),0::bigint,'Member sees only own purchases');
select is(public.rk_purchases_page(1,null,null,true)->>'savingsCents',(current_setting('rkmed.test.savings')::numeric+596000)::text,'Savings use all records minus reversals, independent of page size');
select is(public.rk_purchases_page()->>'savingsCents',null::text,'Unrequested aggregate is omitted');
select set_config('rkmed.test.first',public.rk_purchases_page()::text,true);
select set_config('rkmed.test.next',public.rk_purchases_page(25,(current_setting('rkmed.test.first')::jsonb->'nextCursor'->>'at')::timestamptz,(current_setting('rkmed.test.first')::jsonb->'nextCursor'->>'id')::uuid)::text,true);
select is((select count(*) from jsonb_array_elements(current_setting('rkmed.test.first')::jsonb->'items') a join jsonb_array_elements(current_setting('rkmed.test.next')::jsonb->'items') b on a->>'id'=b->>'id'),0::bigint,'Equal timestamps do not repeat rows across pages');
select is(current_setting('rkmed.test.first')::jsonb->'items'->0->>'id','85000000-0000-4000-8000-000000000299','UUID tie-breaker is deterministic');
select is(jsonb_array_length(public.rk_purchases()),100,'Legacy purchase reader is bounded');
select throws_ok('select public.rk_purchases_page(101)','P0001','Página inválida. Use entre 1 e 100 registros e um cursor completo.','Oversized page rejected');
select throws_ok('select public.rk_purchases_page(0)','P0001','Página inválida. Use entre 1 e 100 registros e um cursor completo.','Zero page rejected');
select throws_ok($$select public.rk_purchases_page(25,'2030-01-01')$$,'P0001','Página inválida. Use entre 1 e 100 registros e um cursor completo.','Incomplete cursor rejected');
reset role;
insert into private.validations(id,member_id,session_id,employee_id,partner_id)
values('84000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
insert into private.purchases(id,operation_id,receipt_id,member_id,partner_id,employee_id,employee_name,actor_id,gross_cents,discount_bps,discount_cents,final_cents,created_at)
values('85000000-0000-4000-8000-000000000304',gen_random_uuid(),'84000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','TESTE','00000000-0000-4000-8000-000000000003',10000,2000,2000,8000,'2030-01-01');
set local role authenticated;
select is((public.rk_purchases_page(25,(current_setting('rkmed.test.first')::jsonb->'nextCursor'->>'at')::timestamptz,(current_setting('rkmed.test.first')::jsonb->'nextCursor'->>'id')::uuid)->'items')::text,(current_setting('rkmed.test.next')::jsonb->'items')::text,'Newer inserts do not shift an existing next-page cursor');
do $$ declare result jsonb; cursor_at timestamptz; cursor_id uuid; ids text[]:='{}'; begin
 loop
   result:=public.rk_purchases_page(25,cursor_at,cursor_id);
   select ids||coalesce(array_agg(x->>'id'),'{}'::text[]) into ids from jsonb_array_elements(result->'items') x;
   exit when not (result->>'hasMore')::boolean;
   cursor_at:=(result->'nextCursor'->>'at')::timestamptz; cursor_id:=(result->'nextCursor'->>'id')::uuid;
 end loop;
 perform set_config('rkmed.test.visited',to_jsonb(ids)::text,true);
end $$;
select is((select count(*) from jsonb_array_elements_text(current_setting('rkmed.test.visited')::jsonb)),(select count(distinct x) from jsonb_array_elements_text(current_setting('rkmed.test.visited')::jsonb) x),'Traversal has no duplicate rows');
reset role;
select is(jsonb_array_length(current_setting('rkmed.test.visited')::jsonb)::bigint,(select count(*) from private.purchases where member_id='00000000-0000-4000-8000-000000000001'),'Traversal visits every authorized record');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"83000000-0000-4000-8000-000000000003"}',true);
set local role authenticated;
select throws_ok('select public.rk_members_page()','42501','Acesso negado','Partner cannot list members');
select is((select count(*) from jsonb_array_elements(public.rk_purchases_page()->'items') p where p->>'partnerId'<>'10000000-0000-4000-8000-000000000001'),0::bigint,'Partner scope is applied before pagination');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000007","role":"authenticated","session_id":"83000000-0000-4000-8000-000000000007"}',true);
set local role authenticated;
select is(jsonb_array_length(public.rk_members_page()->'items'),25,'Members default page is bounded');
select is(jsonb_array_length(public.rk_admin_members()),100,'Legacy member reader is bounded');
select is((select count(*) from jsonb_array_elements(public.rk_members_page()->'items') m where m->>'email' is not null or m->>'phone' is not null or m->>'invoiceId' is not null),0::bigint,'Viewer receives no contact or invoice fields');
select is(public.rk_members_page(25,null,null,'Paginacao #121')->'items'->0->>'savingsCents','18014398509481982','Member row savings preserve exact cents beyond JS precision');
select is(jsonb_array_length(public.rk_members_page(25,null,null,'%_')->'items'),1,'Search treats percent and underscore literally');
select is(public.rk_members_page(25,null,null,'not-found')->>'hasMore','false','Empty search has no more pages');
select is(jsonb_array_length(public.rk_members_page(25,null,null,'not-found')->'items'),0,'Empty search returns no rows');
select is((select count(*) from jsonb_array_elements(public.rk_members_page(25,null,null,'Paginacao',true)->'items') m where m->>'billingState'<>'past_due'),0::bigint,'Collections filter runs on the server before pagination');
select throws_ok($$select public.rk_members_page(25,null,null,repeat('x',81))$$,'P0001','Busca limitada a 80 caracteres.','Search input bounded');
select is(public.rk_purchases_page(25,null,null,true)->>'savingsCents',null::text,'Viewer cannot request global member balance');
reset role;
update auth.sessions set not_after=now()-interval '1 second' where id='83000000-0000-4000-8000-000000000007';
set local role authenticated;
select throws_ok('select public.rk_members_page()','42501','Sessão expirada. Entre novamente.','Expired session cannot page members');
select throws_ok('select public.rk_purchases_page()','42501','Sessão expirada. Entre novamente.','Expired session cannot page purchases');
reset role;
select * from finish();
rollback;
