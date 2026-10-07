begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);
select has_schema('private', 'Private application schema exists');
select has_table('private', 'bootstrap_metadata', 'Bootstrap migration applied');
select is(
  (select value from private.bootstrap_metadata where key = 'fixture'),
  'rkmed-local-bootstrap-v1',
  'Synthetic seed applied'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.bootstrap_metadata'::regclass),
  'Bootstrap table has RLS enabled'
);
select ok(not has_schema_privilege('anon', 'private', 'USAGE'),
  'Anonymous role cannot use private schema');
select ok(not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'Authenticated role cannot use private schema');
select ok(not has_table_privilege('authenticated', 'private.bootstrap_metadata', 'SELECT'),
  'Authenticated role cannot read bootstrap metadata');

select * from finish();
rollback;
