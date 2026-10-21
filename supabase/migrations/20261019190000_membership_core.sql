-- RF-QR/RF-PP/RF-ADM: private domain; browsers cross narrow, authenticated RPCs only.
create extension if not exists pgcrypto with schema extensions;

create table private.settings (key text primary key, value text not null);
insert into private.settings values ('environment', 'local'), ('qr_key', encode(extensions.gen_random_bytes(32), 'hex'));
create table private.partners (
  id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 2 and 160),
  segment text not null, address text not null, discount_bps integer not null check (discount_bps between 0 and 10000),
  active boolean not null default true, created_at timestamptz not null default now()
);
create table private.roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('member','partner','admin','support','viewer')),
  partner_id uuid references private.partners(id), active boolean not null default true,
  check ((role = 'partner') = (partner_id is not null))
);
create table private.members (
  id uuid primary key references auth.users(id), name text not null check (length(name) between 2 and 160),
  birth_date date not null, photo_path text, blocked boolean not null default false,
  block_reason text, created_at timestamptz not null default now()
);
create table private.member_identity (
  member_id uuid primary key references private.members(id), cpf text not null unique check (cpf ~ '^[0-9]{11}$')
);
create table private.subscriptions (
  member_id uuid primary key references private.members(id), customer_id text unique, subscription_id text unique,
  state text not null default 'incomplete' check (state in ('incomplete','active','past_due','canceled')),
  paid_through timestamptz, cancel_at_period_end boolean not null default false,
  invoice_id text, amount_due bigint not null default 6960, updated_at timestamptz not null default now()
);
create table private.credentials (
  member_id uuid primary key references private.members(id), token_hash bytea not null unique,
  encrypted_token bytea not null, issued_at timestamptz not null default now()
);
create table private.employees (
  id uuid primary key default gen_random_uuid(), partner_id uuid not null references private.partners(id),
  name text not null, code_hash text not null, active boolean not null default true
);
create table private.staff_activity (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  last_seen timestamptz not null default now()
);
create table private.work_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id), employee_id uuid not null references private.employees(id),
  partner_id uuid not null references private.partners(id), started_at timestamptz not null default now()
);
create table private.validations (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references private.members(id),
  session_id uuid not null, employee_id uuid not null references private.employees(id), partner_id uuid not null references private.partners(id),
  expires_at timestamptz not null default now() + interval '5 minutes', consumed_at timestamptz
);
create table private.purchases (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null, receipt_id uuid not null unique references private.validations(id),
  member_id uuid not null references private.members(id), partner_id uuid not null references private.partners(id),
  employee_id uuid not null references private.employees(id), employee_name text not null, actor_id uuid not null,
  gross_cents bigint not null check (gross_cents between 1 and 9007199254740991), discount_bps integer not null,
  discount_cents bigint not null, final_cents bigint not null, created_at timestamptz not null default now(),
  unique(actor_id, operation_id), check (discount_cents + final_cents = gross_cents),
  check (discount_cents between 0 and gross_cents), check (discount_bps between 0 and 10000)
);
create table private.reversals (
  id uuid primary key default gen_random_uuid(), purchase_id uuid not null unique references private.purchases(id),
  actor_id uuid not null, reason text not null check (length(trim(reason)) between 3 and 1000), created_at timestamptz not null default now()
);
create table private.audit (
  id bigint generated always as identity primary key, actor_id uuid, action text not null, target_id uuid,
  reason text, correlation_id uuid not null default gen_random_uuid(), session_id uuid,
  created_at timestamptz not null default now()
);
create index audit_rate_limit on private.audit(session_id, action, created_at);
create index audit_actor_rate_limit on private.audit(actor_id, action, created_at);
create index purchases_member_date on private.purchases(member_id, created_at desc);
create index purchases_partner_date on private.purchases(partner_id, created_at desc);
create table private.documents (
  version text primary key, kind text not null check (kind in ('terms','privacy','photo')),
  content text not null, test_only boolean not null default true, active boolean not null default true
);
create table private.consents (
  member_id uuid not null references private.members(id), version text not null references private.documents(version),
  accepted_at timestamptz not null default now(), primary key(member_id, version)
);
create table private.webhook_events (
  event_id text primary key, event_type text not null, object_id text not null, provider_created bigint not null,
  status text not null default 'pending' check (status in ('pending','processed','failed')),
  attempts integer not null default 0, last_error text, created_at timestamptz not null default now()
);
create table private.notification_outbox (
  id uuid primary key default gen_random_uuid(), member_id uuid references private.members(id),
  event_key text not null unique, kind text not null, status text not null default 'pending',
  attempts integer not null default 0, next_attempt timestamptz not null default now(), created_at timestamptz not null default now()
);
create table private.collection_operations (
  operation_id uuid primary key, member_id uuid not null references private.members(id), actor_id uuid not null,
  invoice_id text not null, action text not null check (action in ('link','retry')),
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  created_at timestamptz not null default now()
);

