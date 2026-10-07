-- Idempotent, synthetic bootstrap fixture. No auth users or external messages.
insert into private.bootstrap_metadata (key, value)
values ('fixture', 'rkmed-local-bootstrap-v1')
on conflict (key) do update set value = excluded.value;
