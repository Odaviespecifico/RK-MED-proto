-- RF-ADM/DG/PP/QR: bounded keyset reads; authorization and exact savings remain server-owned.
create extension if not exists pg_trgm with schema extensions;
create index members_cursor on private.members(created_at desc,id desc);
create index members_name_search on private.members using gin(lower(name) extensions.gin_trgm_ops);
create index subscriptions_past_due on private.subscriptions(member_id) where state='past_due';
create index purchases_member_cursor on private.purchases(member_id,created_at desc,id desc);
create index purchases_partner_cursor on private.purchases(partner_id,created_at desc,id desc);

create function private.check_page(p_limit integer,p_at timestamptz,p_id uuid) returns void
language plpgsql set search_path='' as $$
begin
  if p_limit is null or p_limit<1 or p_limit>100 or (p_at is null)<>(p_id is null)
    or (p_at is not null and not isfinite(p_at)) then
    raise exception 'Página inválida. Use entre 1 e 100 registros e um cursor completo.' using errcode='P0001';
  end if;
end $$;
revoke all on function private.check_page(integer,timestamptz,uuid) from public,anon,authenticated;

create function public.rk_purchases_page(p_limit integer default 25,p_at timestamptz default null,p_id uuid default null,p_savings boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; scope uuid; predicate text; items jsonb; more boolean; last_row jsonb; savings text;
begin
  r:=private.actor();
  if r.role not in ('member','partner','admin','support','viewer') then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform private.check_page(p_limit,p_at,p_id);
  -- These are fixed server-selected predicates, not user-supplied SQL or tenant IDs.
  if r.role='member' then predicate:='p.member_id=$3'; scope:=r.user_id;
  elsif r.role='partner' then predicate:='p.partner_id=$3'; scope:=r.partner_id;
  else predicate:='true'; end if;
  execute 'with selected as materialized (
    select p.* from private.purchases p where '||predicate||'
      and ($1 is null or (p.created_at,p.id)<($1,$2))
      order by p.created_at desc,p.id desc limit $4
  ) select coalesce(jsonb_agg(jsonb_build_object(
    ''id'',p.id,''memberId'',p.member_id,''memberName'',m.name,
    ''partnerId'',p.partner_id,''partnerName'',s.name,''employee'',p.employee_name,
    ''grossCents'',p.gross_cents,''discountCents'',p.discount_cents,''finalCents'',p.final_cents,
    ''createdAt'',p.created_at,''reversedAt'',v.created_at
  ) order by p.created_at desc,p.id desc),''[]''::jsonb)
  from selected p join private.members m on m.id=p.member_id join private.partners s on s.id=p.partner_id
    left join private.reversals v on v.purchase_id=p.id'
  into items using p_at,p_id,scope,p_limit+1;
  more:=jsonb_array_length(items)>p_limit;
  if more then items:=items-p_limit; end if;
  last_row:=items->(jsonb_array_length(items)-1);
  if r.role='member' and coalesce(p_savings,false) then
    select coalesce(sum(p.discount_cents),0)::text into savings from private.purchases p
      where p.member_id=r.user_id and not exists(select 1 from private.reversals v where v.purchase_id=p.id);
  end if;
  return jsonb_build_object('items',items,'hasMore',more,
    'nextCursor',case when more then jsonb_build_object('at',last_row->>'createdAt','id',last_row->>'id') end,
    'savingsCents',savings);
end $$;
revoke all on function public.rk_purchases_page(integer,timestamptz,uuid,boolean) from public,anon;
grant execute on function public.rk_purchases_page(integer,timestamptz,uuid,boolean) to authenticated;

create function public.rk_members_page(p_limit integer default 25,p_at timestamptz default null,p_id uuid default null,p_query text default '',p_past_due boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; pattern text; items jsonb; more boolean; last_row jsonb;
begin
  r:=private.actor();
  if r.role not in ('admin','support','viewer') then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform private.check_page(p_limit,p_at,p_id);
  if length(coalesce(p_query,''))>80 then raise exception 'Busca limitada a 80 caracteres.' using errcode='P0001'; end if;
  pattern:='%'||replace(replace(replace(lower(trim(coalesce(p_query,''))),chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%';
  with selected as materialized (
    select m.* from private.members m join private.subscriptions s on s.member_id=m.id
    where (p_at is null or (m.created_at,m.id)<(p_at,p_id))
      and (pattern='%%' or lower(m.name) like pattern escape E'\\')
      and (not coalesce(p_past_due,false) or s.state='past_due')
    order by m.created_at desc,m.id desc limit p_limit+1
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'name',m.name,'cpf','***.***.***-'||right(i.cpf,2),
    'eligible',private.eligible(m.id),'blocked',m.blocked,'billingState',s.state,'paidThrough',s.paid_through,'joinedAt',m.created_at,
    'invoiceId',case when r.role<>'viewer' then s.invoice_id end,'amountDue',case when r.role<>'viewer' then s.amount_due end,
    'email',case when r.role<>'viewer' then u.email end,'phone',case when r.role<>'viewer' then u.phone end,
    'savingsCents',(select coalesce(sum(p.discount_cents),0)::text from private.purchases p where p.member_id=m.id
      and not exists(select 1 from private.reversals v where v.purchase_id=p.id))
  ) order by m.created_at desc,m.id desc),'[]'::jsonb)
  into items from selected m join private.member_identity i on i.member_id=m.id
    join private.subscriptions s on s.member_id=m.id join auth.users u on u.id=m.id;
  more:=jsonb_array_length(items)>p_limit;
  if more then items:=items-p_limit; end if;
  last_row:=items->(jsonb_array_length(items)-1);
  return jsonb_build_object('items',items,'hasMore',more,
    'nextCursor',case when more then jsonb_build_object('at',last_row->>'joinedAt','id',last_row->>'id') end);
end $$;
revoke all on function public.rk_members_page(integer,timestamptz,uuid,text,boolean) from public,anon;
grant execute on function public.rk_members_page(integer,timestamptz,uuid,text,boolean) to authenticated;

-- Bounded compatibility for older callers. New UI uses cursors; these are never full exports.
create or replace function public.rk_purchases() returns jsonb language sql security definer set search_path='' as $$
  select public.rk_purchases_page(100)->'items';
$$;
create or replace function public.rk_admin_members() returns jsonb language sql security definer set search_path='' as $$
  select public.rk_members_page(100)->'items';
$$;