-- No domain table is exposed. RLS and grants deny direct access even if a schema is accidentally exposed.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='private' loop
    execute format('alter table private.%I enable row level security', t);
    execute format('revoke all on private.%I from public, anon, authenticated', t);
  end loop;
end $$;

create function private.immutable_record() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Registro imutável' using errcode='42501'; end $$;
create trigger audit_immutable before update or delete on private.audit for each row execute function private.immutable_record();
create trigger purchase_immutable before update or delete on private.purchases for each row execute function private.immutable_record();
create trigger reversal_immutable before update or delete on private.reversals for each row execute function private.immutable_record();
create trigger consent_immutable before update or delete on private.consents for each row execute function private.immutable_record();

create function private.actor() returns private.roles language plpgsql security definer set search_path='' as $$
declare r private.roles; s auth.sessions; sid uuid; last_activity timestamptz;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  sid := nullif(auth.jwt()->>'session_id','')::uuid;
  select * into s from auth.sessions where id=sid and user_id=auth.uid();
  if not found or (s.not_after is not null and s.not_after <= now()) then
    raise exception 'Sessão expirada. Entre novamente.' using errcode='42501';
  end if;
  select * into r from private.roles where user_id=auth.uid() and active;
  if not found then r.user_id:=auth.uid(); r.role:='pending'; r.active:=true; end if;
  if r.role not in ('member','pending') then
    select last_seen into last_activity from private.staff_activity where session_id=sid for update;
    if s.created_at + interval '8 hours' <= now() or coalesce(last_activity,s.created_at)+interval '30 minutes' <= now() then
      raise exception 'Sessão da equipe expirada. Entre novamente.' using errcode='42501';
    end if;
    insert into private.staff_activity(session_id,last_seen) values(sid,now()) on conflict(session_id) do update set last_seen=excluded.last_seen;
  end if;
  return r;
end $$;

create function private.log(action text, target uuid default null, reason text default null) returns void
language sql security definer set search_path='' as $$
  insert into private.audit(actor_id,action,target_id,reason,session_id)
  values(auth.uid(),action,target,left(reason,1000),nullif(auth.jwt()->>'session_id','')::uuid);
$$;

create function private.eligible(member uuid) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select not m.blocked and s.state='active' and s.paid_through>now()
    from private.members m join private.subscriptions s on s.member_id=m.id where m.id=member),false);
$$;

create function private.work() returns private.work_sessions language plpgsql security definer set search_path='' as $$
declare r private.roles; w private.work_sessions;
begin
  r:=private.actor();
  if r.role<>'partner' then raise exception 'Acesso do parceiro necessário' using errcode='42501'; end if;
  select s.* into w from private.work_sessions s join private.employees e on e.id=s.employee_id
    join private.partners p on p.id=s.partner_id
    where s.session_id=nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=r.user_id
      and s.partner_id=r.partner_id and e.active and e.partner_id=p.id and p.active for update of s for share of e,p;
  if not found then raise exception 'Valide o código de um funcionário ativo.' using errcode='42501'; end if;
  return w;
