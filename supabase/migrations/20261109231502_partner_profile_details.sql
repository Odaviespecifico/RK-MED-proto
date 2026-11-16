alter table private.partners
  add column street text,
  add column street_number text,
  add column complement text,
  add column neighborhood text,
  add column postal_code text,
  add column city text,
  add column state text,
  add column description text,
  add column cnpj text,
  add column phone text,
  add column email text,
  add column photo_path text;

update private.partners set street=address where street is null;
alter table private.partners add constraint partners_postal_code_check check (postal_code is null or postal_code ~ '^[0-9]{8}$');
alter table private.partners add constraint partners_state_check check (state is null or state ~ '^[A-Z]{2}$');
alter table private.partners add constraint partners_cnpj_shape_check check (cnpj is null or cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$');
create unique index partners_cnpj_unique on private.partners(cnpj) where cnpj is not null;

create function private.valid_partner_cnpj(value text) returns boolean
language plpgsql immutable set search_path='' as $$
declare c text:=upper(regexp_replace(coalesce(value,''),'[^A-Z0-9]','','g')); i integer; check_index integer; total integer; weight integer; remainder integer; digit integer;
begin
  if c !~ '^[A-Z0-9]{12}[0-9]{2}$' or c ~ '^([A-Z0-9])\1{13}$' then return false; end if;
  for check_index in 1..2 loop
    total:=0;
    for i in 1..(11+check_index) loop
      weight:=((11+check_index-i) % 8)+2;
      total:=total+(ascii(substr(c,i,1))-48)*weight;
    end loop;
    remainder:=total % 11; digit:=case when remainder<2 then 0 else 11-remainder end;
    if digit<>substr(c,11+check_index,1)::integer then return false; end if;
  end loop;
  return true;
end $$;

alter table private.partners add constraint partners_cnpj_valid_check check (cnpj is null or private.valid_partner_cnpj(cnpj));

drop function public.rk_save_partner(text,text,text,integer,uuid,boolean);
create function public.rk_save_partner(
  p_name text,p_segment text,p_street text,p_number text,p_complement text,p_neighborhood text,p_postal_code text,
  p_city text,p_state text,p_description text,p_cnpj text,p_phone text,p_email text,p_photo_path text,
  p_discount_bps integer,p_id uuid default null,p_active boolean default true
) returns uuid language plpgsql security definer set search_path='' as $$
declare r private.roles; target uuid; normalized_cnpj text; cep text; composed text;
begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  normalized_cnpj:=upper(regexp_replace(coalesce(p_cnpj,''),'[^A-Z0-9]','','g'));
  cep:=regexp_replace(coalesce(p_postal_code,''),'\D','','g');
  if length(trim(coalesce(p_name,''))) not between 2 and 160 or length(trim(coalesce(p_segment,''))) not between 1 and 160
    or length(trim(coalesce(p_street,''))) not between 2 and 200 or length(trim(coalesce(p_neighborhood,''))) not between 1 and 160
    or cep !~ '^[0-9]{8}$' or length(trim(coalesce(p_city,''))) not between 1 and 160 or upper(trim(coalesce(p_state,''))) !~ '^[A-Z]{2}$'
    or length(trim(coalesce(p_description,''))) not between 2 and 1000 or not private.valid_partner_cnpj(normalized_cnpj)
    or (p_email is not null and trim(p_email)<>'' and (length(trim(p_email))>254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
    or (p_email is not null and trim(p_email)<>'' and (length(trim(p_email))>254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
    or p_discount_bps not between 0 and 10000 then raise exception 'Confira nome, endereço, CNPJ, descrição e desconto.'; end if;
  if p_photo_path is not null and p_photo_path !~ ('^partners/'||coalesce(p_id::text,'[0-9a-f-]{36}')||'/photo\.jpg$') then
    raise exception 'Caminho da foto inválido.';
  end if;
  composed:=concat_ws(', ',trim(p_street)||case when nullif(trim(coalesce(p_number,'')),'') is not null then ', '||trim(p_number) else '' end,
    nullif(trim(coalesce(p_complement,'')),''),trim(p_neighborhood),trim(p_city)||' - '||upper(trim(p_state)),substring(cep,1,5)||'-'||substring(cep,6,3));
  if p_id is null then
    insert into private.partners(name,segment,address,discount_bps,active,street,street_number,complement,neighborhood,postal_code,city,state,description,cnpj,phone,email,photo_path)
    values(trim(p_name),trim(p_segment),composed,p_discount_bps,p_active,trim(p_street),nullif(trim(coalesce(p_number,'')),''),nullif(trim(coalesce(p_complement,'')),''),trim(p_neighborhood),cep,trim(p_city),upper(trim(p_state)),trim(p_description),normalized_cnpj,nullif(trim(coalesce(p_phone,'')),''),nullif(lower(trim(coalesce(p_email,''))),''),p_photo_path) returning id into target;
  else
    update private.partners set name=trim(p_name),segment=trim(p_segment),address=composed,discount_bps=p_discount_bps,active=p_active,
      street=trim(p_street),street_number=nullif(trim(coalesce(p_number,'')),''),complement=nullif(trim(coalesce(p_complement,'')),''),neighborhood=trim(p_neighborhood),postal_code=cep,
      city=trim(p_city),state=upper(trim(p_state)),description=trim(p_description),cnpj=normalized_cnpj,phone=nullif(trim(coalesce(p_phone,'')),''),
      email=nullif(lower(trim(coalesce(p_email,''))),''),photo_path=coalesce(p_photo_path,photo_path) where id=p_id returning id into target;
    if target is null then raise exception 'Parceiro não encontrado'; end if;
  end if;
  perform private.log('partner.save',target); return target;
end $$;
revoke all on function public.rk_save_partner(text,text,text,text,text,text,text,text,text,text,text,text,text,text,integer,uuid,boolean) from public,anon;
grant execute on function public.rk_save_partner(text,text,text,text,text,text,text,text,text,text,text,text,text,text,integer,uuid,boolean) to authenticated;

create or replace function public.rk_partners() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'segment',segment,'address',address,'description',description,'photoPath',photo_path,
    'discount',discount_bps/100.0,'initials',upper(left(name,2)),'tone','sage') order by name),'[]')
  from private.partners where active and not is_test;
$$;

create or replace function public.rk_staff_partners() returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin
  r:=private.actor();
  if r.role not in ('admin','support','viewer') then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'segment',segment,'address',address,'description',description,'photoPath',photo_path,
    'street',street,'number',street_number,'complement',complement,'neighborhood',neighborhood,'postalCode',postal_code,'city',city,'state',state,
    'cnpj',case when r.role in ('admin','support') then cnpj else null end,'phone',case when r.role in ('admin','support') then phone else null end,
    'email',case when r.role in ('admin','support') then email else null end,'discount',discount_bps/100.0,'initials',upper(left(name,2)),
    'tone','sage','active',active,'isTest',is_test,'establishmentCode',case when r.role in ('admin','support') then entry_code else null end) order by name),'[]')
    from private.partners);
