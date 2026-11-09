-- Support answers are immutable, delivered through the existing leased outbox.
alter table private.notification_outbox add column provider_id text;
alter table private.support_requests drop constraint support_requests_check;
alter table private.support_requests add constraint support_response_state check (
  (response is null)=(answered_at is null) and (answered_at is null)=(answered_by is null)
  and (status<>'answered' or response is not null) and (status<>'open' or response is null)
);

create or replace function public.rk_answer_support_request(p_id uuid,p_response text) returns void
language plpgsql security definer set search_path='' as $$
declare r private.roles; ticket private.support_requests; answer text;
begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  answer:=trim(coalesce(p_response,''));
  if length(answer) not between 2 and 2000 then raise exception 'Escreva uma resposta entre 2 e 2000 caracteres.'; end if;
  select * into ticket from private.support_requests where id=p_id for update;
  if not found then raise exception 'Solicitação não encontrada'; end if;
  if ticket.response=answer then return; end if;
  if ticket.status<>'open' then raise exception 'Solicitação já respondida ou encerrada. Atualize a lista.'; end if;
  update private.support_requests set status='answered',response=answer,answered_at=now(),answered_by=r.user_id where id=p_id;
  insert into private.notification_outbox(member_id,event_key,kind,reference_id)
    values(ticket.member_id,'support.answer:'||p_id::text,'support.answer',p_id::text) on conflict(event_key) do nothing;
  perform private.log('support.answer',p_id);
end $$;

-- Existing saved answers have never been sent by the previous implementation.
insert into private.notification_outbox(member_id,event_key,kind,reference_id)
  select member_id,'support.answer:'||id::text,'support.answer',id::text
  from private.support_requests where response is not null on conflict(event_key) do nothing;

create or replace function public.rk_support_requests(p_limit integer default 25,p_at timestamptz default null,p_id uuid default null,p_status text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; items jsonb; more boolean; last_row jsonb; status_filter text;
begin
  r:=private.actor();
  if r.role not in ('admin','support','member') then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform private.check_page(p_limit,p_at,p_id);
  status_filter:=trim(coalesce(p_status,''));
  if status_filter<>'' and status_filter not in ('open','answered','closed') then raise exception 'Situação inválida'; end if;
  with selected as materialized (
    select s.* from private.support_requests s
    where (r.role<>'member' or s.member_id=r.user_id)
      and (p_at is null or (s.created_at,s.id)<(p_at,p_id)) and (status_filter='' or s.status=status_filter)
    order by s.created_at desc,s.id desc limit p_limit+1
  ) select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'memberId',s.member_id,'memberName',m.name,
      'message',s.message,'status',s.status,'response',s.response,'createdAt',s.created_at,'answeredAt',s.answered_at,
      'deliveryStatus',q.status,'deliveryAttempts',coalesce(q.attempts,0)) order by s.created_at desc,s.id desc),'[]')
    into items from selected s join private.members m on m.id=s.member_id
    left join private.notification_outbox q on q.event_key='support.answer:'||s.id::text;
  more:=jsonb_array_length(items)>p_limit;
  if more then items:=items-p_limit; end if;
  last_row:=items->(jsonb_array_length(items)-1);
  return jsonb_build_object('items',items,'hasMore',more,'nextCursor',case when more then jsonb_build_object('at',last_row->>'createdAt','id',last_row->>'id') end);
end $$;

