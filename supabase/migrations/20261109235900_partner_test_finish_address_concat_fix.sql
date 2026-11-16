create or replace function public.rk_backend_test_partner_finish(p_actor uuid,p_session uuid,p_operation uuid,p_owner uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare operation private.test_partner_operations; partner uuid; completed jsonb; payload jsonb; composed text;
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
  payload:=operation.details;
  composed:=concat_ws(', ',concat(payload->>'street',case when payload->>'number'<>'' then concat(', ',payload->>'number') else '' end),
    nullif(payload->>'complement',''),payload->>'neighborhood',concat(payload->>'city',' - ',payload->>'state'),
    concat(substring(payload->>'postalCode',1,5),'-',substring(payload->>'postalCode',6,3)));
  insert into private.partners(name,segment,address,discount_bps,is_test,street,street_number,complement,neighborhood,postal_code,city,state,description,cnpj,phone,email)
  values(payload->>'name',payload->>'segment',composed,(payload->>'discountBps')::integer,true,payload->>'street',nullif(payload->>'number',''),
    nullif(payload->>'complement',''),payload->>'neighborhood',payload->>'postalCode',payload->>'city',payload->>'state',payload->>'description',
    payload->>'cnpj',nullif(payload->>'phone',''),nullif(payload->>'contactEmail','')) returning id into partner;
  insert into private.employees(partner_id,name,code_hash) values(partner,payload->>'employeeName',operation.employee_code_hash);
  insert into private.roles(user_id,role,partner_id) values(operation.auth_user_id,'partner',partner);
  select jsonb_build_object('partnerId',p.id,'name',p.name,'email',operation.email,'employeeName',payload->>'employeeName',
    'establishmentCode',p.entry_code,'isTest',true) into completed from private.partners p where p.id=partner;
  update private.test_partner_operations set status='succeeded',result=completed where operation_id=p_operation;
  insert into private.audit(actor_id,session_id,action,target_id,correlation_id,reason) values
    (p_actor,p_session,'partner.test.created',partner,p_operation,'Parceiro de teste criado com funcionário e acesso'),
    (p_actor,p_session,'staff.created',operation.auth_user_id,p_operation,'Novo acesso: parceiro de teste');
  return completed;
end $$;
