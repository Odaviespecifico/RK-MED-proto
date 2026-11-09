alter table private.partners add column is_test boolean not null default false;

-- No credential plaintext is retained. Reservations make uncertain Auth responses recoverable.
create table private.test_partner_operations (
  operation_id uuid primary key, actor_id uuid not null, auth_user_id uuid not null unique default gen_random_uuid(),
  email text not null unique, details jsonb not null, employee_code_hash text not null,
  owner uuid not null, lease_until timestamptz not null, status text not null default 'pending' check(status in ('pending','succeeded')),
  result jsonb, created_at timestamptz not null default now(),
  check ((status='succeeded')=(result is not null))
);
alter table private.test_partner_operations enable row level security;
revoke all on private.test_partner_operations from public,anon,authenticated,service_role;

create function private.test_partner_guard(p_actor uuid,p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if coalesce((select value from private.settings where key='environment'),'') not in ('local','sandbox') then
    raise exception 'Cadastro de teste indisponível neste ambiente.' using errcode='42501'; end if;
  perform private.require_staff_admin(p_actor,p_session);
end $$;
revoke all on function private.test_partner_guard(uuid,uuid) from public,anon,authenticated,service_role;

create function public.rk_backend_test_partner_begin(p_actor uuid,p_session uuid,p_operation uuid,p_owner uuid,p_email text,p_details jsonb,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous private.test_partner_operations; normalized jsonb; mail text;
begin
  perform private.test_partner_guard(p_actor,p_session);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rkmed.staff-management',0));
  perform private.test_partner_guard(p_actor,p_session);
  mail:=lower(trim(coalesce(p_email,'')));
  if p_operation is null or p_owner is null or length(mail)>254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_code is null or p_code !~ '^[0-9]{4,12}$' or jsonb_typeof(p_details) is distinct from 'object' then raise exception 'Dados do cadastro inválidos.'; end if;
  if length(trim(coalesce(p_details->>'name',''))) not between 2 and 160
    or length(trim(coalesce(p_details->>'segment',''))) not between 1 and 160
    or length(trim(coalesce(p_details->>'address',''))) not between 1 and 500
    or length(trim(coalesce(p_details->>'employeeName',''))) not between 2 and 160
    or coalesce(p_details->>'discountBps','') !~ '^[0-9]{1,5}$' then raise exception 'Dados do estabelecimento ou funcionário inválidos.'; end if;
  if (p_details->>'discountBps')::integer not between 0 and 10000 then raise exception 'Desconto inválido.'; end if;
  normalized:=jsonb_build_object('name',trim(p_details->>'name'),'segment',trim(p_details->>'segment'),
    'address',trim(p_details->>'address'),'employeeName',trim(p_details->>'employeeName'),'discountBps',(p_details->>'discountBps')::integer);
  select * into previous from private.test_partner_operations where operation_id=p_operation or email=mail order by operation_id=p_operation desc limit 1 for update;
  if found then
    if previous.actor_id<>p_actor or previous.email<>mail or previous.details<>normalized
      or previous.employee_code_hash<>extensions.crypt(p_code,previous.employee_code_hash) then raise exception 'Já existe um cadastro com estes identificadores. Retome com os mesmos dados.'; end if;
    if previous.status='succeeded' then return jsonb_build_object('status','succeeded','result',previous.result); end if;
    if previous.lease_until>now() then return jsonb_build_object('status','busy'); end if;
    update private.test_partner_operations set owner=p_owner,lease_until=clock_timestamp()+interval '2 minutes' where operation_id=previous.operation_id returning * into previous;
  else
    if exists(select 1 from auth.users where lower(email)=mail) then raise exception 'Este e-mail já está cadastrado. Use outro e-mail para o parceiro de teste.'; end if;
    insert into private.test_partner_operations(operation_id,actor_id,email,details,employee_code_hash,owner,lease_until)
      values(p_operation,p_actor,mail,normalized,extensions.crypt(p_code,extensions.gen_salt('bf')),p_owner,clock_timestamp()+interval '2 minutes') returning * into previous;
    insert into private.audit(actor_id,session_id,action,correlation_id,reason) values(p_actor,p_session,'test_partner.requested',p_operation,'Cadastro completo de parceiro de teste');
  end if;
  return jsonb_build_object('status','pending','operationId',previous.operation_id,'authUserId',previous.auth_user_id);
end $$;

create function public.rk_backend_test_partner_finish(p_actor uuid,p_session uuid,p_operation uuid,p_owner uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare operation private.test_partner_operations; partner uuid; completed jsonb;
begin
  perform private.test_partner_guard(p_actor,p_session);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rkmed.staff-management',0));
  perform private.test_partner_guard(p_actor,p_session);
  select * into operation from private.test_partner_operations where operation_id=p_operation and actor_id=p_actor for update;
  if not found then raise exception 'Cadastro não encontrado.'; end if;
  if operation.status='succeeded' then return operation.result; end if;
  if operation.owner<>p_owner or operation.lease_until<=clock_timestamp() then raise exception 'Cadastro em andamento. Aguarde e tente novamente com os mesmos dados.'; end if;
  if not exists(select 1 from auth.users where id=operation.auth_user_id and lower(email)=operation.email and email_confirmed_at is not null
    and raw_app_meta_data->>'rkmed_test_partner_operation'=p_operation::text)
    or exists(select 1 from private.roles where user_id=operation.auth_user_id)
    or exists(select 1 from private.members where id=operation.auth_user_id) then raise exception 'Não foi possível vincular a conta. Retome o cadastro.'; end if;
  insert into private.partners(name,segment,address,discount_bps,is_test) values(operation.details->>'name',operation.details->>'segment',operation.details->>'address',(operation.details->>'discountBps')::integer,true) returning id into partner;
  insert into private.employees(partner_id,name,code_hash) values(partner,operation.details->>'employeeName',operation.employee_code_hash);
  insert into private.roles(user_id,role,partner_id) values(operation.auth_user_id,'partner',partner);
  select jsonb_build_object('partnerId',p.id,'name',p.name,'email',operation.email,'employeeName',operation.details->>'employeeName',
    'establishmentCode',p.entry_code,'isTest',true) into completed from private.partners p where p.id=partner;
  update private.test_partner_operations set status='succeeded',result=completed where operation_id=p_operation;
  insert into private.audit(actor_id,session_id,action,target_id,correlation_id,reason) values
    (p_actor,p_session,'partner.test.created',partner,p_operation,'Parceiro de teste criado com funcionário e acesso'),
    (p_actor,p_session,'staff.created',operation.auth_user_id,p_operation,'Novo acesso: parceiro de teste');
  return completed;
end $$;

create function public.rk_backend_test_partner_release(p_actor uuid,p_operation uuid,p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  update private.test_partner_operations set lease_until=clock_timestamp()
    where actor_id=p_actor and operation_id=p_operation and owner=p_owner and status='pending';
end $$;
revoke all on function public.rk_backend_test_partner_begin(uuid,uuid,uuid,uuid,text,jsonb,text),public.rk_backend_test_partner_finish(uuid,uuid,uuid,uuid),public.rk_backend_test_partner_release(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.rk_backend_test_partner_begin(uuid,uuid,uuid,uuid,text,jsonb,text),public.rk_backend_test_partner_finish(uuid,uuid,uuid,uuid),public.rk_backend_test_partner_release(uuid,uuid,uuid) to service_role;

create or replace function public.rk_partners() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'segment',segment,'address',address,
    'discount',discount_bps/100.0,'initials',upper(left(name,2)),'tone','sage') order by name),'[]')
  from private.partners where active and not is_test;
$$;

create or replace function private.actor() returns private.roles language plpgsql security definer set search_path='' as $$
declare r private.roles; s auth.sessions; sid uuid; last_activity timestamptz;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  if exists(select 1 from private.test_partner_operations where auth_user_id=auth.uid() and status<>'succeeded') then raise exception 'Cadastro de parceiro em andamento. Procure a administração.' using errcode='42501'; end if;
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

create or replace function public.rk_context() returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; result jsonb; card text;
begin
  r:=private.actor();
  result:=jsonb_build_object('userId',r.user_id,'role',r.role,'partnerId',r.partner_id);
  if r.role='member' then
    select extensions.pgp_sym_decrypt(c.encrypted_token,(select value from private.settings where key='qr_key'))
      into card from private.credentials c where c.member_id=r.user_id;
    select result||jsonb_build_object('member',jsonb_build_object('id',m.id,'name',m.name,
      'cpf', '***.***.***-'||right(i.cpf,2),'photoPath',m.photo_path,'cardToken',card,
      'eligible',private.eligible(m.id),'blocked',m.blocked,'paidThrough',s.paid_through,
      'billingState',s.state,'cancelAtPeriodEnd',s.cancel_at_period_end,'joinedAt',m.created_at,
      'email',u.email,'phone',case when u.phone is null then null else '•••• '||right(u.phone,4) end))
      into result from private.members m join private.member_identity i on i.member_id=m.id
      join private.subscriptions s on s.member_id=m.id join auth.users u on u.id=m.id where m.id=r.user_id;
  elsif r.role='partner' then
    select result||jsonb_build_object('workSession',jsonb_build_object('employeeId',e.id,'employeeName',e.name,'partnerId',w.partner_id))
      into result from private.work_sessions w join private.employees e on e.id=w.employee_id
      where w.session_id=nullif(auth.jwt()->>'session_id','')::uuid and e.active;
    result:=coalesce(result,jsonb_build_object('userId',r.user_id,'role',r.role,'partnerId',r.partner_id));
  end if;
  if r.role='partner' then
    select result||jsonb_build_object('partner',jsonb_build_object('id',id,'name',name,'segment',segment,'address',address,'discount',discount_bps/100.0,'initials',upper(left(name,2)),'tone','sage','isTest',is_test)) into result from private.partners where id=r.partner_id;
  end if;
  return result;
end $$;
create or replace function public.rk_staff_partners() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin
  r:=private.actor();
  if r.role not in ('admin','support','viewer') then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'segment',segment,
    'address',address,'discount',discount_bps/100.0,'initials',upper(left(name,2)),
    'tone','sage','active',active,'isTest',is_test,
    'establishmentCode',case when r.role in ('admin','support') then entry_code else null end)
    order by name),'[]') from private.partners);
