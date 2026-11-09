-- D30: a área do associado passa a consultar a própria assinatura e a reativar
-- um cancelamento agendado. Mantém o mesmo limite por ator/ação.
create or replace function public.rk_backend_rate(p_actor uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if p_action not in ('checkout','portal','cancel','resume','subscription','collection','staff','photo') then raise exception 'Ação inválida'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text||p_action,0));
  if (select count(*) from private.audit where actor_id=p_actor and action='command.'||p_action and created_at>now()-interval '1 minute')>=5 then
    raise exception 'Aguarde antes de tentar novamente.'; end if;
  insert into private.audit(actor_id,action) values(p_actor,'command.'||p_action);
end $$;
revoke all on function public.rk_backend_rate(uuid,text) from public,anon,authenticated;
grant execute on function public.rk_backend_rate(uuid,text) to service_role;