end $$;

create or replace function private.can_manage_partner_photos() returns boolean language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin r:=private.actor(); return r.role in ('admin','support'); exception when others then return false; end $$;
revoke all on function private.can_manage_partner_photos() from public,anon,authenticated;
grant execute on function private.can_manage_partner_photos() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('partner-photos','partner-photos',true,5242880,array['image/jpeg']) on conflict(id) do update
set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg'];
create policy partner_photos_admin_insert on storage.objects for insert to authenticated
with check (bucket_id='partner-photos' and name ~ '^partners/[0-9a-f-]{36}/photo\.jpg$' and private.can_manage_partner_photos());
create policy partner_photos_admin_update on storage.objects for update to authenticated
using (bucket_id='partner-photos' and name ~ '^partners/[0-9a-f-]{36}/photo\.jpg$' and private.can_manage_partner_photos())
with check (bucket_id='partner-photos' and name ~ '^partners/[0-9a-f-]{36}/photo\.jpg$' and private.can_manage_partner_photos());
create policy partner_photos_admin_select on storage.objects for select to authenticated
using (bucket_id='partner-photos' and name ~ '^partners/[0-9a-f-]{36}/photo\.jpg$' and private.can_manage_partner_photos());

create or replace function public.rk_backend_test_partner_begin(p_actor uuid,p_session uuid,p_operation uuid,p_owner uuid,p_email text,p_details jsonb,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous private.test_partner_operations; normalized jsonb; mail text; cnpj_value text; cep text;
begin
  perform private.test_partner_guard(p_actor,p_session);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rkmed.staff-management',0));
  perform private.test_partner_guard(p_actor,p_session);
  mail:=lower(trim(coalesce(p_email,''))); cnpj_value:=upper(regexp_replace(coalesce(p_details->>'cnpj',''),'[^A-Z0-9]','','g')); cep:=regexp_replace(coalesce(p_details->>'postalCode',''),'\D','','g');
  if p_operation is null or p_owner is null or length(mail)>254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_code is null or p_code !~ '^[0-9]{4,12}$' or jsonb_typeof(p_details) is distinct from 'object' then raise exception 'Dados do cadastro inválidos.'; end if;
  if length(trim(coalesce(p_details->>'name',''))) not between 2 and 160 or length(trim(coalesce(p_details->>'segment',''))) not between 1 and 160
    or length(trim(coalesce(p_details->>'street',''))) not between 2 and 200 or length(trim(coalesce(p_details->>'neighborhood',''))) not between 1 and 160
    or cep !~ '^[0-9]{8}$' or length(trim(coalesce(p_details->>'city',''))) not between 1 and 160 or upper(trim(coalesce(p_details->>'state',''))) !~ '^[A-Z]{2}$'
    or length(trim(coalesce(p_details->>'description',''))) not between 2 and 1000 or not private.valid_partner_cnpj(cnpj_value)
    or (trim(coalesce(p_details->>'contactEmail',''))<>'' and (length(trim(p_details->>'contactEmail'))>254 or trim(p_details->>'contactEmail') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
    or length(trim(coalesce(p_details->>'employeeName',''))) not between 2 and 160 or coalesce(p_details->>'discountBps','') !~ '^[0-9]{1,5}$' then raise exception 'Dados do estabelecimento ou funcionário inválidos.'; end if;
  if (p_details->>'discountBps')::integer not between 0 and 10000 then raise exception 'Desconto inválido.'; end if;
  normalized:=jsonb_build_object('name',trim(p_details->>'name'),'segment',trim(p_details->>'segment'),'street',trim(p_details->>'street'),
    'number',trim(coalesce(p_details->>'number','')),'complement',trim(coalesce(p_details->>'complement','')),'neighborhood',trim(p_details->>'neighborhood'),
    'postalCode',cep,'city',trim(p_details->>'city'),'state',upper(trim(p_details->>'state')),'description',trim(p_details->>'description'),
    'cnpj',cnpj_value,'phone',trim(coalesce(p_details->>'phone','')),'contactEmail',lower(trim(coalesce(p_details->>'contactEmail',''))),
    'employeeName',trim(p_details->>'employeeName'),'discountBps',(p_details->>'discountBps')::integer);
  select * into previous from private.test_partner_operations where operation_id=p_operation or email=mail order by operation_id=p_operation desc limit 1 for update;
  if found then
    if previous.actor_id<>p_actor or previous.email<>mail or previous.details<>normalized or previous.employee_code_hash<>extensions.crypt(p_code,previous.employee_code_hash) then raise exception 'Já existe um cadastro com estes identificadores. Retome com os mesmos dados.'; end if;
    if previous.status='succeeded' then return jsonb_build_object('status','succeeded','result',previous.result); end if;
    if previous.lease_until>now() then return jsonb_build_object('status','busy'); end if;
    update private.test_partner_operations set owner=p_owner,lease_until=clock_timestamp()+interval '2 minutes' where operation_id=previous.operation_id returning * into previous;
  else
    if exists(select 1 from auth.users where lower(email)=mail) then raise exception 'Este e-mail já está cadastrado. Use outro e-mail para o parceiro de teste.'; end if;
    if exists(select 1 from private.partners where cnpj=cnpj_value) then raise exception 'Este CNPJ já está cadastrado.'; end if;
    insert into private.test_partner_operations(operation_id,actor_id,email,details,employee_code_hash,owner,lease_until)
      values(p_operation,p_actor,mail,normalized,extensions.crypt(p_code,extensions.gen_salt('bf')),p_owner,clock_timestamp()+interval '2 minutes') returning * into previous;
    insert into private.audit(actor_id,session_id,action,correlation_id,reason) values(p_actor,p_session,'test_partner.requested',p_operation,'Cadastro completo de parceiro de teste');
  end if;
  return jsonb_build_object('status','pending','operationId',previous.operation_id,'authUserId',previous.auth_user_id);
end $$;

create or replace function public.rk_backend_test_partner_finish(p_actor uuid,p_session uuid,p_operation uuid,p_owner uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare operation private.test_partner_operations; partner uuid; completed jsonb; details jsonb; composed text;
begin
  perform private.test_partner_guard(p_actor,p_session); perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rkmed.staff-management',0)); perform private.test_partner_guard(p_actor,p_session);
  select * into operation from private.test_partner_operations where operation_id=p_operation and actor_id=p_actor for update;
  if not found then raise exception 'Cadastro não encontrado.'; end if;
  if operation.status='succeeded' then return operation.result; end if;
  if operation.owner<>p_owner or operation.lease_until<=clock_timestamp() then raise exception 'Cadastro em andamento. Aguarde e tente novamente com os mesmos dados.'; end if;
  if not exists(select 1 from auth.users where id=operation.auth_user_id and lower(email)=operation.email and email_confirmed_at is not null and raw_app_meta_data->>'rkmed_test_partner_operation'=p_operation::text)
    or exists(select 1 from private.roles where user_id=operation.auth_user_id) or exists(select 1 from private.members where id=operation.auth_user_id) then raise exception 'Não foi possível vincular a conta. Retome o cadastro.'; end if;
  details:=operation.details;
  composed:=concat_ws(', ',details->>'street'||case when details->>'number'<>'' then ', '||details->>'number' else '' end,nullif(details->>'complement',''),details->>'neighborhood',details->>'city'||' - '||details->>'state',substring(details->>'postalCode',1,5)||'-'||substring(details->>'postalCode',6,3));
  insert into private.partners(name,segment,address,discount_bps,is_test,street,street_number,complement,neighborhood,postal_code,city,state,description,cnpj,phone,email)
  values(details->>'name',details->>'segment',composed,(details->>'discountBps')::integer,true,details->>'street',nullif(details->>'number',''),nullif(details->>'complement',''),details->>'neighborhood',details->>'postalCode',details->>'city',details->>'state',details->>'description',details->>'cnpj',nullif(details->>'phone',''),nullif(details->>'contactEmail','')) returning id into partner;
  insert into private.employees(partner_id,name,code_hash) values(partner,details->>'employeeName',operation.employee_code_hash);
  insert into private.roles(user_id,role,partner_id) values(operation.auth_user_id,'partner',partner);
  select jsonb_build_object('partnerId',p.id,'name',p.name,'email',operation.email,'employeeName',details->>'employeeName','establishmentCode',p.entry_code,'isTest',true) into completed from private.partners p where p.id=partner;
  update private.test_partner_operations set status='succeeded',result=completed where operation_id=p_operation;
  insert into private.audit(actor_id,session_id,action,target_id,correlation_id,reason) values(p_actor,p_session,'partner.test.created',partner,p_operation,'Parceiro de teste criado com funcionário e acesso'),(p_actor,p_session,'staff.created',operation.auth_user_id,p_operation,'Novo acesso: parceiro de teste');
  return completed;
end $$;
