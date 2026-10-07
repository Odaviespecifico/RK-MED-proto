-- Infrastructure only. Domain tables follow approved product decisions.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.bootstrap_metadata (
  key text primary key,
  value text not null
);

alter table private.bootstrap_metadata enable row level security;
revoke all on table private.bootstrap_metadata from public, anon, authenticated;

comment on table private.bootstrap_metadata is
  'Local foundation smoke-test marker; no personal data or product configuration.';
