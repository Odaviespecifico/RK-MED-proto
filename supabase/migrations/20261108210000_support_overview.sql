-- RF-ADM/DG: member support messages and an aggregate administration overview.
-- Browsers never read the private tables; all access is through authenticated RPCs.

create table private.support_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references private.members(id) on delete cascade,
  message text not null check (length(trim(message)) between 5 and 2000),
  status text not null default 'open' check (status in ('open','answered','closed')),
  response text check (response is null or length(trim(response)) between 2 and 2000),
  answered_at timestamptz,
  answered_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check ((status = 'answered') = (answered_at is not null))
);
create index support_requests_member_date on private.support_requests(member_id,created_at desc,id desc);
create index support_requests_status_date on private.support_requests(status,created_at desc,id desc);
alter table private.support_requests enable row level security;
revoke all on private.support_requests from public,anon,authenticated;

create function public.rk_open_support_request(p_message text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r private.roles; target uuid; message_text text;
begin
  r:=private.actor();
  if r.role<>'member' then raise exception 'Acesso negado' using errcode='42501'; end if;
  message_text:=trim(coalesce(p_message,''));
  if length(message_text)<5 or length(message_text)>2000 then
    raise exception 'Escreva uma mensagem entre 5 e 2000 caracteres.' using errcode='P0001';
  end if;
  if (select count(*) from private.audit where actor_id=r.user_id and action='support.open'
    and created_at>now()-interval '1 hour')>=5 then
    raise exception 'Aguarde antes de enviar outra mensagem.' using errcode='42501';
  end if;
  insert into private.support_requests(member_id,message) values(r.user_id,message_text) returning id into target;
  perform private.log('support.open',target);
  return target;
end $$;
revoke all on function public.rk_open_support_request(text) from public,anon;
grant execute on function public.rk_open_support_request(text) to authenticated;

create function public.rk_support_requests(p_limit integer default 25,p_at timestamptz default null,p_id uuid default null,p_status text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; items jsonb; more boolean; last_row jsonb; status_filter text;
begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform private.check_page(p_limit,p_at,p_id);
  status_filter:=trim(coalesce(p_status,''));
  if status_filter<>'' and status_filter not in ('open','answered','closed') then
    raise exception 'Situação inválida' using errcode='P0001';
  end if;
  with selected as materialized (
    select s.* from private.support_requests s
    where (p_at is null or (s.created_at,s.id)<(p_at,p_id))
      and (status_filter='' or s.status=status_filter)
    order by s.created_at desc,s.id desc limit p_limit+1
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'memberId',s.member_id,'memberName',m.name,'message',s.message,
    'status',s.status,'response',s.response,'createdAt',s.created_at,'answeredAt',s.answered_at
  ) order by s.created_at desc,s.id desc),'[]'::jsonb)
  into items from selected s join private.members m on m.id=s.member_id;
  more:=jsonb_array_length(items)>p_limit;
  if more then items:=items-p_limit; end if;
  last_row:=items->(jsonb_array_length(items)-1);
  return jsonb_build_object('items',items,'hasMore',more,
    'nextCursor',case when more then jsonb_build_object('at',last_row->>'createdAt','id',last_row->>'id') end);
end $$;
revoke all on function public.rk_support_requests(integer,timestamptz,uuid,text) from public,anon;
grant execute on function public.rk_support_requests(integer,timestamptz,uuid,text) to authenticated;

create function public.rk_answer_support_request(p_id uuid,p_response text) returns void
language plpgsql security definer set search_path='' as $$
declare r private.roles; response_text text;
begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  response_text:=trim(coalesce(p_response,''));
  if length(response_text)<2 or length(response_text)>2000 then
    raise exception 'Escreva uma resposta entre 2 e 2000 caracteres.' using errcode='P0001';
  end if;
  update private.support_requests set status='answered',response=response_text,answered_at=now(),answered_by=r.user_id
    where id=p_id;
  if not found then raise exception 'Solicitação não encontrada'; end if;
  perform private.log('support.answer',p_id);
end $$;
revoke all on function public.rk_answer_support_request(uuid,text) from public,anon;
grant execute on function public.rk_answer_support_request(uuid,text) to authenticated;

create function public.rk_admin_overview() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin
  r:=private.actor();
  if r.role not in ('admin','support','viewer') then raise exception 'Acesso negado' using errcode='42501'; end if;
  return jsonb_build_object(
    'activeMembers',(select count(*) from private.members m where private.eligible(m.id)),
    'purchases',(select count(*) from private.purchases p
      where not exists(select 1 from private.reversals v where v.purchase_id=p.id)),
    'savingsCents',(select coalesce(sum(p.discount_cents),0)::text from private.purchases p
      where not exists(select 1 from private.reversals v where v.purchase_id=p.id)),
    'pastDue',(select count(*) from private.subscriptions where state='past_due'),
    'openSupport',(select count(*) from private.support_requests where status='open'),
    'recentPurchases',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',p.id,'memberName',m.name,'partnerName',s.name,
        'grossCents',p.gross_cents,'createdAt',p.created_at
      ) order by p.created_at desc),'[]'::jsonb)
      from (select * from private.purchases p
        where not exists(select 1 from private.reversals v where v.purchase_id=p.id)
        order by p.created_at desc limit 5) p
      join private.members m on m.id=p.member_id join private.partners s on s.id=p.partner_id
    ),
    'attentionMembers',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',m.id,'name',m.name,'billingState',s.state,'paidThrough',s.paid_through
      ) order by s.updated_at desc),'[]'::jsonb)
      from (select * from private.subscriptions where state='past_due'
        order by updated_at desc limit 5) s
      join private.members m on m.id=s.member_id
    )
  );
end $$;
revoke all on function public.rk_admin_overview() from public,anon;
grant execute on function public.rk_admin_overview() to authenticated;

create function public.rk_member_economy() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin
  r:=private.actor();
  if r.role<>'member' then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select jsonb_build_object(
    'savingsCents',coalesce(sum(p.discount_cents),0)::text,
    'purchases',count(*),
    'partners',count(distinct p.partner_id)
  ) from private.purchases p where p.member_id=r.user_id
    and not exists(select 1 from private.reversals v where v.purchase_id=p.id));
end $$;
revoke all on function public.rk_member_economy() from public,anon;
grant execute on function public.rk_member_economy() to authenticated;

-- Member projection now includes the account's own verified contacts. Phone stays masked.
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
  return result;
end $$;