end $$;

create function public.rk_partners() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'segment',segment,'address',address,
    'discount',discount_bps/100.0,'initials',upper(left(name,2)),'tone','sage') order by name),'[]')
  from private.partners where active;
$$;

create function public.rk_context() returns jsonb language plpgsql security definer set search_path='' as $$
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
      'billingState',s.state,'cancelAtPeriodEnd',s.cancel_at_period_end,'joinedAt',m.created_at))
      into result from private.members m join private.member_identity i on i.member_id=m.id
      join private.subscriptions s on s.member_id=m.id where m.id=r.user_id;
  elsif r.role='partner' then
    select result||jsonb_build_object('workSession',jsonb_build_object('employeeId',e.id,'employeeName',e.name,'partnerId',w.partner_id))
      into result from private.work_sessions w join private.employees e on e.id=w.employee_id
      where w.session_id=nullif(auth.jwt()->>'session_id','')::uuid and e.active;
    result:=coalesce(result,jsonb_build_object('userId',r.user_id,'role',r.role,'partnerId',r.partner_id));
  end if;
  return result;
end $$;

create function public.rk_start_work(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; e private.employees;
begin
  r:=private.actor();
  if r.role<>'partner' then raise exception 'Acesso negado' using errcode='42501'; end if;
  if (select count(*) from private.audit where actor_id=r.user_id
    and action='work.start' and created_at>now()-interval '1 minute')>=10 then
    raise exception 'Aguarde antes de tentar outro código.' using errcode='42501'; end if;
  perform private.log('work.start');
  select * into e from private.employees where partner_id=r.partner_id and active and code_hash=extensions.crypt(p_code,code_hash);
  if not found or not exists(select 1 from private.partners where id=r.partner_id and active) then
    return jsonb_build_object('error','Código inválido ou funcionário inativo.'); end if;
  insert into private.work_sessions(session_id,user_id,employee_id,partner_id)
    values(nullif(auth.jwt()->>'session_id','')::uuid,r.user_id,e.id,r.partner_id)
    on conflict(session_id) do update set employee_id=excluded.employee_id,partner_id=excluded.partner_id,started_at=now();
  return public.rk_context();
end $$;

create function public.rk_end_work() returns void language plpgsql security definer set search_path='' as $$
declare r private.roles; begin
  r:=private.actor();
  delete from private.work_sessions where session_id=nullif(auth.jwt()->>'session_id','')::uuid and user_id=r.user_id;
  perform private.log('work.end');
end $$;

create function public.rk_validate_member(p_lookup text, p_method text) returns jsonb language plpgsql security definer set search_path='' as $$
declare w private.work_sessions; mid uuid; receipt uuid; result jsonb;
begin
  w:=private.work();
  if (select count(*) from private.audit where session_id=w.session_id and action='member.lookup'
    and created_at>now()-interval '1 minute')>=30 then raise exception 'Limite de consultas atingido. Aguarde.' using errcode='42501'; end if;
  if p_method='qr' and length(p_lookup) between 32 and 128 then
    select member_id into mid from private.credentials where token_hash=extensions.digest(p_lookup,'sha256');
  elsif p_method='cpf' and p_lookup~'^[0-9]{11}$' then
    select member_id into mid from private.member_identity where cpf=p_lookup;
  else raise exception 'Consulta inválida'; end if;
  perform private.log('member.lookup',mid);
  if mid is null then return jsonb_build_object('found',false); end if;
  if private.eligible(mid) then
    insert into private.validations(member_id,session_id,employee_id,partner_id)
      values(mid,w.session_id,w.employee_id,w.partner_id) returning id into receipt;
  end if;
  select jsonb_build_object('found',true,'id',m.id,'name',m.name,'photoPath',m.photo_path,
    'cpf','***.***.***-'||right(i.cpf,2),'eligible',private.eligible(m.id),'receipt',receipt)
    into result from private.members m join private.member_identity i on i.member_id=m.id where m.id=mid;
  return result;
end $$;

create function public.rk_quote(p_receipt uuid,p_gross bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w private.work_sessions; v private.validations; rate integer; discount bigint;
begin
  w:=private.work();
  select * into v from private.validations where id=p_receipt and session_id=w.session_id and employee_id=w.employee_id
    and partner_id=w.partner_id and expires_at>now() and consumed_at is null;
  if not found or not private.eligible(v.member_id) then raise exception 'Validação indisponível' using errcode='42501'; end if;
  if p_gross is null or p_gross<1 or p_gross>9007199254740991 then raise exception 'Valor inválido'; end if;
  select discount_bps into rate from private.partners where id=w.partner_id and active;
  if rate is null then raise exception 'Parceiro indisponível'; end if;
  discount:=floor((p_gross::numeric*rate+5000)/10000)::bigint;
  return jsonb_build_object('grossCents',p_gross,'discountBps',rate,'discountCents',discount,'finalCents',p_gross-discount);
end $$;

create function public.rk_commit_purchase(p_receipt uuid,p_gross bigint,p_operation uuid,p_quote_bps integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w private.work_sessions; v private.validations; old private.purchases; rate integer; discount bigint; purchase uuid;
begin
  w:=private.work();
  select * into old from private.purchases where actor_id=w.user_id and operation_id=p_operation;
  if found then
    if old.receipt_id<>p_receipt or old.gross_cents<>p_gross or old.partner_id<>w.partner_id then raise exception 'Chave de operação reutilizada com outros dados'; end if;
    return jsonb_build_object('id',old.id,'grossCents',old.gross_cents,'discountCents',old.discount_cents,'finalCents',old.final_cents,'duplicate',true);
  end if;
  if p_gross is null or p_gross<1 or p_gross>9007199254740991 or p_operation is null then raise exception 'Valor ou operação inválida'; end if;
  select * into v from private.validations where id=p_receipt for update;
  if not found or v.session_id<>w.session_id or v.employee_id<>w.employee_id or v.partner_id<>w.partner_id
    or v.expires_at<=now() or v.consumed_at is not null then raise exception 'Validação expirada ou inválida' using errcode='42501'; end if;
  perform 1 from private.members where id=v.member_id for update;
  if not private.eligible(v.member_id) then raise exception 'Associado sem benefício disponível' using errcode='42501'; end if;
  select discount_bps into rate from private.partners where id=w.partner_id and active for share;
  if rate is null then raise exception 'Parceiro indisponível' using errcode='42501'; end if;
  if p_quote_bps is distinct from rate then raise exception 'Desconto alterado. Confira novamente os valores.'; end if;
  discount:=floor((p_gross::numeric*rate+5000)/10000)::bigint;
  insert into private.purchases(operation_id,receipt_id,member_id,partner_id,employee_id,employee_name,actor_id,
    gross_cents,discount_bps,discount_cents,final_cents)
    select p_operation,v.id,v.member_id,w.partner_id,w.employee_id,e.name,w.user_id,p_gross,rate,discount,p_gross-discount
    from private.employees e where e.id=w.employee_id and e.active returning id into purchase;
  if purchase is null then raise exception 'Funcionário inativo' using errcode='42501'; end if;
  update private.validations set consumed_at=now() where id=v.id;
  perform private.log('purchase.commit',purchase);
  return jsonb_build_object('id',purchase,'grossCents',p_gross,'discountCents',discount,'finalCents',p_gross-discount,'duplicate',false);
end $$;

create function public.rk_reverse_purchase(p_purchase uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r private.roles; reversal uuid; begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform 1 from private.purchases where id=p_purchase for update;
  if not found then raise exception 'Compra não encontrada'; end if;
  select id into reversal from private.reversals where purchase_id=p_purchase;
  if found then return reversal; end if;
  insert into private.reversals(purchase_id,actor_id,reason) values(p_purchase,r.user_id,trim(p_reason)) returning id into reversal;
  perform private.log('purchase.reverse',p_purchase,p_reason);
  return reversal;
end $$;

create function public.rk_purchases() returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; begin
  r:=private.actor();
  return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'memberId',p.member_id,'memberName',m.name,
    'partnerId',p.partner_id,'partnerName',s.name,'employee',p.employee_name,'grossCents',p.gross_cents,
    'discountCents',p.discount_cents,'finalCents',p.final_cents,'createdAt',p.created_at,'reversedAt',v.created_at) order by p.created_at desc),'[]')
    from private.purchases p join private.partners s on s.id=p.partner_id join private.members m on m.id=p.member_id
      left join private.reversals v on v.purchase_id=p.id
    where (r.role='member' and p.member_id=r.user_id) or (r.role='partner' and p.partner_id=r.partner_id) or r.role in ('admin','support','viewer'));
