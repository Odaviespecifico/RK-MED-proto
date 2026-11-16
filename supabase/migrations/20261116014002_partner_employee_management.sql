-- Admin/support manage employees inside partner details. Existing codes remain valid.
create function private.issue_employee_code(p_partner uuid) returns text
language plpgsql set search_path='' as $$
declare bytes bytea; start_at integer; candidate text;
begin
  perform 1 from private.partners where id=p_partner for update;
  if not found then raise exception 'Parceiro não encontrado'; end if;
  loop
    bytes:=extensions.gen_random_bytes(2);
    start_at:=get_byte(bytes,0)*256+get_byte(bytes,1);
    exit when start_at<60000;
  end loop;
  for offset_at in 0..9999 loop
    candidate:=lpad(((start_at+offset_at)%10000)::text,4,'0');
    if not exists(select 1 from private.employees where partner_id=p_partner and code_hash=extensions.crypt(candidate,code_hash)) then return candidate; end if;
  end loop;
  raise exception 'Todos os códigos de quatro dígitos deste parceiro estão em uso.';
end $$;
revoke all on function private.issue_employee_code(uuid) from public,anon,authenticated;

create function public.rk_create_partner_employee(p_partner uuid,p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.roles; issued text; target uuid;
begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_name is null or length(trim(p_name)) not between 2 and 160 then raise exception 'Nome inválido'; end if;
  issued:=private.issue_employee_code(p_partner);
  insert into private.employees(partner_id,name,code_hash) values(p_partner,trim(p_name),extensions.crypt(issued,extensions.gen_salt('bf'))) returning id into target;
  perform private.log('employee.save',target);
  return jsonb_build_object('id',target,'code',issued);
end $$;
revoke all on function public.rk_create_partner_employee(uuid,text) from public,anon;
grant execute on function public.rk_create_partner_employee(uuid,text) to authenticated;

create or replace function public.rk_save_employee(p_partner uuid,p_name text,p_code text,p_id uuid default null,p_active boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare r private.roles; target uuid;
begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_id is null then return (public.rk_create_partner_employee(p_partner,p_name)->>'id')::uuid; end if;
  if p_name is null or length(trim(p_name)) not between 2 and 160 or coalesce(p_code,'')<>'' then raise exception 'Nome inválido ou alteração manual de código não permitida'; end if;
  perform 1 from private.partners where id=p_partner for update;
  update private.employees set name=trim(p_name),active=p_active where id=p_id and partner_id=p_partner returning id into target;
  if target is null then raise exception 'Funcionário não encontrado neste parceiro'; end if;
  perform private.log('employee.save',target); return target;
end $$;

create function public.rk_partner_employees(p_partner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'partnerId',partner_id,'active',active) order by name,id),'[]') from private.employees where partner_id=p_partner);
end $$;
revoke all on function public.rk_partner_employees(uuid) from public,anon;
grant execute on function public.rk_partner_employees(uuid) to authenticated;

create function public.rk_partner_purchases_page(p_partner uuid,p_limit integer default 25,p_at timestamptz default null,p_id uuid default null,p_savings boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles; scope uuid; predicate text; items jsonb; more boolean; last_row jsonb; savings text;
begin
  r:=private.actor();
  if r.role not in ('admin','support','viewer') then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform private.check_page(p_limit,p_at,p_id);
  -- These are fixed server-selected predicates, not user-supplied SQL or tenant IDs.
  predicate:='p.partner_id=$3'; scope:=p_partner;
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
revoke all on function public.rk_partner_purchases_page(uuid,integer,timestamptz,uuid,boolean) from public,anon;
grant execute on function public.rk_partner_purchases_page(uuid,integer,timestamptz,uuid,boolean) to authenticated;
