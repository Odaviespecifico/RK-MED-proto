-- Perfil Gerente de parceiro (partner_manager), códigos sempre visíveis (criptografados),
-- métricas por estabelecimento/funcionário, edição do próprio negócio e Login vendedor.

-- 1. Ampliar restrições de papel em private.roles para incluir partner_manager.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'private.roles'::regclass and contype = 'c'
  loop
    execute format('alter table private.roles drop constraint %I', c.conname);
  end loop;
end $$;

alter table private.roles
  add constraint roles_role_check check (role in ('member','partner','partner_manager','admin','support','viewer')),
  add constraint roles_partner_binding_check check ((role in ('partner','partner_manager')) = (partner_id is not null));

-- 2. Armazenar código do funcionário criptografado com qr_key para consulta autorizada pelo gerente/admin.
alter table private.employees add column if not exists encrypted_code bytea;

create or replace function public.rk_create_partner_employee(p_partner uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r private.roles; issued text; target uuid; key_val text;
begin
  r := private.actor();
  if not (r.role in ('admin','support') or (r.role = 'partner_manager' and r.partner_id = p_partner)) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) not between 2 and 160 then
    raise exception 'Nome inválido';
  end if;
  issued := private.issue_employee_code(p_partner);
  select value into key_val from private.settings where key = 'qr_key';
  insert into private.employees(partner_id, name, code_hash, encrypted_code)
  values (
    p_partner,
    trim(p_name),
    extensions.crypt(issued, extensions.gen_salt('bf')),
    extensions.pgp_sym_encrypt(issued, key_val)
  )
  returning id into target;
  perform private.log('employee.save', target);
  return jsonb_build_object('id', target, 'code', issued);
end $$;

create function public.rk_reissue_employee_code(p_partner uuid, p_employee uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r private.roles; issued text; key_val text; target uuid;
begin
  r := private.actor();
  if not (r.role in ('admin','support') or (r.role = 'partner_manager' and r.partner_id = p_partner)) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  issued := private.issue_employee_code(p_partner);
  select value into key_val from private.settings where key = 'qr_key';
  update private.employees
  set code_hash = extensions.crypt(issued, extensions.gen_salt('bf')),
      encrypted_code = extensions.pgp_sym_encrypt(issued, key_val)
  where id = p_employee and partner_id = p_partner
  returning id into target;
  if target is null then raise exception 'Funcionário não encontrado neste parceiro'; end if;
  perform private.log('employee.code.reissue', target);
  return jsonb_build_object('id', target, 'code', issued);
end $$;
revoke all on function public.rk_reissue_employee_code(uuid, uuid) from public, anon;
grant execute on function public.rk_reissue_employee_code(uuid, uuid) to authenticated;

create or replace function public.rk_save_employee(p_partner uuid, p_name text, p_code text, p_id uuid default null, p_active boolean default true)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r private.roles; target uuid;
begin
  r := private.actor();
  if not (r.role in ('admin','support') or (r.role = 'partner_manager' and r.partner_id = p_partner)) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_id is null then return (public.rk_create_partner_employee(p_partner, p_name)->>'id')::uuid; end if;
  if p_name is null or length(trim(p_name)) not between 2 and 160 or coalesce(p_code, '') <> '' then
    raise exception 'Nome inválido ou alteração manual de código não permitida';
  end if;
  perform 1 from private.partners where id = p_partner for update;
  update private.employees set name = trim(p_name), active = p_active where id = p_id and partner_id = p_partner returning id into target;
  if target is null then raise exception 'Funcionário não encontrado neste parceiro'; end if;
  perform private.log('employee.save', target);
  return target;
end $$;

create or replace function public.rk_partner_employees(p_partner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r private.roles; key_val text;
begin
  r := private.actor();
  if not (r.role in ('admin','support') or (r.role = 'partner_manager' and r.partner_id = p_partner)) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select value into key_val from private.settings where key = 'qr_key';
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'partnerId', partner_id,
      'active', active,
      'code', case when encrypted_code is not null then extensions.pgp_sym_decrypt(encrypted_code, key_val) else null end
    ) order by name, id), '[]'::jsonb)
    from private.employees
    where partner_id = p_partner
  );
end $$;

