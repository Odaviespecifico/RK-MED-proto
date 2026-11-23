begin;
select plan(4);

select throws_ok(
  $$select public.rk_admin_billing(6)$$,
  '42501',
  null,
  'anonymous caller cannot query admin billing overview'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","session_id":"00000000-0000-0000-0000-000000000000"}', true);
select throws_ok(
  $$select public.rk_admin_billing(6)$$,
  '42501',
  null,
  'unknown authenticated user cannot query admin billing overview'
);

reset role;
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rk_admin_billing' and p.prosecdef),
  'rk_admin_billing exists as security definer'
);

select ok(
  not has_function_privilege('anon', 'public.rk_admin_billing(integer)', 'execute'),
  'anon has no execute privilege on rk_admin_billing'
);

select * from finish();
rollback;