end $$;

create function public.rk_admin_members() returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; begin
  r:=private.actor();
  if r.role not in ('admin','support','viewer') then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'cpf','***.***.***-'||right(i.cpf,2),
    'eligible',private.eligible(m.id),'blocked',m.blocked,'billingState',s.state,'paidThrough',s.paid_through,'joinedAt',m.created_at,
    'invoiceId',case when r.role<>'viewer' then s.invoice_id end,'amountDue',case when r.role<>'viewer' then s.amount_due end,
    'email',case when r.role<>'viewer' then u.email end,'phone',case when r.role<>'viewer' then u.phone end)),'[]')
    from private.members m join private.member_identity i on i.member_id=m.id join private.subscriptions s on s.member_id=m.id
      join auth.users u on u.id=m.id);
end $$;

create function public.rk_set_block(p_member uuid,p_blocked boolean,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare r private.roles; begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Informe o motivo'; end if;
  update private.members set blocked=p_blocked,block_reason=trim(p_reason) where id=p_member;
  if not found then raise exception 'Associado não encontrado'; end if;
  perform private.log(case when p_blocked then 'member.block' else 'member.unblock' end,p_member,p_reason);
end $$;

create function public.rk_save_partner(p_name text,p_segment text,p_address text,p_discount_bps integer,p_id uuid default null,p_active boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare r private.roles; target uuid; begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_id is null then
    insert into private.partners(name,segment,address,discount_bps,active) values(trim(p_name),trim(p_segment),trim(p_address),p_discount_bps,p_active) returning id into target;
  else
    update private.partners set name=trim(p_name),segment=trim(p_segment),address=trim(p_address),discount_bps=p_discount_bps,active=p_active where id=p_id returning id into target;
    if target is null then raise exception 'Parceiro não encontrado'; end if;
  end if;
  perform private.log('partner.save',target); return target;
end $$;

create function public.rk_employees() returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'partnerId',partner_id,'active',active)),'[]') from private.employees);
end $$;