-- 3. Liberar histórico paginado de compras do estabelecimento para o gerente do próprio parceiro.
create or replace function public.rk_partner_purchases_page(p_partner uuid, p_limit integer default 25, p_at timestamptz default null, p_id uuid default null, p_savings boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r private.roles; scope uuid; predicate text; items jsonb; more boolean; last_row jsonb; savings text;
begin
  r := private.actor();
  if not (r.role in ('admin','support','viewer') or (r.role = 'partner_manager' and r.partner_id = p_partner)) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  perform private.check_page(p_limit, p_at, p_id);
  predicate := 'p.partner_id=$3'; scope := p_partner;
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
  into items using p_at, p_id, scope, p_limit + 1;
  more := jsonb_array_length(items) > p_limit;
  if more then items := items - p_limit; end if;
  last_row := items->(jsonb_array_length(items) - 1);
  return jsonb_build_object(
    'items', items,
    'hasMore', more,
    'nextCursor', case when more then jsonb_build_object('at', last_row->>'createdAt', 'id', last_row->>'id') end,
    'savingsCents', savings
  );
end $$;

-- 4. Métricas de venda e por funcionário para o Gerente de parceiro.
create function public.rk_partner_metrics(p_days integer default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r private.roles;
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 365);
  v_start_date date := (now() at time zone 'America/Recife')::date - (v_days - 1);
  v_start_ts timestamptz := (v_start_date::timestamp at time zone 'America/Recife');
  v_valid bigint;
  v_reversed bigint;
  v_gross bigint;
  v_discount bigint;
  v_final bigint;
  v_members bigint;
begin
  r := private.actor();
  if r.role <> 'partner_manager' or r.partner_id is null then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  select
    count(*) filter (where v.purchase_id is null),
    count(*) filter (where v.purchase_id is not null),
    coalesce(sum(p.gross_cents) filter (where v.purchase_id is null), 0),
    coalesce(sum(p.discount_cents) filter (where v.purchase_id is null), 0),
    coalesce(sum(p.final_cents) filter (where v.purchase_id is null), 0),
    count(distinct p.member_id) filter (where v.purchase_id is null)
  into v_valid, v_reversed, v_gross, v_discount, v_final, v_members
  from private.purchases p
  left join private.reversals v on v.purchase_id = p.id
  where p.partner_id = r.partner_id and p.created_at >= v_start_ts;

  return jsonb_build_object(
    'days', v_days,
    'generatedAt', now(),
    'totals', jsonb_build_object(
      'validCount', v_valid,
      'reversedCount', v_reversed,
      'grossCents', v_gross::text,
      'discountCents', v_discount::text,
      'finalCents', v_final::text,
      'avgFinalCents', (case when v_valid > 0 then round(v_final::numeric / v_valid)::bigint else 0 end)::text,
      'uniqueMembers', v_members
    ),
    'byEmployee', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'employeeId', e.id,
        'employeeName', e.name,
        'active', e.active,
        'salesCount', coalesce(agg.sales_count, 0),
        'grossCents', coalesce(agg.gross_cents, 0)::text,
        'discountCents', coalesce(agg.discount_cents, 0)::text,
        'finalCents', coalesce(agg.final_cents, 0)::text
      ) order by coalesce(agg.final_cents, 0) desc, e.name asc), '[]'::jsonb)
      from private.employees e
      left join (
        select
          p.employee_id,
          count(*) as sales_count,
          sum(p.gross_cents) as gross_cents,
          sum(p.discount_cents) as discount_cents,
          sum(p.final_cents) as final_cents
        from private.purchases p
        where p.partner_id = r.partner_id
          and p.created_at >= v_start_ts
          and not exists (select 1 from private.reversals v where v.purchase_id = p.id)
        group by p.employee_id
      ) agg on agg.employee_id = e.id
      where e.partner_id = r.partner_id
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bucket', bucket_label,
        'salesCount', sales_count,
        'grossCents', gross_cents::text,
        'discountCents', discount_cents::text,
        'finalCents', final_cents::text
      ) order by bucket_key asc), '[]'::jsonb)
      from (
        select
          case when v_days <= 31 then to_char((p.created_at at time zone 'America/Recife')::date, 'YYYY-MM-DD')
               else to_char(date_trunc('month', p.created_at at time zone 'America/Recife')::date, 'YYYY-MM') end as bucket_key,
          case when v_days <= 31 then to_char((p.created_at at time zone 'America/Recife')::date, 'DD/MM')
               else to_char(date_trunc('month', p.created_at at time zone 'America/Recife')::date, 'YYYY-MM') end as bucket_label,
          count(*) as sales_count,
          sum(p.gross_cents) as gross_cents,
          sum(p.discount_cents) as discount_cents,
          sum(p.final_cents) as final_cents
        from private.purchases p
        where p.partner_id = r.partner_id
          and p.created_at >= v_start_ts
          and not exists (select 1 from private.reversals v where v.purchase_id = p.id)
        group by 1, 2
      ) s
    )
  );
