-- RF-PAG/NOT: trusted provider commands; never grant these functions to browsers.
alter table private.subscriptions add column sync_owner uuid, add column sync_until timestamptz;
create table private.checkout_operations (
  operation_id uuid primary key, member_id uuid not null references private.members(id),
  status text not null default 'pending' check (status in ('pending','ready','expired')),
  session_id text, checkout_url text, created_at timestamptz not null default now()
);
create unique index one_pending_checkout on private.checkout_operations(member_id) where status='pending';
alter table private.checkout_operations enable row level security;
revoke all on private.checkout_operations from public,anon,authenticated;
create unique index one_pending_collection on private.collection_operations(invoice_id) where status='pending';

create function private.service_only() returns void language plpgsql set search_path='' as $$
begin if auth.role() is distinct from 'service_role' then raise exception 'Operação de servidor' using errcode='42501'; end if; end $$;

create function public.rk_backend_member(p_member uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  return (select jsonb_build_object('id',m.id,'name',m.name,'email',u.email,'phone',u.phone,
    'verified',u.email_confirmed_at is not null and u.phone_confirmed_at is not null,
    'photoPath',m.photo_path,'blocked',m.blocked,'customerId',s.customer_id,'subscriptionId',s.subscription_id,
    'invoiceId',s.invoice_id,'state',s.state,'paidThrough',s.paid_through,
    'consented',(select count(distinct d.kind)=3 from private.consents c join private.documents d on d.version=c.version
      where c.member_id=m.id and d.active and (not d.test_only or (select value from private.settings where key='environment')<>'production')))
    from private.members m join auth.users u on u.id=m.id join private.subscriptions s on s.member_id=m.id where m.id=p_member);
end $$;

create function public.rk_backend_role(p_user uuid,p_role text,p_partner uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if p_role not in ('admin','support','viewer','partner') then raise exception 'Perfil interno inválido'; end if;
  insert into private.roles(user_id,role,partner_id) values(p_user,p_role,p_partner)
    on conflict(user_id) do update set role=excluded.role,partner_id=excluded.partner_id,active=true;
  perform private.log('staff.provision',p_user);
end $$;

create function public.rk_backend_photo(p_member uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  update private.members set photo_path=p_member::text||'/photo.jpg' where id=p_member;
  if not found then raise exception 'Cadastro não encontrado'; end if;
  perform private.log('member.photo',p_member);
end $$;

create function public.rk_backend_customer(p_member uuid,p_customer text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if p_customer !~ '^cus_[A-Za-z0-9]+$' then raise exception 'Customer inválido'; end if;
  update private.subscriptions set customer_id=p_customer where member_id=p_member and (customer_id is null or customer_id=p_customer);
  if not found then raise exception 'Customer já associado a outro cadastro ou cadastro ausente'; end if;
end $$;

create function public.rk_checkout_begin(p_member uuid,p_operation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.checkout_operations; info jsonb;
begin
  perform private.service_only();
  perform 1 from private.members where id=p_member for update;
  info:=public.rk_backend_member(p_member);
  if info is null or not (info->>'verified')::boolean or not (info->>'consented')::boolean or info->>'photoPath' is null then
    raise exception 'Conclua contatos, foto e aceite antes de pagar.'; end if;
  if info->>'subscriptionId' is not null and info->>'state' not in ('incomplete','canceled') then raise exception 'Já existe uma assinatura. Gerencie a cobrança existente.'; end if;
  select * into old from private.checkout_operations where operation_id=p_operation;
  if found then
    if old.member_id<>p_member then raise exception 'Operação inválida' using errcode='42501'; end if;
    return jsonb_build_object('status',old.status,'url',old.checkout_url,'operationId',old.operation_id);
  end if;
  select * into old from private.checkout_operations where member_id=p_member and status in ('pending','ready') and created_at>now()-interval '30 minutes' order by created_at desc limit 1;
  if found then return jsonb_build_object('status',old.status,'url',old.checkout_url,'operationId',old.operation_id); end if;
  update private.checkout_operations set status='expired' where member_id=p_member and status in ('pending','ready');
  insert into private.checkout_operations(operation_id,member_id) values(p_operation,p_member);
  return jsonb_build_object('status','pending','operationId',p_operation);
end $$;

create function public.rk_checkout_finish(p_operation uuid,p_session text,p_url text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if p_session !~ '^cs_test_' or p_url !~ '^https://checkout\.stripe\.com/' then raise exception 'Checkout de teste inválido'; end if;
  update private.checkout_operations set status='ready',session_id=p_session,checkout_url=p_url where operation_id=p_operation and status='pending';
end $$;

create function public.rk_event_record(p_id text,p_type text,p_object text,p_created bigint) returns text
language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if p_id !~ '^evt_[A-Za-z0-9]+$' or p_object !~ '^[a-z]+_[A-Za-z0-9]+$' then raise exception 'Evento inválido'; end if;
  insert into private.webhook_events(event_id,event_type,object_id,provider_created) values(p_id,p_type,p_object,p_created) on conflict(event_id) do nothing;
  return (select status from private.webhook_events where event_id=p_id);
end $$;

create function public.rk_event_finish(p_id text,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  update private.webhook_events set status=case when p_error is null then 'processed' else 'failed' end,
    last_error=case when p_error is null then null else 'provider_processing_failed' end,attempts=attempts+1 where event_id=p_id;
end $$;

create function public.rk_sync_claim(p_customer text,p_owner uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare member uuid;
begin
  perform private.service_only();
  select member_id into member from private.subscriptions where customer_id=p_customer;
  if member is null then return null; end if;
  perform 1 from private.members where id=member for update;
  update private.subscriptions set sync_owner=p_owner,sync_until=now()+interval '1 minute'
    where member_id=member and (sync_until is null or sync_until<now());
  if not found then raise exception 'Sincronização em andamento'; end if;
  return member;
end $$;

create function public.rk_sync_apply(p_member uuid,p_owner uuid,p_subscription text,p_state text,p_paid_through timestamptz,
  p_cancel boolean,p_invoice text,p_amount bigint) returns void language plpgsql security definer set search_path='' as $$
declare previous text;
begin
  perform private.service_only();
  perform 1 from private.members where id=p_member for update;
  select state into previous from private.subscriptions where member_id=p_member and sync_owner=p_owner and sync_until>now() for update;
  if not found then raise exception 'Sincronização expirada'; end if;
  update private.subscriptions set subscription_id=p_subscription,state=p_state,paid_through=p_paid_through,
    cancel_at_period_end=p_cancel,invoice_id=p_invoice,amount_due=p_amount,updated_at=now(),sync_owner=null,sync_until=null
    where member_id=p_member;
  if previous is distinct from p_state then
    insert into private.notification_outbox(member_id,event_key,kind)
      values(p_member,'billing:'||p_member::text||':'||coalesce(p_invoice,p_subscription)||':'||p_state,'billing.'||p_state) on conflict(event_key) do nothing;
  end if;
  perform private.log('billing.sync',p_member);
end $$;

create function public.rk_collection_begin(p_operation uuid,p_member uuid,p_actor uuid,p_invoice text,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old private.collection_operations;
begin
  perform private.service_only();
  if not exists(select 1 from private.roles where user_id=p_actor and active and role in ('admin','support')) then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform 1 from private.subscriptions where member_id=p_member and invoice_id=p_invoice and state='past_due' for update;
  if not found then raise exception 'Fatura não disponível para cobrança'; end if;
  select * into old from private.collection_operations where operation_id=p_operation;
  if found then
    if old.member_id<>p_member or old.actor_id<>p_actor or old.invoice_id<>p_invoice or old.action<>p_action then raise exception 'Chave de operação inválida'; end if;
    return jsonb_build_object('status',old.status);
  end if;
  insert into private.collection_operations(operation_id,member_id,actor_id,invoice_id,action) values(p_operation,p_member,p_actor,p_invoice,p_action);
  insert into private.audit(actor_id,action,target_id,correlation_id) values(p_actor,'collection.'||p_action,p_member,p_operation);
  return jsonb_build_object('status','pending');
end $$;

create function public.rk_collection_finish(p_operation uuid,p_success boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  update private.collection_operations set status=case when p_success then 'succeeded' else 'failed' end where operation_id=p_operation;
  insert into private.audit(actor_id,action,target_id,correlation_id)
    select actor_id,'collection.result.'||case when p_success then 'succeeded' else 'failed' end,member_id,operation_id
    from private.collection_operations where operation_id=p_operation;
end $$;

create function public.rk_backend_queue(p_member uuid,p_key text,p_kind text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  insert into private.notification_outbox(member_id,event_key,kind) values(p_member,p_key,p_kind) on conflict(event_key) do nothing;
end $$;

create function public.rk_backend_pending() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  return jsonb_build_object('customers',(select coalesce(jsonb_agg(customer_id),'[]') from private.subscriptions where customer_id is not null),
    'events',(select coalesce(jsonb_agg(jsonb_build_object('id',event_id,'type',event_type,'objectId',object_id)),'[]') from private.webhook_events where status<>'processed' and attempts<10),
    'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'memberId',member_id,'kind',kind,'key',event_key)),'[]') from private.notification_outbox where status in ('pending','failed') and attempts<5 and next_attempt<=now()));
end $$;

create function public.rk_backend_delivery(p_id uuid,p_success boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  update private.notification_outbox set status=case when p_success then 'sent' else 'failed' end,attempts=attempts+1,
    next_attempt=now()+make_interval(mins=>least(60,power(2,attempts)::integer)) where id=p_id and status<>'sent';
end $$;

-- These functions are available only to verified service-role requests. Grants are not inferred from names at runtime.
do $$ declare f record; begin
  for f in select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'rk_backend_%' or p.proname like 'rk_checkout_%' or p.proname like 'rk_event_%'
      or p.proname like 'rk_sync_%' or p.proname like 'rk_collection_%') loop
    execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
    execute 'grant execute on function '||f.signature||' to service_role';
  end loop;
end $$;
revoke all on function private.service_only() from public,anon,authenticated;
