-- D33: an establishment is entered by code; never selected by the employee.
-- The code is an identifier, not a replacement for the authenticated partner account.
alter table private.partners add column entry_code text not null
  default upper(encode(extensions.gen_random_bytes(5),'hex'))
  check (entry_code ~ '^[A-Z0-9]{10}$');
alter table private.partners add constraint partners_entry_code_key unique(entry_code);

create or replace function public.rk_staff_partners() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.roles;
begin
  r:=private.actor();
  if r.role not in ('admin','support','viewer') then raise exception 'Acesso negado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'segment',segment,
    'address',address,'discount',discount_bps/100.0,'initials',upper(left(name,2)),
    'tone','sage','active',active,
    'establishmentCode',case when r.role in ('admin','support') then entry_code else null end)
    order by name),'[]') from private.partners);
end $$;

drop function public.rk_start_work(text);
create function public.rk_start_work(p_code text,p_establishment_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.roles; e private.employees;
begin
  r:=private.actor();
  if r.role<>'partner' then raise exception 'Acesso negado' using errcode='42501'; end if;
  if (select count(*) from private.audit where actor_id=r.user_id
    and action='work.start' and created_at>now()-interval '1 minute')>=10 then
    raise exception 'Aguarde antes de tentar outro código.' using errcode='42501'; end if;
  perform private.log('work.start');
  if not exists(select 1 from private.partners where id=r.partner_id and active
    and entry_code=upper(trim(p_establishment_code))) then
    return jsonb_build_object('error','Código do estabelecimento ou do funcionário inválido.');
  end if;
  select * into e from private.employees where partner_id=r.partner_id and active
    and code_hash=extensions.crypt(p_code,code_hash);
  if not found then
    return jsonb_build_object('error','Código do estabelecimento ou do funcionário inválido.');
  end if;
  insert into private.work_sessions(session_id,user_id,employee_id,partner_id)
    values(nullif(auth.jwt()->>'session_id','')::uuid,r.user_id,e.id,r.partner_id)
    on conflict(session_id) do update set employee_id=excluded.employee_id,
      partner_id=excluded.partner_id,started_at=now();
  return public.rk_context();
end $$;
revoke all on function public.rk_start_work(text,text) from public,anon;
grant execute on function public.rk_start_work(text,text) to authenticated;