create function public.rk_save_employee(p_partner uuid,p_name text,p_code text,p_id uuid default null,p_active boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare r private.roles; target uuid; begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_code !~ '^[0-9]{4,12}$' or length(trim(p_name))<2 then raise exception 'Nome ou código inválido'; end if;
  perform 1 from private.partners where id=p_partner for update;
  if not found then raise exception 'Parceiro não encontrado'; end if;
  if exists(select 1 from private.employees where partner_id=p_partner and id is distinct from p_id
    and code_hash=extensions.crypt(p_code,code_hash)) then raise exception 'Código já utilizado neste parceiro'; end if;
  if p_id is null then
    insert into private.employees(partner_id,name,code_hash,active) values(p_partner,trim(p_name),extensions.crypt(p_code,extensions.gen_salt('bf')),p_active) returning id into target;
  else
    update private.employees set partner_id=p_partner,name=trim(p_name),code_hash=extensions.crypt(p_code,extensions.gen_salt('bf')),active=p_active where id=p_id returning id into target;
    if target is null then raise exception 'Funcionário não encontrado'; end if;
  end if;
  perform private.log('employee.save',target); return target;
end $$;

create function public.rk_documents() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('version',version,'kind',kind,'content',content,'testOnly',test_only)),'[]')
  from private.documents where active and (not test_only or (select value from private.settings where key='environment')<>'production');
