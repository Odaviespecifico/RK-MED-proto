alter table private.notification_outbox add column reference_id text, add column delivery_owner uuid, add column delivery_until timestamptz;
create function public.rk_backend_collection_link(p_member uuid,p_invoice text,p_operation uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if not exists(select 1 from private.collection_operations where operation_id=p_operation and member_id=p_member and invoice_id=p_invoice and action='link') then raise exception 'Operação de cobrança inválida'; end if;
  insert into private.notification_outbox(member_id,event_key,kind,reference_id) values(p_member,'collection:'||p_operation::text,'collection.link',p_invoice) on conflict(event_key) do nothing;
end $$;
create function public.rk_backend_claim_delivery(p_id uuid,p_owner uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  update private.notification_outbox set delivery_owner=p_owner,delivery_until=now()+interval '2 minutes'
    where id=p_id and status in ('pending','failed') and attempts<5 and next_attempt<=now() and (delivery_until is null or delivery_until<now());
  return found;
end $$;
create function public.rk_backend_complete_delivery(p_id uuid,p_owner uuid,p_success boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  update private.notification_outbox set status=case when p_success then 'sent' else 'failed' end,attempts=attempts+1,
    next_attempt=now()+make_interval(mins=>least(60,power(2,attempts)::integer)),delivery_owner=null,delivery_until=null
    where id=p_id and delivery_owner=p_owner and delivery_until>now() and status<>'sent';
end $$;
create or replace function public.rk_backend_pending() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  return jsonb_build_object('customers',(select coalesce(jsonb_agg(customer_id),'[]') from private.subscriptions where customer_id is not null),
    'events',(select coalesce(jsonb_agg(jsonb_build_object('id',event_id,'type',event_type,'objectId',object_id)),'[]') from private.webhook_events where status<>'processed' and attempts<10),
    'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'memberId',member_id,'kind',kind,'key',event_key,'reference',reference_id)),'[]') from private.notification_outbox where status in ('pending','failed') and attempts<5 and next_attempt<=now()));
end $$;
create function public.rk_delivery_queue() returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'memberName',m.name,'kind',q.kind,'status',q.status,'attempts',q.attempts,'createdAt',q.created_at)),'[]')
    from private.notification_outbox q left join private.members m on m.id=q.member_id where q.status<>'sent' or q.kind like 'risk.%');
end $$;
revoke all on function public.rk_backend_collection_link(uuid,text,uuid),public.rk_backend_claim_delivery(uuid,uuid),public.rk_backend_complete_delivery(uuid,uuid,boolean),public.rk_delivery_queue() from public,anon,authenticated;
grant execute on function public.rk_backend_collection_link(uuid,text,uuid),public.rk_backend_claim_delivery(uuid,uuid),public.rk_backend_complete_delivery(uuid,uuid,boolean) to service_role;
grant execute on function public.rk_delivery_queue() to authenticated;
