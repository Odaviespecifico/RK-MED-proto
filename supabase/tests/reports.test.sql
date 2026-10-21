-- RF-ADM/DG: authorization, complete reconciled totals, Recife boundaries, bounded audited export.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.sessions(id,user_id,created_at,updated_at,aal)
select ('60000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,now(),now(),'aal1' from generate_series(1,7) i;
insert into private.validations(id,member_id,session_id,employee_id,partner_id)
select ('61000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '00000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000003',
 '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'
from generate_series(1,7) i;
insert into private.purchases(id,operation_id,receipt_id,member_id,partner_id,employee_id,employee_name,actor_id,gross_cents,discount_bps,discount_cents,final_cents,created_at)
select ('62000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,gen_random_uuid(),
 ('61000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '00000000-0000-4000-8000-000000000001',
 case when i=5 then '10000000-0000-4000-8000-000000000002'::uuid else '10000000-0000-4000-8000-000000000001'::uuid end,
 '20000000-0000-4000-8000-000000000001','Funcionário — TESTE','00000000-0000-4000-8000-000000000003',
 case when i>=6 then 9007199254740991 else 20000 end,0,0,
 case when i>=6 then 9007199254740991 else 20000 end,
 case i when 1 then '2020-01-02 02:59:59+00'::timestamptz
 when 2 then '2020-01-02 03:00:00+00'::timestamptz
 when 3 then '2020-01-03 02:59:59+00'::timestamptz
 when 4 then '2020-01-03 03:00:00+00'::timestamptz
 when 5 then '2020-01-02 12:00:00+00'::timestamptz
 else '2020-02-01 12:00:00+00'::timestamptz end
from generate_series(1,7) i;
insert into private.reversals(purchase_id,actor_id,reason,created_at)
values('62000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000005','Teste de estorno posterior','2020-02-01');
select ok(not has_function_privilege('anon','public.rk_report(date,date,uuid)','execute'),'Anonymous report denied');
select ok(not has_function_privilege('anon','public.rk_export_purchases(date,date,uuid)','execute'),'Anonymous export denied');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"60000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select throws_ok($$select public.rk_report('2020-01-02','2020-01-02')$$,'42501','Acesso negado','Member cannot query staff aggregates');
select throws_ok($$select public.rk_export_purchases('2020-01-02','2020-01-02')$$,'42501','Acesso negado','Member cannot export');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"60000000-0000-4000-8000-000000000003"}',true);
set local role authenticated;
select throws_ok($$select public.rk_report('2020-01-02','2020-01-02')$$,'42501','Acesso negado','Partner cannot query staff aggregates');
select throws_ok($$select public.rk_export_purchases('2020-01-02','2020-01-02')$$,'42501','Acesso negado','Partner cannot export');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000007","role":"authenticated","session_id":"60000000-0000-4000-8000-000000000007"}',true);
set local role authenticated;
select is(public.rk_report('2020-01-02','2020-01-02')->'totals'->>'recordedCount','3','Recife period includes both boundaries and excludes adjacent days');
select is(public.rk_report('2020-01-02','2020-01-02')->'totals'->>'validCount','2','Later reversal is excluded from valid purchase count');
select is(public.rk_report('2020-01-02','2020-01-02')->'totals'->>'reversedCount','1','Reversal remains visible in counts');
select is(public.rk_report('2020-01-02','2020-01-02')->'totals'->>'grossCents','40000','Totals exclude reversed purchase');
select is(public.rk_report('2020-01-02','2020-01-02','10000000-0000-4000-8000-000000000001')->'totals'->>'grossCents','20000','Partner filter is applied server-side');
select is(public.rk_report('2020-02-01','2020-02-01')->'totals'->>'grossCents','18014398509481982','Totals preserve cents beyond JavaScript safe integer');
select is(public.rk_report('1999-01-01','1999-01-01')->'totals'->>'grossCents','0','Empty report has zero totals');
select throws_ok($$select public.rk_report(null,'2020-01-02')$$,'P0001','Escolha um período válido de até 366 dias','Null range rejected');
select throws_ok($$select public.rk_report('2020-01-02','2020-01-01')$$,'P0001','Escolha um período válido de até 366 dias','Reversed range rejected');
select throws_ok($$select public.rk_report('2020-01-01','2022-01-01')$$,'P0001','Escolha um período válido de até 366 dias','Excessive range rejected');
select throws_ok($$select public.rk_export_purchases('2020-01-02','2020-01-02')$$,'42501','Acesso negado','Viewer cannot export through direct API');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated","session_id":"60000000-0000-4000-8000-000000000006"}',true);
set local role authenticated;
select set_config('rkmed.test.export',public.rk_export_purchases('2020-01-02','2020-01-02')::text,true);
select is(jsonb_array_length(current_setting('rkmed.test.export')::jsonb->'rows'),3,'Support exports all selected rows including reversal');
select is(current_setting('rkmed.test.export')::jsonb->'rows'->0->>'cpf','***.***.***-09','Only masked CPF in export');
select ok(not (current_setting('rkmed.test.export')::jsonb->'rows'->0 ?| array['email','phone','photoPath','cardToken']),'Export contains no contact/photo/QR');
reset role;
select is((select count(*) from private.audit where session_id='60000000-0000-4000-8000-000000000006' and action='report.export'),1::bigint,'Successful export audited once');
-- Simulate other exports in the same minute, independently of existing test data.
insert into private.audit(actor_id,action) select '00000000-0000-4000-8000-000000000006','report.export' from generate_series(1,5);
set local role authenticated;
select throws_ok($$select public.rk_export_purchases('2020-01-02','2020-01-02')$$,'P0001','Aguarde um minuto antes de exportar novamente','Export rate limit enforced on server');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated","session_id":"60000000-0000-4000-8000-000000000005"}',true);
set local role authenticated;
select is(jsonb_array_length(public.rk_export_purchases('2020-01-02','2020-01-02','10000000-0000-4000-8000-000000000002')->'rows'),1,'Admin export respects partner filter');
reset role;
with receipts as (
  insert into private.validations(member_id,session_id,employee_id,partner_id)
  select '00000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'
  from generate_series(1,5001) returning id
)
insert into private.purchases(operation_id,receipt_id,member_id,partner_id,employee_id,employee_name,actor_id,gross_cents,discount_bps,discount_cents,final_cents,created_at)
select gen_random_uuid(),id,'00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001','TESTE','00000000-0000-4000-8000-000000000003',1,0,0,1,'1990-01-01 12:00:00+00'
from receipts;
set local role authenticated;
select is(public.rk_report('1990-01-01','1990-01-01')->'totals'->>'recordedCount','5001','Aggregates include more rows than export limit');
select throws_ok($$select public.rk_export_purchases('1990-01-01','1990-01-01')$$,'P0001','Mais de 5.000 registros. Reduza o período ou filtre um parceiro.','Oversized export fails instead of silently truncating');
reset role;
update private.staff_activity set last_seen=now()-interval '31 minutes' where session_id='60000000-0000-4000-8000-000000000005';
set local role authenticated;
select throws_ok($$select public.rk_export_purchases('2020-01-02','2020-01-02')$$,'42501','Sessão da equipe expirada. Entre novamente.','Expired staff session cannot export');
reset role;
select * from finish();
rollback;
