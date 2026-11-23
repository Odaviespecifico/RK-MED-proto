begin;
select plan(5);

select throws_ok(
  $$select public.rk_partner_metrics(30)$$,
  '42501',
  null,
  'anonymous caller cannot query partner manager metrics'
);

select throws_ok(
  $$select public.rk_reissue_employee_code('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000')$$,
  '42501',
  null,
  'anonymous caller cannot reissue employee code'
);

select ok(
  not has_function_privilege('authenticated', 'public.rk_seller_login_verify(text,text)', 'execute'),
  'authenticated browsers cannot invoke service-only rk_seller_login_verify'
);

select ok(
  not has_function_privilege('authenticated', 'public.rk_seller_bind_session(uuid,uuid,uuid,uuid)', 'execute'),
  'authenticated browsers cannot invoke service-only rk_seller_bind_session'
);

select ok(
  exists(select 1 from information_schema.columns where table_schema = 'private' and table_name = 'employees' and column_name = 'encrypted_code'),
  'private.employees has encrypted_code column'
);

select * from finish();
rollback;