end $$;

create or replace function public.rk_staff_accounts(p_limit integer default 25,p_at timestamptz default null,p_id uuid default null,p_query text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; items jsonb; more boolean; last_row jsonb; query text;
begin
  r:=private.actor();
  if r.role<>'admin' then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform private.check_page(p_limit,p_at,p_id);
  query:=lower(trim(coalesce(p_query,'')));
  if length(query)>160 then raise exception 'Busca muito longa'; end if;
  with selected as materialized (
    select a.*,u.email,u.created_at,u.last_sign_in_at,p.name as partner_name,p.is_test
    from private.roles a join auth.users u on u.id=a.user_id left join private.partners p on p.id=a.partner_id
    where a.role in ('admin','support','viewer','partner') and (p_at is null or (u.created_at,a.user_id)<(p_at,p_id))
      and (query='' or position(query in lower(coalesce(u.email,'')||' '||coalesce(p.name,'')))>0)
    order by u.created_at desc,a.user_id desc limit p_limit+1
  ) select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'email',email,'role',role,'active',active,
    'isTest',coalesce(is_test,false),'partnerId',partner_id,'partnerName',partner_name,'createdAt',created_at,'lastSignInAt',last_sign_in_at,'revision',revision)
    order by created_at desc,user_id desc),'[]') into items from selected;
  more:=jsonb_array_length(items)>p_limit;
  if more then items:=items-p_limit; end if;
  last_row:=items->(jsonb_array_length(items)-1);
  return jsonb_build_object('items',items,'hasMore',more,'nextCursor',case when more then jsonb_build_object('at',last_row->>'createdAt','id',last_row->>'id') end);
end $$;


-- D30: a área do associado passa a consultar a própria assinatura e a reativar
-- um cancelamento agendado. Mantém o mesmo limite por ator/ação.
create or replace function public.rk_backend_rate(p_actor uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.service_only();
  if p_action not in ('checkout','portal','cancel','resume','subscription','collection','staff','photo','test-partner') then raise exception 'Ação inválida'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text||p_action,0));
  if (select count(*) from private.audit where actor_id=p_actor and action='command.'||p_action and created_at>now()-interval '1 minute')>=5 then
    raise exception 'Aguarde antes de tentar novamente.'; end if;
  insert into private.audit(actor_id,action) values(p_actor,'command.'||p_action);
end $$;
revoke all on function public.rk_backend_rate(uuid,text) from public,anon,authenticated;
grant execute on function public.rk_backend_rate(uuid,text) to service_role;

