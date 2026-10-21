-- Refinements after testing the real local runtime.
create or replace function public.rk_enroll(p_name text,p_cpf text,p_birth date,p_versions text[]) returns uuid
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

create or replace function public.rk_save_employee(p_partner uuid,p_name text,p_code text,p_id uuid default null,p_active boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare r private.roles; target uuid; begin
  r:=private.actor();
  if r.role not in ('admin','support') then raise exception 'Acesso negado' using errcode='42501'; end if;
  if (p_id is null and p_code !~ '^[0-9]{4,12}$') or (p_code<>'' and p_code !~ '^[0-9]{4,12}$') or length(trim(p_name))<2 then raise exception 'Nome ou código inválido'; end if;
  perform 1 from private.partners where id=p_partner for update;
  if not found then raise exception 'Parceiro não encontrado'; end if;
  if exists(select 1 from private.employees where partner_id=p_partner and id is distinct from p_id
    and code_hash=extensions.crypt(p_code,code_hash)) then raise exception 'Código já utilizado neste parceiro'; end if;
  if p_id is null then
    insert into private.employees(partner_id,name,code_hash,active) values(p_partner,trim(p_name),extensions.crypt(p_code,extensions.gen_salt('bf')),p_active) returning id into target;
  else
    update private.employees set partner_id=p_partner,name=trim(p_name),code_hash=case when p_code='' then code_hash else extensions.crypt(p_code,extensions.gen_salt('bf')) end,active=p_active where id=p_id returning id into target;
    if target is null then raise exception 'Funcionário não encontrado'; end if;
  end if;
  perform private.log('employee.save',target); return target;
end $$;

create function public.rk_staff_partners() returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin
  r:=private.actor();
  if r.role not in ('admin','support','viewer') then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'segment',segment,'address',address,'discount',discount_bps/100.0,'initials',upper(left(name,2)),'tone','sage','active',active) order by name),'[]') from private.partners);
end $$;
revoke all on function public.rk_staff_partners() from public,anon;
grant execute on function public.rk_staff_partners() to authenticated;
