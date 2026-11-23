begin;
select plan(4);

select throws_ok(
  $$select public.rk_export_data('partners', '2026-11-01', '2026-11-23')$$,
  '42501',
  null,
  'anonymous caller cannot export admin data'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","session_id":"00000000-0000-0000-0000-000000000000"}', true);
select throws_ok(
  $$select public.rk_export_data('financial', '2026-11-01', '2026-11-23')$$,
  '42501',
  null,
  'unknown authenticated user cannot export admin data'
);

reset role;
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rk_export_data' and p.prosecdef),
  'rk_export_data exists as security definer'
);

select ok(
  not has_function_privilege('anon', 'public.rk_export_data(text,date,date)', 'execute'),
  'anon has no execute privilege on rk_export_data'
);

select * from finish();
rollback;
