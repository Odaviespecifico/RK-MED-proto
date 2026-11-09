begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok((select relrowsecurity from pg_class where oid='private.wedea_shares'::regclass),'Wedea ledger enforces RLS');
select ok(not has_table_privilege('authenticated','private.wedea_shares','SELECT'),'Members/staff cannot read revenue ledger');
select ok(not has_table_privilege('anon','private.wedea_shares','INSERT'),'Anonymous cannot create a share');
select ok(not has_table_privilege('service_role','private.wedea_shares','UPDATE'),'Service uses narrow functions');
select ok(not has_function_privilege('authenticated','public.rk_sync_apply_wedea(jsonb,text,text,bigint)','EXECUTE'),'Browser cannot reserve shares');
select ok(not has_function_privilege('anon','public.rk_wedea_claim(text,uuid,text,text,boolean)','EXECUTE'),'Anonymous cannot claim money');
select ok(not has_function_privilege('authenticated','public.rk_wedea_complete(text,uuid,text)','EXECUTE'),'Browser cannot forge transfer completion');
select ok(not has_function_privilege('authenticated','public.rk_wedea_get(text)','EXECUTE'),'Browser cannot inspect provider identifiers');
select ok(not has_function_privilege('authenticated','public.rk_wedea_pending()','EXECUTE'),'Browser cannot list transfer jobs');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($$select public.rk_wedea_get('in_test')$$,'42501','Operação de servidor','Definer rejects non-service claim');
select set_config('request.jwt.claims','{"role":"service_role"}',true);

-- Transaction-local synthetic cohort; no remote calls and all fixtures roll back.
update private.subscriptions set state='incomplete';
create temporary table cohort as select i,gen_random_uuid() mid from generate_series(1,201) i;
insert into auth.users(id,aud,role,email) select mid,'authenticated','authenticated','wedea-'||i||'@example.invalid' from cohort;
insert into private.members(id,name,birth_date) select mid,'Wedea synthetic '||i,'1990-01-01'::date from cohort;
insert into private.subscriptions(member_id,customer_id,subscription_id,state,paid_through)
 select mid,'cus_Wedea'||i,'sub_Wedea'||i,case when i<=199 then 'active' else 'incomplete' end,now()+interval '30 days' from cohort;

create function pg_temp.pay(n integer,inv text,amount bigint default 6990) returns void language plpgsql as $$
declare mid uuid; owner uuid:=gen_random_uuid();
begin
  select c.mid into mid from cohort c where i=n;
  perform public.rk_sync_claim('cus_Wedea'||n,owner);
  perform public.rk_sync_apply_wedea(jsonb_build_object('p_member',mid,'p_owner',owner,'p_subscription','sub_Wedea'||n,
    'p_state','active','p_paid_through',now()+interval '30 days','p_cancel',false,'p_invoice',inv,'p_amount',0),inv,'sub_Wedea'||n,amount);
