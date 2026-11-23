-- Idempotent synthetic fixtures for Docker-local Auth/domain tests. No external messages.
insert into private.bootstrap_metadata (key, value)
values ('fixture', 'rkmed-local-bootstrap-v1')
on conflict (key) do update set value = excluded.value;

-- LOCAL synthetic accounts only. Never load this seed into a shared/production project.
do $$
declare i integer; uid uuid; email text; role_name text; phone text; token text;
begin
  insert into private.partners(id,name,segment,address,discount_bps) values
    ('10000000-0000-4000-8000-000000000001','Laboratório Vida — TESTE','Laboratório','Rua fictícia, 100 · Carpina, PE',2000),
    ('10000000-0000-4000-8000-000000000002','Academia Movimento — TESTE','Academia','Rua fictícia, 200 · Carpina, PE',1000)
    on conflict(id) do nothing;
  for i in 1..7 loop
    uid:=('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
    email:=case i when 1 then 'ana' when 2 then 'carlos' when 3 then 'parceiro' when 4 then 'outro-parceiro' when 5 then 'admin' when 6 then 'suporte' else 'diretoria' end||'@rkmed.test';
    role_name:=case when i<=2 then 'member' when i<=4 then 'partner' when i=5 then 'admin' when i=6 then 'support' else 'viewer' end;
    phone:=case when i<=2 then '1202555012'||i::text else null end;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,phone,phone_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
      values('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated',email,
      extensions.crypt('RKMED-local-test-2026!',extensions.gen_salt('bf')),now(),phone,case when phone is not null then now() end,
      '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','') on conflict(id) do nothing;
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
      values(gen_random_uuid(),uid,uid::text,jsonb_build_object('sub',uid,'email',email,'email_verified',true),'email',now(),now(),now())
      on conflict(provider_id,provider) do nothing;
    insert into private.roles(user_id,role,partner_id) values(uid,role_name,
      case when i=3 then '10000000-0000-4000-8000-000000000001'::uuid when i=4 then '10000000-0000-4000-8000-000000000002'::uuid end) on conflict(user_id) do nothing;
    if i<=2 then
      insert into private.members(id,name,birth_date,blocked,photo_path) values(uid,case when i=1 then 'Ana Paula — TESTE' else 'Carlos — TESTE' end,'1990-01-01',i=2,uid::text||'/photo.jpg') on conflict(id) do nothing;
      insert into private.member_identity values(uid,case when i=1 then '12345678909' else '98765432100' end) on conflict(member_id) do nothing;
      insert into private.subscriptions(member_id,state,paid_through) values(uid,case when i=1 then 'active' else 'past_due' end,now()+interval '30 days') on conflict(member_id) do nothing;
      token:=encode(extensions.gen_random_bytes(32),'hex');
      insert into private.credentials(member_id,token_hash,encrypted_token) values(uid,extensions.digest(token,'sha256'),
        extensions.pgp_sym_encrypt(token,(select value from private.settings where key='qr_key'))) on conflict(member_id) do nothing;
    end if;
  end loop;
  insert into private.employees(id,partner_id,name,code_hash) values
    ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Marina — TESTE',extensions.crypt('2468',extensions.gen_salt('bf'))),
    ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Pedro — TESTE',extensions.crypt('1357',extensions.gen_salt('bf'))) on conflict(id) do nothing;
end $$;

-- Legal documents are seeded via migrations (see 20261122183000_legal_documents_br_v1.sql).

-- Pending identity for dual-contact enrollment acceptance; no member/role/benefits yet.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
values('00000000-0000-0000-0000-000000000000','00000000-0000-4000-8000-000000000008','authenticated','authenticated','novo@rkmed.test',
  extensions.crypt('RKMED-local-test-2026!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','') on conflict(id) do nothing;
insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
values(gen_random_uuid(),'00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000008',
  '{"sub":"00000000-0000-4000-8000-000000000008","email":"novo@rkmed.test","email_verified":true}','email',now(),now(),now()) on conflict(provider_id,provider) do nothing;