$$;

create function public.rk_enroll(p_name text,p_cpf text,p_birth date,p_versions text[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare r private.roles; u auth.users; token text; total integer; required text;
begin
  r:=private.actor();
  if r.role<>'pending' then raise exception 'Cadastro já existente ou perfil interno'; end if;
  select * into u from auth.users where id=r.user_id;
  if u.email_confirmed_at is null or u.phone_confirmed_at is null then raise exception 'Confirme e-mail e telefone na mesma conta.' using errcode='42501'; end if;
  if p_birth is null or p_birth>(now() at time zone 'America/Recife')::date-interval '18 years' or p_birth<date '1900-01-01' then raise exception 'Data de nascimento inválida'; end if;
  if p_cpf!~'^[0-9]{11}$' or p_cpf~'^([0-9])\1{10}$' then raise exception 'CPF inválido'; end if;
  for digits in 9..10 loop
    total:=0; for j in 1..digits loop total:=total+substring(p_cpf,j,1)::integer*(digits+2-j); end loop;
    total:=(total*10)%11; if total=10 then total:=0; end if;
    if total<>substring(p_cpf,digits+1,1)::integer then raise exception 'CPF inválido'; end if;
  end loop;
  foreach required in array array['terms','privacy','photo'] loop
    if not exists(select 1 from private.documents where kind=required and active and version=any(p_versions)
      and (not test_only or (select value from private.settings where key='environment')<>'production')) then raise exception 'Aceite documental obrigatório'; end if;
  end loop;
  insert into private.members(id,name,birth_date) values(r.user_id,trim(p_name),p_birth);
  insert into private.member_identity values(r.user_id,p_cpf);
  insert into private.roles(user_id,role) values(r.user_id,'member');
  insert into private.subscriptions(member_id) values(r.user_id);
  insert into private.consents(member_id,version) select r.user_id,version from private.documents where active and version=any(p_versions);
  token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into private.credentials(member_id,token_hash,encrypted_token) values(r.user_id,extensions.digest(token,'sha256'),
    extensions.pgp_sym_encrypt(token,(select value from private.settings where key='qr_key')));
  perform private.log('member.enroll',r.user_id);
  return r.user_id;
end $$;

create function private.photo_allowed(path text) returns boolean language plpgsql security definer set search_path='' as $$
declare r private.roles; begin
  r:=private.actor();
  if r.role in ('admin','support') then return true; end if;
  if r.role='member' then return path=r.user_id::text||'/photo.jpg'; end if;
  if r.role='partner' then return exists(select 1 from private.validations v join private.members m on m.id=v.member_id
    join private.work_sessions w on w.session_id=v.session_id and w.employee_id=v.employee_id
    join private.employees e on e.id=w.employee_id and e.active
    where v.session_id=nullif(auth.jwt()->>'session_id','')::uuid and v.expires_at>now() and m.photo_path=path); end if;
  return false;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('member-photos','member-photos',false,5242880,array['image/jpeg']) on conflict(id) do nothing;
create policy member_photos_read on storage.objects for select to authenticated using(bucket_id='member-photos' and private.photo_allowed(name));
-- Photo writes are performed only by the trusted image-processing Edge Function.

-- Explicitly revoke execute defaults, including private helpers. Only the named RPC surface is callable.
revoke all on all functions in schema private from public,anon,authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'rk_%' loop
    execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
    execute 'grant execute on function '||f.signature||' to authenticated';
  end loop;
end $$;
grant execute on function public.rk_partners(),public.rk_documents() to anon;
-- The compiled Storage policy references this helper by OID; private remains unexposed.
grant execute on function private.photo_allowed(text) to authenticated;