end $$;
select pg_temp.pay(200,'in_Boundary200');
select is((select active_members from private.wedea_shares where invoice_id='in_Boundary200'),200::bigint,'200th paid member included in count');
select is((select amount_cents from private.wedea_shares where invoice_id='in_Boundary200'),0,'Exactly 200 receives no share');
select pg_temp.pay(201,'in_Boundary201');
select is((select active_members from private.wedea_shares where invoice_id='in_Boundary201'),201::bigint,'201st paid member included atomically');
select is((select amount_cents from private.wedea_shares where invoice_id='in_Boundary201'),1587,'201 activates fixed share');
select pg_temp.pay(200,'in_Boundary200');
select is((select amount_cents from private.wedea_shares where invoice_id='in_Boundary200'),0,'Replay cannot backfill below-threshold payment');
select pg_temp.pay(200,'in_Renewal');
select is((select amount_cents from private.wedea_shares where invoice_id='in_Renewal'),1587,'Existing member renewal also qualifies above threshold');
update private.members set blocked=true where id=(select mid from cohort where i=199);
select pg_temp.pay(200,'in_Dropped');
select is((select active_members from private.wedea_shares where invoice_id='in_Dropped'),200::bigint,'Blocked paid member excluded');
select is((select amount_cents from private.wedea_shares where invoice_id='in_Dropped'),0,'Falling back to 200 disables new shares');
select pg_temp.pay(201,'in_Boundary201');
select is((select amount_cents from private.wedea_shares where invoice_id='in_Boundary201'),1587,'Replay preserves already earned share after drop');
update private.members set blocked=false where id=(select mid from cohort where i=199);
update private.subscriptions set paid_through=now()-interval '1 second' where member_id=(select mid from cohort where i=198);
select pg_temp.pay(200,'in_Expired');
select is((select active_members from private.wedea_shares where invoice_id='in_Expired'),200::bigint,'Expired active subscription excluded');
update private.subscriptions set paid_through=now()+interval '1 day',state='past_due' where member_id=(select mid from cohort where i=198);
select pg_temp.pay(200,'in_Failed');
select is((select active_members from private.wedea_shares where invoice_id='in_Failed'),200::bigint,'Failed payment excludes member');
update private.subscriptions set state='active' where member_id=(select mid from cohort where i=198);
select pg_temp.pay(200,'in_Free',0);
select is((select amount_cents from private.wedea_shares where invoice_id='in_Free'),0,'Zero-value paid invoice earns no share');
select pg_temp.pay(200,'in_Discount',1000);
select is((select amount_cents from private.wedea_shares where invoice_id='in_Discount'),1587,'Positive discounted invoice retains fixed amount');

select ok(public.rk_wedea_claim('in_Renewal','50000000-0000-4000-8000-000000000001','acct_Wedea','ch_Renewal',true) is not null,'Worker claims transfer');
select is(public.rk_wedea_claim('in_Renewal','50000000-0000-4000-8000-000000000002','acct_Wedea','ch_Renewal',true),null::jsonb,'Competing worker cannot claim');
select throws_ok($$select public.rk_wedea_complete('in_Renewal','50000000-0000-4000-8000-000000000002','tr_Wrong')$$,'P0001','Repasse sem reserva válida','Wrong owner cannot finish');
update private.wedea_shares set lease_until=now()-interval '1 second' where invoice_id='in_Renewal';
select throws_ok($$select public.rk_wedea_claim('in_Renewal','50000000-0000-4000-8000-000000000002','acct_Changed','ch_Renewal',true)$$,'P0001','Parâmetros do repasse não podem mudar','Retry cannot change Stripe parameters');
select ok(public.rk_wedea_claim('in_Renewal','50000000-0000-4000-8000-000000000002','acct_Wedea','ch_Renewal',true) is not null,'Expired worker lease can retry same transfer');
select lives_ok($$select public.rk_wedea_complete('in_Renewal','50000000-0000-4000-8000-000000000002','tr_Renewal')$$,'Owning worker persists transfer');
select is(public.rk_wedea_claim('in_Renewal','50000000-0000-4000-8000-000000000003','acct_Wedea','ch_Renewal',true),null::jsonb,'Completed invoice never creates another transfer');
select ok(public.rk_wedea_claim('in_Boundary201','50000000-0000-4000-8000-000000000001','acct_Wedea','ch_Boundary',true) is not null,'Another invoice reserves independently');
update private.wedea_shares set first_attempt_at=now()-interval '24 hours',lease_until=now()-interval '1 second' where invoice_id='in_Boundary201';
select is(public.rk_wedea_claim('in_Boundary201','50000000-0000-4000-8000-000000000003','acct_Wedea','ch_Boundary',true),null::jsonb,'Expired Stripe idempotency window never resends blindly');
select is((select status from private.wedea_shares where invoice_id='in_Boundary201'),'review','Ambiguous transfer routed to manual review');
select is((select count(*) from private.wedea_shares where invoice_id='in_Boundary201'),1::bigint,'Invoice decision remains unique');
select * from finish();
rollback;