create function public.rk_close_support_request(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin
  r:=private.actor();
  if r.role not in ('admin','support','member') then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform 1 from private.support_requests where id=p_id and (r.role<>'member' or member_id=r.user_id) for update;
  if not found then raise exception 'Solicitação não encontrada'; end if;
  update private.support_requests set status='closed' where id=p_id and status<>'closed';
  if found then perform private.log('support.close',p_id); end if;
end $$;

create function public.rk_retry_support_reply(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform 1 from private.support_requests where id=p_id and response is not null for update;
  if not found then raise exception 'Resposta não encontrada'; end if;
  if (select count(*) from private.audit where action='support.retry' and target_id=p_id and created_at>now()-interval '1 hour')>=3 then
    raise exception 'Aguarde antes de reenviar a resposta.'; end if;
  update private.notification_outbox set status='pending',attempts=0,next_attempt=now(),delivery_owner=null,delivery_until=null
    where event_key='support.answer:'||p_id::text and status='failed' and (delivery_until is null or delivery_until<now());
  if not found then raise exception 'O envio já foi aceito ou está em andamento. Atualize a lista.'; end if;
  perform private.log('support.retry',p_id);
end $$;

create function public.rk_backend_support_reply(p_request uuid,p_member uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  return (select jsonb_build_object('email',u.email,'response',s.response)
    from private.support_requests s join auth.users u on u.id=s.member_id
    where s.id=p_request and s.member_id=p_member and s.response is not null and u.email_confirmed_at is not null);
end $$;

drop function public.rk_backend_complete_delivery(uuid,uuid,boolean);
create function public.rk_backend_complete_delivery(p_id uuid,p_owner uuid,p_success boolean,p_provider text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  update private.notification_outbox set status=case when p_success then 'sent' else 'failed' end,attempts=attempts+1,
    provider_id=case when p_success then left(p_provider,128) else provider_id end,
    next_attempt=now()+make_interval(mins=>least(60,power(2,attempts)::integer)),delivery_owner=null,delivery_until=null
    where id=p_id and delivery_owner=p_owner and delivery_until>now() and status<>'sent';
end $$;

revoke all on function public.rk_close_support_request(uuid),public.rk_retry_support_reply(uuid) from public,anon;
grant execute on function public.rk_close_support_request(uuid),public.rk_retry_support_reply(uuid) to authenticated;
revoke all on function public.rk_backend_support_reply(uuid,uuid),public.rk_backend_complete_delivery(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.rk_backend_support_reply(uuid,uuid),public.rk_backend_complete_delivery(uuid,uuid,boolean,text) to service_role;

-- Application authorization always checks current roles and session creation time.
-- Deactivated internal users must never fall through to public enrollment as pending.
alter table private.roles add column revision integer not null default 1 check(revision>0),
  add column sessions_valid_after timestamptz not null default '-infinity';
create or replace function private.actor() returns private.roles language plpgsql security definer set search_path='' as $$
declare r private.roles; s auth.sessions; sid uuid; last_activity timestamptz;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  sid:=nullif(auth.jwt()->>'session_id','')::uuid;
  select * into s from auth.sessions where id=sid and user_id=auth.uid();
  if not found or (s.not_after is not null and s.not_after<=now()) then raise exception 'Sessão expirada. Entre novamente.' using errcode='42501'; end if;
  select * into r from private.roles where user_id=auth.uid();
  if found then
    if not r.active then raise exception 'Acesso desativado. Procure a administração.' using errcode='42501'; end if;
    if s.created_at<=r.sessions_valid_after then raise exception 'Acesso atualizado. Entre novamente.' using errcode='42501'; end if;
  else r.user_id:=auth.uid(); r.role:='pending'; r.active:=true; end if;
  if r.role not in ('member','pending') then
    select last_seen into last_activity from private.staff_activity where session_id=sid for update;
    if s.created_at+interval '8 hours'<=now() or coalesce(last_activity,s.created_at)+interval '30 minutes'<=now() then
      raise exception 'Sessão da equipe expirada. Entre novamente.' using errcode='42501'; end if;
    insert into private.staff_activity(session_id,last_seen) values(sid,now()) on conflict(session_id) do update set last_seen=excluded.last_seen;
  end if;
  return r;
end $$;

create or replace function private.can_read_operations() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.roles r join auth.sessions s on s.user_id=r.user_id
    left join private.staff_activity a on a.session_id=s.id
    where r.user_id=auth.uid() and r.active and r.role in ('admin','support')
      and s.id=nullif(auth.jwt()->>'session_id','')::uuid and s.created_at>r.sessions_valid_after
      and (s.not_after is null or s.not_after>now()) and s.created_at+interval '8 hours'>now()
      and coalesce(a.last_seen,s.created_at)+interval '30 minutes'>now());
$$;

create function private.require_staff_admin(p_actor uuid,p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from private.roles r join auth.sessions s on s.user_id=r.user_id
    left join private.staff_activity a on a.session_id=s.id
    where r.user_id=p_actor and r.role='admin' and r.active and s.id=p_session and s.created_at>r.sessions_valid_after
      and (s.not_after is null or s.not_after>now()) and s.created_at+interval '8 hours'>now()
      and coalesce(a.last_seen,s.created_at)+interval '30 minutes'>now()) then
    raise exception 'Acesso negado' using errcode='42501'; end if;
end $$;
revoke all on function private.require_staff_admin(uuid,uuid) from public,anon,authenticated,service_role;

create function public.rk_staff_accounts(p_limit integer default 25,p_at timestamptz default null,p_id uuid default null,p_query text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; items jsonb; more boolean; last_row jsonb; query text;
begin
  r:=private.actor();
  if r.role<>'admin' then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform private.check_page(p_limit,p_at,p_id);
  query:=lower(trim(coalesce(p_query,'')));
  if length(query)>160 then raise exception 'Busca muito longa'; end if;
  with selected as materialized (
    select a.*,u.email,u.created_at,u.last_sign_in_at,p.name as partner_name
    from private.roles a join auth.users u on u.id=a.user_id left join private.partners p on p.id=a.partner_id
    where a.role in ('admin','support','viewer','partner') and (p_at is null or (u.created_at,a.user_id)<(p_at,p_id))
      and (query='' or position(query in lower(coalesce(u.email,'')||' '||coalesce(p.name,'')))>0)
    order by u.created_at desc,a.user_id desc limit p_limit+1
  ) select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'email',email,'role',role,'active',active,
    'partnerId',partner_id,'partnerName',partner_name,'createdAt',created_at,'lastSignInAt',last_sign_in_at,'revision',revision)
    order by created_at desc,user_id desc),'[]') into items from selected;
  more:=jsonb_array_length(items)>p_limit;
  if more then items:=items-p_limit; end if;
  last_row:=items->(jsonb_array_length(items)-1);
  return jsonb_build_object('items',items,'hasMore',more,'nextCursor',case when more then jsonb_build_object('at',last_row->>'createdAt','id',last_row->>'id') end);
end $$;

create function public.rk_update_staff_access(p_user uuid,p_role text,p_partner uuid,p_active boolean,p_revision integer,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare r private.roles; target private.roles;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rkmed.staff-management',0));
  r:=private.actor();
  if r.role<>'admin' then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_user=r.user_id then raise exception 'Solicite a outro administrador a alteração do seu próprio acesso.'; end if;
  if p_role is null or p_role not in ('admin','support','viewer','partner') or p_active is null
    or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Informe perfil e motivo válidos.'; end if;
  if (p_role='partner')<>(p_partner is not null) or (p_role='partner' and not exists(select 1 from private.partners where id=p_partner and (not p_active or active))) then
    raise exception 'Estabelecimento inválido para este perfil.'; end if;
  select * into target from private.roles where user_id=p_user and role in ('admin','support','viewer','partner') for update;
  if not found then raise exception 'Acesso interno não encontrado'; end if;
  if target.revision is distinct from p_revision then raise exception 'Acesso alterado por outro operador. Atualize a lista.'; end if;
  if target.active and target.role='admin' and (not p_active or p_role<>'admin')
    and not exists(select 1 from private.roles where role='admin' and active and user_id<>p_user) then
    raise exception 'O sistema precisa de pelo menos um administrador ativo.'; end if;
  if target.role=p_role and target.partner_id is not distinct from p_partner and target.active=p_active then return; end if;
  update private.roles set role=p_role,partner_id=p_partner,active=p_active,revision=revision+1,sessions_valid_after=clock_timestamp() where user_id=p_user;
  delete from private.work_sessions where user_id=p_user;
  perform private.log('staff.access.update',p_user,trim(p_reason)||format(E'\nPerfil: %s → %s. Ativo: %s → %s. Estabelecimento: %s → %s.',target.role,p_role,target.active,p_active,target.partner_id,p_partner));
end $$;

create function public.rk_staff_access_audit(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin
  r:=private.actor();
  if r.role<>'admin' then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',a.id::text,'action',a.action,'reason',a.reason,'createdAt',a.created_at,'actorEmail',u.email)
    order by a.created_at desc,a.id desc),'[]') from
    (select * from private.audit where target_id=p_user and action like 'staff.%' order by created_at desc,id desc limit 20) a
    left join auth.users u on u.id=a.actor_id);
end $$;

create function public.rk_backend_staff_authorize(p_actor uuid,p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
begin perform private.service_only(); perform private.require_staff_admin(p_actor,p_session); end $$;

create function public.rk_backend_staff_provision(p_actor uuid,p_session uuid,p_user uuid,p_role text,p_partner uuid,p_operation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rkmed.staff-management',0));
  perform private.require_staff_admin(p_actor,p_session);
  if p_role is null or p_role not in ('admin','support','viewer','partner') or (p_role='partner')<>(p_partner is not null)
    or (p_role='partner' and not exists(select 1 from private.partners where id=p_partner and active)) then raise exception 'Perfil ou estabelecimento inválido'; end if;
  if exists(select 1 from private.members where id=p_user) or exists(select 1 from private.roles where user_id=p_user)
    or exists(select 1 from private.audit where correlation_id=p_operation and action='staff.created') then raise exception 'Acesso já existente ou operação reutilizada'; end if;
  insert into private.roles(user_id,role,partner_id) values(p_user,p_role,p_partner);
  insert into private.audit(actor_id,action,target_id,session_id,correlation_id,reason)
    values(p_actor,'staff.created',p_user,p_session,p_operation,'Novo acesso: '||p_role);
end $$;

create table private.staff_password_operations (
  operation_id uuid primary key, actor_id uuid not null, target_id uuid not null references auth.users(id),
  expected_revision integer not null, applied_revision integer not null, reason text not null,
  status text not null check(status in ('pending','succeeded','failed')), owner uuid not null,
  lease_until timestamptz not null, created_at timestamptz not null default now()
);
alter table private.staff_password_operations enable row level security;
revoke all on private.staff_password_operations from public,anon,authenticated,service_role;
create unique index staff_password_pending on private.staff_password_operations(target_id) where status='pending';

create function public.rk_backend_staff_password_begin(p_actor uuid,p_session uuid,p_user uuid,p_revision integer,p_reason text,p_operation uuid,p_owner uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target private.roles; previous private.staff_password_operations;
begin
  perform private.service_only();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rkmed.staff-management',0));
  perform private.require_staff_admin(p_actor,p_session);
  if p_actor=p_user then raise exception 'Solicite a outro administrador a redefinição da sua senha.'; end if;
  if p_operation is null or p_owner is null or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Informe operação e motivo válidos.'; end if;
  select * into target from private.roles where user_id=p_user and active and role in ('admin','support','viewer','partner') for update;
  if not found then raise exception 'Acesso interno ativo não encontrado'; end if;
  select * into previous from private.staff_password_operations where operation_id=p_operation for update;
  if found then
    if previous.actor_id<>p_actor or previous.target_id<>p_user or previous.expected_revision<>p_revision or previous.reason<>trim(p_reason) then raise exception 'Operação reutilizada com outros dados'; end if;
    if previous.status='succeeded' then return jsonb_build_object('status','succeeded'); end if;
    if previous.status='pending' and previous.lease_until>now() then return jsonb_build_object('status','busy'); end if;
    if target.revision<>previous.applied_revision then raise exception 'Acesso alterado. Atualize a lista.'; end if;
  elsif target.revision is distinct from p_revision then raise exception 'Acesso alterado. Atualize a lista.'; end if;
  if exists(select 1 from private.staff_password_operations where target_id=p_user and status='pending' and operation_id<>p_operation and lease_until>now()) then return jsonb_build_object('status','busy'); end if;
  update private.staff_password_operations set status='failed' where target_id=p_user and status='pending' and operation_id<>p_operation and lease_until<=now();
  update private.roles set revision=revision+1,sessions_valid_after=clock_timestamp() where user_id=p_user returning * into target;
  delete from private.work_sessions where user_id=p_user;
  insert into private.staff_password_operations(operation_id,actor_id,target_id,expected_revision,applied_revision,reason,status,owner,lease_until)
    values(p_operation,p_actor,p_user,p_revision,target.revision,trim(p_reason),'pending',p_owner,now()+interval '2 minutes')
    on conflict(operation_id) do update set status='pending',owner=excluded.owner,lease_until=excluded.lease_until,applied_revision=excluded.applied_revision;
  insert into private.audit(actor_id,action,target_id,session_id,correlation_id,reason)
    values(p_actor,'staff.password.requested',p_user,p_session,p_operation,trim(p_reason));
  return jsonb_build_object('status','pending');
end $$;

create function public.rk_backend_staff_password_finish(p_operation uuid,p_owner uuid,p_success boolean) returns void
language plpgsql security definer set search_path='' as $$
declare operation private.staff_password_operations;
begin
  perform private.service_only();
  update private.staff_password_operations set status=case when p_success then 'succeeded' else 'failed' end
    where operation_id=p_operation and owner=p_owner and status='pending' and lease_until>now() returning * into operation;
  if not found then raise exception 'Operação expirada. Atualize a lista.'; end if;
  insert into private.audit(actor_id,action,target_id,correlation_id,reason)
    values(operation.actor_id,'staff.password.'||case when p_success then 'succeeded' else 'failed' end,operation.target_id,p_operation,operation.reason);
end $$;

revoke all on function public.rk_staff_accounts(integer,timestamptz,uuid,text),public.rk_update_staff_access(uuid,text,uuid,boolean,integer,text),public.rk_staff_access_audit(uuid) from public,anon;
grant execute on function public.rk_staff_accounts(integer,timestamptz,uuid,text),public.rk_update_staff_access(uuid,text,uuid,boolean,integer,text),public.rk_staff_access_audit(uuid) to authenticated;
revoke all on function public.rk_backend_staff_authorize(uuid,uuid),public.rk_backend_staff_provision(uuid,uuid,uuid,text,uuid,uuid),public.rk_backend_staff_password_begin(uuid,uuid,uuid,integer,text,uuid,uuid),public.rk_backend_staff_password_finish(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.rk_backend_staff_authorize(uuid,uuid),public.rk_backend_staff_provision(uuid,uuid,uuid,text,uuid,uuid),public.rk_backend_staff_password_begin(uuid,uuid,uuid,integer,text,uuid,uuid),public.rk_backend_staff_password_finish(uuid,uuid,boolean) to service_role;
