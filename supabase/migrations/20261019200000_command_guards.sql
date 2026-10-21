-- Bound user-triggered provider work independently of UI controls.
create function public.rk_backend_rate(p_actor uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if p_action not in ('checkout','portal','cancel','collection','staff','photo') then raise exception 'Ação inválida'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text||p_action,0));
  if (select count(*) from private.audit where actor_id=p_actor and action='command.'||p_action and created_at>now()-interval '1 minute')>=5 then
    raise exception 'Aguarde antes de tentar novamente.'; end if;
  insert into private.audit(actor_id,action) values(p_actor,'command.'||p_action);
end $$;
create function public.rk_backend_risk(p_customer text,p_event text,p_kind text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  insert into private.notification_outbox(member_id,event_key,kind)
    select member_id,p_event,p_kind from private.subscriptions where customer_id=p_customer on conflict(event_key) do nothing;
end $$;
-- Keep one Checkout until Stripe explicitly reports expiration. A clock timeout alone must never create a second subscription.
create or replace function public.rk_checkout_begin(p_member uuid,p_operation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.checkout_operations; info jsonb;
begin
  perform private.service_only();
  perform 1 from private.members where id=p_member for update;
  info:=public.rk_backend_member(p_member);
  if info is null or not (info->>'verified')::boolean or not (info->>'consented')::boolean or info->>'photoPath' is null then
    raise exception 'Conclua contatos, foto e aceite antes de pagar.'; end if;
  if info->>'subscriptionId' is not null and info->>'state'<>'canceled' then raise exception 'Já existe uma assinatura. Gerencie a cobrança existente.'; end if;
  select * into old from private.checkout_operations where operation_id=p_operation;
  if found then
    if old.member_id<>p_member then raise exception 'Operação inválida' using errcode='42501'; end if;
    return jsonb_build_object('status',old.status,'url',old.checkout_url,'sessionId',old.session_id,'operationId',old.operation_id);
  end if;
  select * into old from private.checkout_operations where member_id=p_member and status in ('pending','ready') order by created_at desc limit 1;
  if found then return jsonb_build_object('status',old.status,'url',old.checkout_url,'sessionId',old.session_id,'operationId',old.operation_id); end if;
  insert into private.checkout_operations(operation_id,member_id) values(p_operation,p_member);
  return jsonb_build_object('status','pending','operationId',p_operation);
end $$;
create function public.rk_checkout_expired(p_operation uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform private.service_only(); update private.checkout_operations set status='expired' where operation_id=p_operation; end $$;
revoke all on function public.rk_backend_rate(uuid,text),public.rk_backend_risk(text,text,text),public.rk_checkout_expired(uuid) from public,anon,authenticated;
grant execute on function public.rk_backend_rate(uuid,text),public.rk_backend_risk(text,text,text),public.rk_checkout_expired(uuid) to service_role;