end $$;
revoke all on function public.rk_partner_metrics(integer) from public, anon;
grant execute on function public.rk_partner_metrics(integer) to authenticated;

-- 5. Edição de foto e informações do próprio negócio pelo Gerente de parceiro.
create function public.rk_update_own_partner(
  p_name text,
  p_segment text,
  p_street text,
  p_number text,
  p_complement text,
  p_neighborhood text,
  p_postal_code text,
  p_city text,
  p_state text,
  p_description text,
  p_phone text,
  p_email text,
  p_photo_path text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r private.roles;
  cep text;
  uf text;
  composed text;
  mail text;
  tel text;
begin
  r := private.actor();
  if r.role <> 'partner_manager' or r.partner_id is null then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 160
    or length(trim(coalesce(p_segment, ''))) not between 2 and 160
    or length(trim(coalesce(p_street, ''))) not between 2 and 180
    or length(trim(coalesce(p_neighborhood, ''))) not between 2 and 120
    or length(trim(coalesce(p_city, ''))) not between 2 and 120
    or length(trim(coalesce(p_description, ''))) not between 2 and 1000 then
    raise exception 'Preencha todos os campos obrigatórios do estabelecimento.';
  end if;
  cep := regexp_replace(coalesce(p_postal_code, ''), '[^0-9]', '', 'g');
  if cep !~ '^[0-9]{8}$' then raise exception 'Informe um CEP válido com 8 dígitos.'; end if;
  uf := upper(trim(coalesce(p_state, '')));
  if uf !~ '^[A-Z]{2}$' then raise exception 'Informe uma UF válida com 2 letras.'; end if;
  mail := nullif(lower(trim(coalesce(p_email, ''))), '');
  if mail is not null and mail !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'E-mail de contato inválido.'; end if;
  tel := nullif(trim(coalesce(p_phone, '')), '');
  if p_photo_path is not null and p_photo_path <> ('partners/' || r.partner_id::text || '/photo.jpg') then
    raise exception 'Caminho de foto inválido para este estabelecimento.';
  end if;

  composed := trim(p_street)
    || case when nullif(trim(coalesce(p_number, '')), '') is not null then ', ' || trim(p_number) else '' end
    || case when nullif(trim(coalesce(p_complement, '')), '') is not null then ' - ' || trim(p_complement) else '' end
    || ' - ' || trim(p_neighborhood) || ', ' || trim(p_city) || ' - ' || uf || ', ' || substr(cep, 1, 5) || '-' || substr(cep, 6, 3);

  update private.partners
  set name = trim(p_name),
      segment = trim(p_segment),
      address = composed,
      street = trim(p_street),
      street_number = nullif(trim(coalesce(p_number, '')), ''),
      complement = nullif(trim(coalesce(p_complement, '')), ''),
      neighborhood = trim(p_neighborhood),
      postal_code = cep,
      city = trim(p_city),
      state = uf,
      description = trim(p_description),
      phone = tel,
      email = mail,
      photo_path = coalesce(p_photo_path, photo_path)
  where id = r.partner_id;

  perform private.log('partner.manager.update', r.partner_id);
end $$;
revoke all on function public.rk_update_own_partner(text,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.rk_update_own_partner(text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;

-- Storage policy: permitir que partner_manager envie/atualize somente a foto do próprio estabelecimento.
create or replace function private.can_manage_partner_photo(p_object_name text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare r private.roles;
begin
  r := private.actor();
  if r.role in ('admin','support') then return true; end if;
  if r.role = 'partner_manager' and r.partner_id is not null then
    return p_object_name = ('partners/' || r.partner_id::text || '/photo.jpg');
  end if;
  return false;
exception when others then return false;
end $$;
revoke all on function private.can_manage_partner_photo(text) from public, anon, authenticated;
grant execute on function private.can_manage_partner_photo(text) to authenticated;

drop policy if exists partner_photos_admin_insert on storage.objects;
drop policy if exists partner_photos_admin_update on storage.objects;
drop policy if exists partner_photos_admin_select on storage.objects;

create policy partner_photos_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'partner-photos' and name ~ '^partners/[0-9a-f-]{36}/photo\.jpg$' and private.can_manage_partner_photo(name));
create policy partner_photos_admin_update on storage.objects for update to authenticated
using (bucket_id = 'partner-photos' and name ~ '^partners/[0-9a-f-]{36}/photo\.jpg$' and private.can_manage_partner_photo(name))
with check (bucket_id = 'partner-photos' and name ~ '^partners/[0-9a-f-]{36}/photo\.jpg$' and private.can_manage_partner_photo(name));
create policy partner_photos_admin_select on storage.objects for select to authenticated
using (bucket_id = 'partner-photos' and name ~ '^partners/[0-9a-f-]{36}/photo\.jpg$' and private.can_manage_partner_photo(name));

-- 6. Atualizar rk_context para retornar dados completos do parceiro ao partner_manager.
create or replace function public.rk_context() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r private.roles; result jsonb; card text; email_val text; phone_val text;
begin
  r := private.actor();
  result := jsonb_build_object('userId', r.user_id, 'role', r.role, 'partnerId', r.partner_id);
  if r.role = 'member' then
    select extensions.pgp_sym_decrypt(c.encrypted_token, (select value from private.settings where key = 'qr_key'))
      into card from private.credentials c where c.member_id = r.user_id;
    select u.email, case when u.phone is not null and length(u.phone) >= 4 then '•• •••••-' || right(u.phone, 4) else null end
      into email_val, phone_val from auth.users u where u.id = r.user_id;
    select result || jsonb_build_object('member', jsonb_build_object('id', m.id, 'name', m.name,
      'cpf', '***.***.***-' || right(i.cpf, 2), 'photoPath', m.photo_path, 'cardToken', card,
      'eligible', private.eligible(m.id), 'blocked', m.blocked, 'paidThrough', s.paid_through,
      'billingState', s.state, 'cancelAtPeriodEnd', s.cancel_at_period_end, 'joinedAt', m.created_at,
      'email', email_val, 'phone', phone_val))
      into result from private.members m join private.member_identity i on i.member_id = m.id
      join private.subscriptions s on s.member_id = m.id where m.id = r.user_id;
  elsif r.role = 'partner' then
    select result || jsonb_build_object('workSession', jsonb_build_object('employeeId', e.id, 'employeeName', e.name, 'partnerId', w.partner_id))
      into result from private.work_sessions w join private.employees e on e.id = w.employee_id
      where w.session_id = nullif(auth.jwt()->>'session_id', '')::uuid and w.user_id = r.user_id and w.partner_id = r.partner_id and e.active;
    result := coalesce(result, jsonb_build_object('userId', r.user_id, 'role', r.role, 'partnerId', r.partner_id));
    select result || jsonb_build_object('partner', jsonb_build_object('id', id, 'name', name, 'segment', segment, 'address', address,
      'discount', discount_bps / 100.0, 'initials', upper(left(name, 2)), 'tone', 'sage', 'isTest', is_test))
      into result from private.partners where id = r.partner_id;
  elsif r.role = 'partner_manager' then
    select result || jsonb_build_object('partner', jsonb_build_object(
      'id', id, 'name', name, 'segment', segment, 'address', address, 'description', description, 'photoPath', photo_path,
      'street', street, 'number', street_number, 'complement', complement, 'neighborhood', neighborhood,
      'postalCode', postal_code, 'city', city, 'state', state, 'cnpj', cnpj, 'phone', phone, 'email', email,
      'discount', discount_bps / 100.0, 'initials', upper(left(name, 2)), 'tone', 'sage', 'active', active,
      'isTest', is_test, 'establishmentCode', entry_code
    ))
    into result from private.partners where id = r.partner_id;
  end if;
  return result;
end $$;

-- 7. Atualizar gestão de acessos internos (admin) para suportar partner_manager.
create or replace function public.rk_staff_accounts(p_limit integer default 25, p_at timestamptz default null, p_id uuid default null, p_query text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r private.roles; q text := lower(trim(coalesce(p_query, ''))); items jsonb; more boolean; last_row jsonb;
begin
  r := private.actor();
  if r.role <> 'admin' then raise exception 'Acesso negado' using errcode = '42501'; end if;
  perform private.check_page(p_limit, p_at, p_id);
  with selected as (
    select a.user_id as id, u.email, a.role, a.active, a.partner_id, p.name as partner_name,
      coalesce(p.is_test, false) as is_test, u.created_at, u.last_sign_in_at, a.revision
    from private.roles a
    join auth.users u on u.id = a.user_id
    left join private.partners p on p.id = a.partner_id
    where a.role in ('admin','support','viewer','partner','partner_manager')
      and (q = '' or strpos(lower(coalesce(u.email, '')), q) > 0 or strpos(lower(coalesce(p.name, '')), q) > 0)
      and (p_at is null or (u.created_at, a.user_id) < (p_at, p_id))
    order by u.created_at desc, a.user_id desc
    limit p_limit + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'email', email, 'role', role, 'active', active, 'isTest', is_test,
    'partnerId', partner_id, 'partnerName', partner_name, 'createdAt', created_at,
    'lastSignInAt', last_sign_in_at, 'revision', revision
  ) order by created_at desc, id desc), '[]'::jsonb) into items from selected;
  more := jsonb_array_length(items) > p_limit;
  if more then items := items - p_limit; end if;
  last_row := items->(jsonb_array_length(items) - 1);
  return jsonb_build_object('items', items, 'hasMore', more,
    'nextCursor', case when more then jsonb_build_object('at', last_row->>'createdAt', 'id', last_row->>'id') end);
end $$;

create or replace function public.rk_update_staff_access(p_user uuid, p_role text, p_partner uuid, p_active boolean, p_revision integer, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare r private.roles; target private.roles;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rkmed.staff-management', 0));
  r := private.actor();
  if r.role <> 'admin' then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if p_user = r.user_id then raise exception 'Solicite a outro administrador a alteração do seu próprio acesso.'; end if;
  if p_role is null or p_role not in ('admin','support','viewer','partner','partner_manager') or p_active is null
    or length(trim(coalesce(p_reason, ''))) not between 3 and 1000 then raise exception 'Informe perfil e motivo válidos.'; end if;
  if (p_role in ('partner','partner_manager')) <> (p_partner is not null)
    or (p_role in ('partner','partner_manager') and not exists(select 1 from private.partners where id = p_partner and (not p_active or active))) then
    raise exception 'Estabelecimento inválido para este perfil.';
  end if;
  select * into target from private.roles where user_id = p_user and role in ('admin','support','viewer','partner','partner_manager') for update;
  if not found then raise exception 'Acesso interno não encontrado'; end if;
  if target.revision is distinct from p_revision then raise exception 'Acesso alterado por outro operador. Atualize a lista.'; end if;
  if target.active and target.role = 'admin' and (not p_active or p_role <> 'admin')
    and not exists(select 1 from private.roles where role = 'admin' and active and user_id <> p_user) then
    raise exception 'O sistema precisa de pelo menos um administrador ativo.';
  end if;
  if target.role = p_role and target.partner_id is not distinct from p_partner and target.active = p_active then return; end if;
  update private.roles set role = p_role, partner_id = p_partner, active = p_active, revision = revision + 1, sessions_valid_after = clock_timestamp() where user_id = p_user;
  delete from private.work_sessions where user_id = p_user;
  perform private.log('staff.access.update', p_user, trim(p_reason) || format(E'\nPerfil: %s → %s. Ativo: %s → %s. Estabelecimento: %s → %s.', target.role, p_role, target.active, p_active, target.partner_id, p_partner));
end $$;

create or replace function public.rk_backend_staff_provision(p_actor uuid, p_session uuid, p_user uuid, p_role text, p_partner uuid, p_operation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.service_only();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rkmed.staff-management', 0));
  perform private.require_staff_admin(p_actor, p_session);
  if p_role is null or p_role not in ('admin','support','viewer','partner','partner_manager')
    or (p_role in ('partner','partner_manager')) <> (p_partner is not null)
    or (p_role in ('partner','partner_manager') and not exists(select 1 from private.partners where id = p_partner and active)) then
    raise exception 'Perfil ou estabelecimento inválido';
  end if;
  if exists(select 1 from private.members where id = p_user) or exists(select 1 from private.roles where user_id = p_user)
    or exists(select 1 from private.audit where correlation_id = p_operation and action = 'staff.created') then
    raise exception 'Acesso já existente ou operação reutilizada';
  end if;
  insert into private.roles(user_id, role, partner_id) values(p_user, p_role, p_partner);
  insert into private.audit(actor_id, action, target_id, session_id, correlation_id, reason)
    values(p_actor, 'staff.created', p_user, p_session, p_operation, 'Novo acesso: ' || p_role);
end $$;

-- 8. Rotinas de serviço para Login vendedor (código do estabelecimento + código do funcionário).
create function public.rk_seller_login_verify(p_establishment_code text, p_employee_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  est_code text := upper(trim(coalesce(p_establishment_code, '')));
  emp_code text := trim(coalesce(p_employee_code, ''));
  p_rec private.partners;
  e_rec private.employees;
  counter_user uuid;
  counter_email text;
begin
  perform private.service_only();
  if est_code !~ '^[A-Z0-9]{10}$' or emp_code !~ '^[0-9]{4,12}$' then
    raise exception 'Código do estabelecimento ou do funcionário inválido.' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('seller.login:' || est_code, 0));
  if (select count(*) from private.audit
      where action = 'seller.login.failed' and reason = est_code
        and created_at > now() - interval '15 minutes') >= 10 then
    raise exception 'Muitas tentativas incorretas. Aguarde 15 minutos.' using errcode = 'P0001';
  end if;

  select * into p_rec from private.partners where entry_code = est_code and active;
  if not found then
    insert into private.audit(action, reason) values('seller.login.failed', est_code);
    raise exception 'Código do estabelecimento ou do funcionário inválido.' using errcode = 'P0001';
  end if;

  select * into e_rec from private.employees
  where partner_id = p_rec.id and active and code_hash = extensions.crypt(emp_code, code_hash)
  limit 1;
  if not found then
    insert into private.audit(action, target_id, reason) values('seller.login.failed', p_rec.id, est_code);
    raise exception 'Código do estabelecimento ou do funcionário inválido.' using errcode = 'P0001';
  end if;

  select r.user_id, u.email into counter_user, counter_email
  from private.roles r join auth.users u on u.id = r.user_id
  where r.role = 'partner' and r.partner_id = p_rec.id and r.active and u.email is not null
  order by u.created_at asc
  limit 1;

  return jsonb_build_object(
    'partnerId', p_rec.id,
    'partnerName', p_rec.name,
    'employeeId', e_rec.id,
    'employeeName', e_rec.name,
    'counterUserId', counter_user,
    'counterEmail', counter_email
  );
end $$;
revoke all on function public.rk_seller_login_verify(text, text) from public, anon, authenticated;

create function public.rk_seller_ensure_counter_role(p_user_id uuid, p_partner_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.service_only();
  insert into private.roles(user_id, role, partner_id, active)
  values(p_user_id, 'partner', p_partner_id, true)
  on conflict(user_id) do nothing;
end $$;
revoke all on function public.rk_seller_ensure_counter_role(uuid, uuid) from public, anon, authenticated;

create function public.rk_seller_bind_session(p_session_id uuid, p_user_id uuid, p_partner_id uuid, p_employee_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.service_only();
  insert into private.staff_activity(session_id, last_seen)
  values(p_session_id, now())
  on conflict(session_id) do update set last_seen = excluded.last_seen;

  insert into private.work_sessions(session_id, user_id, employee_id, partner_id, started_at)
  values(p_session_id, p_user_id, p_employee_id, p_partner_id, now())
  on conflict(session_id) do update set employee_id = excluded.employee_id, partner_id = excluded.partner_id, started_at = now();

  insert into private.audit(actor_id, action, target_id, session_id, reason)
  values(p_user_id, 'seller.login', p_employee_id, p_session_id, 'Login vendedor no balcão');
end $$;
revoke all on function public.rk_seller_bind_session(uuid, uuid, uuid, uuid) from public, anon, authenticated;
