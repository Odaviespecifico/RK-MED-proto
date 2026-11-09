-- Email recovery requests are hashed, throttled and service-only.
create table private.password_recovery_requests (
  email_hash text not null check(length(email_hash)=64),
  created_at timestamptz not null default now()
);
create index password_recovery_email_time on private.password_recovery_requests(email_hash,created_at desc);
alter table private.password_recovery_requests enable row level security;
revoke all on private.password_recovery_requests from public,anon,authenticated,service_role;

create function public.rk_password_recovery_allowed(p_email_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if p_email_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_email_hash,73));
  if (select count(*) from private.password_recovery_requests where email_hash=p_email_hash and created_at>now()-interval '1 hour')>=3 then return false; end if;
  insert into private.password_recovery_requests(email_hash) values(p_email_hash);
  delete from private.password_recovery_requests where created_at<now()-interval '30 days';
  return true;
end $$;
revoke all on function public.rk_password_recovery_allowed(text) from public,anon,authenticated;
grant execute on function public.rk_password_recovery_allowed(text) to service_role;
