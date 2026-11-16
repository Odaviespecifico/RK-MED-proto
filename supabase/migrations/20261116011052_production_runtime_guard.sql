-- Service-only environment attestation; never let the caller select the database mode.
create function public.rk_backend_environment() returns text
language sql stable security definer set search_path='' as $$
  select value from private.settings where key='environment';
$$;
revoke all on function public.rk_backend_environment() from public, anon, authenticated;
grant execute on function public.rk_backend_environment() to service_role;
