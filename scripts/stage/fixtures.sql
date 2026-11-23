-- Dedicated stage dataset, never included in migrations or the Docker seed.
-- {{PASSWORD_HASH}} and {{EMPLOYEE_CODES}} are filled by the guarded runner.
begin;
set local statement_timeout='120s';
select pg_advisory_xact_lock(hashtextextended('rkmed.stage-fixtures-v1',0));
create function pg_temp.fixture_id(kind integer,n integer) returns uuid language sql immutable as $$
 select ('f17e'||lpad(to_hex(kind),4,'0')||'-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.fixture_document(base text,weights integer[]) returns text language plpgsql immutable as $$
declare result text:=base; total integer; digit integer; round integer;
begin
 for round in 1..2 loop
  total:=0;
  if array_length(weights,1)=9 then
   for j in 1..length(result) loop total:=total+substr(result,j,1)::integer*(length(result)+2-j); end loop;
   digit:=(total*10)%11; if digit=10 then digit:=0; end if;
  else
   for j in 1..length(result) loop total:=total+substr(result,j,1)::integer*(case when round=1 then weights[j] else (array[6,5,4,3,2,9,8,7,6,5,4,3,2])[j] end); end loop;
   digit:=case when total%11<2 then 0 else 11-total%11 end;
  end if;
  result:=result||digit;
 end loop;
 return result;
end $$;
do $$
declare i integer; j integer; mid uuid; pid uuid; eid uuid; uid uuid; rid uuid; at_time timestamptz;
 role_name text; mail text; label text; billing text; token text; code text; gross bigint; discount bigint; rate integer;
 mi integer; pi integer; ticket_status text; answered boolean; codes jsonb:='{{EMPLOYEE_CODES}}'::jsonb;
 password_hash text:='{{PASSWORD_HASH}}';
 first_names text[]:=array['Lara','Miguel','Helena','Ravi','Cecília','Theo','Alice','Caio','Isadora','Daniel','Luana','Davi'];
 last_names text[]:=array['Silveira','Barros','Menezes','Duarte','Andrade','Azevedo','Farias','Nogueira'];
 segments text[]:=array['Laboratório','Academia','Suplementos'];
begin
 if (select value from private.settings where key='environment') is distinct from 'sandbox' then raise exception 'Seed autorizado somente no stage sandbox'; end if;
 if exists(select 1 from private.bootstrap_metadata where key='stage-fixtures-v1') then raise notice 'Carga já aplicada; nada alterado'; return; end if;
 if exists(select 1 from auth.users where id::text like 'f17e%' or email like '%@stage.rkmed.invalid')
    or exists(select 1 from private.partners where id::text like 'f17e%') then raise exception 'Namespace reservado já ocupado; carga cancelada'; end if;

 for i in 1..60 loop
  pid:=pg_temp.fixture_id(2,i);
  label:=(array['Laboratório Aurora','Academia Horizonte','Suplementos Boa Rotina'])[(i-1)%3+1]||' '||lpad(i::text,3,'0')||' — FICTÍCIO STAGE';
  insert into private.partners(id,name,segment,address,discount_bps,active,created_at,is_test,street,street_number,neighborhood,postal_code,city,state,description,cnpj,email)
   values(pid,label,segments[(i-1)%3+1],'Rua Fictícia de Homologação, '||i||' · Centro · Carpina, PE',
    (array[1000,1500,2000,2500])[(i-1)%4+1],i%12<>0,now()-interval '210 days'+(i/8)*interval '1 day',false,
    'Rua Fictícia de Homologação',i::text,'Centro','55810000','Carpina','PE','Estabelecimento fictício para testar cadastro, filtros e paginação. Não representa um parceiro real.',
    pg_temp.fixture_document('990'||lpad(i::text,5,'0')||'0001',array[5,4,3,2,9,8,7,6,5,4,3,2]),'parceiro.'||lpad(i::text,3,'0')||'@stage.rkmed.invalid');
 end loop;

 for i in 1..360 loop
  if i<=240 then uid:=pg_temp.fixture_id(1,i); mail:='cliente.'||lpad(i::text,3,'0')||'@stage.rkmed.invalid'; role_name:='member'; pid:=null;
  elsif i<=300 then j:=i-240; uid:=pg_temp.fixture_id(11,j); mail:='parceiro.'||lpad(j::text,3,'0')||'@stage.rkmed.invalid'; role_name:='partner'; pid:=pg_temp.fixture_id(2,j);
  else j:=i-300; uid:=pg_temp.fixture_id(4,j); mail:=case when j=1 then 'admin' else 'equipe.'||lpad(j::text,3,'0') end||'@stage.rkmed.invalid'; role_name:=case when j=1 then 'admin' when j<=31 then 'support' else 'viewer' end; pid:=null; end if;
  at_time:=now()-interval '190 days'+(i/8)*interval '1 day';
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,phone,phone_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
   values('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated',mail,password_hash,at_time,
    case when i<=240 then '5500999'||lpad(i::text,6,'0') end,case when i<=240 then at_time end,
    '{"provider":"email","providers":["email"],"rkmed_fixture":"stage-fixtures-v1"}',
    jsonb_build_object('fixture','FICTÍCIO STAGE'),at_time,at_time,'','','','');
  insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
   values(gen_random_uuid(),uid,uid::text,jsonb_build_object('sub',uid,'email',mail,'email_verified',true),'email',at_time,at_time,at_time);
  insert into private.roles(user_id,role,partner_id,active) values(uid,role_name,pid,i<=300 or j%15<>0);
  if i<=240 then
   label:=first_names[(i-1)%12+1]||' '||last_names[((i-1)/12)%8+1]||' '||lpad(i::text,3,'0')||' — FICTÍCIO STAGE';
   billing:=case when (i-1)%8<4 then 'active' when (i-1)%8<6 then 'past_due' when (i-1)%8=6 then 'canceled' else 'incomplete' end;
   insert into private.members(id,name,birth_date,blocked,block_reason,created_at) values(uid,label,date '1960-01-01'+(i*97%14000),i%41=0,case when i%41=0 then 'Bloqueio administrativo fictício de homologação' end,at_time);
   insert into private.member_identity(member_id,cpf) values(uid,pg_temp.fixture_document('800'||lpad(i::text,6,'0'),array[1,1,1,1,1,1,1,1,1]));
   insert into private.subscriptions(member_id,state,paid_through,cancel_at_period_end,invoice_id,amount_due,updated_at)
    values(uid,billing,case when billing='active' then now()+interval '30 days' when billing='past_due' then now()-interval '5 days' when billing='canceled' then now()-interval '15 days' end,
     billing='active' and i%4=0,case when billing<>'incomplete' then 'in_StageFixture'||lpad(i::text,6,'0') end,case when billing='past_due' then 6990 else 0 end,now()-(i/8)*interval '1 hour');
   token:=encode(extensions.gen_random_bytes(32),'hex');
   insert into private.credentials(member_id,token_hash,encrypted_token,issued_at) values(uid,extensions.digest(token,'sha256'),extensions.pgp_sym_encrypt(token,(select value from private.settings where key='qr_key')),at_time);
  end if;
 end loop;

 for i in 1..276 loop
  pi:=case when i<=240 then (i-1)/4+1 else 1 end; pid:=pg_temp.fixture_id(2,pi);
  code:=codes->>(i-1);
  if code !~ '^[0-9]{4}$' or exists(select 1 from private.employees e where e.partner_id=pid and extensions.crypt(code,e.code_hash)=e.code_hash) then raise exception 'Código de funcionário ausente ou repetido'; end if;
  insert into private.employees(id,partner_id,name,code_hash,active) values(pg_temp.fixture_id(3,i),pid,'Funcionário '||lpad(i::text,3,'0')||' — FICTÍCIO STAGE',extensions.crypt(code,extensions.gen_salt('bf',6)),i%9<>0);
 end loop;

 for role_name in select unnest(array['terms','privacy','photo']) loop
  insert into private.documents(version,kind,content,test_only,active)
   values('stage-fixture-'||role_name||'-v1',role_name,
    '# Documento de homologação — '||role_name||E'\n\nCadastro e pagamentos de homologação de stage. Utilize somente dados fictícios.',
    true,not exists(select 1 from private.documents where kind=role_name and active));
 end loop;
 insert into private.consents(member_id,version,accepted_at)
  select m.id,d.version,m.created_at from private.members m cross join private.documents d
   where m.id::text like 'f17e0001-%' and d.active;

 for i in 1..3720 loop
  mi:=case when i>3600 then 1 else (i-1)%240+1 end;
  if (mi-1)%8=7 then mi:=mi-7; end if; -- no purchases for incomplete enrollments
  pi:=case when i>3600 then 1 else ((i-1)/240+(i-1)%60)%60+1 end;
  mid:=pg_temp.fixture_id(1,mi); pid:=pg_temp.fixture_id(2,pi); eid:=pg_temp.fixture_id(3,(pi-1)*4+1);
  at_time:=now()-interval '30 minutes'-((i-1)/20)*interval '12 hours';
  select discount_bps into rate from private.partners where id=pid;
  gross:=case when i%37=0 then 2 else (i%137+1)*100+29 end;
  discount:=floor((gross*rate+5000)::numeric/10000)::bigint;
  insert into private.validations(id,member_id,session_id,employee_id,partner_id,expires_at,consumed_at)
   values(pg_temp.fixture_id(6,i),mid,pg_temp.fixture_id(12,pi),eid,pid,at_time+interval '5 minutes',at_time+interval '1 minute');
  insert into private.purchases(id,operation_id,receipt_id,member_id,partner_id,employee_id,employee_name,actor_id,gross_cents,discount_bps,discount_cents,final_cents,created_at)
   values(pg_temp.fixture_id(5,i),pg_temp.fixture_id(13,i),pg_temp.fixture_id(6,i),mid,pid,eid,
    'Funcionário '||lpad(((pi-1)*4+1)::text,3,'0')||' — FICTÍCIO STAGE',pg_temp.fixture_id(11,pi),gross,rate,discount,gross-discount,at_time+interval '1 minute');
  if i%31=0 then
   insert into private.reversals(id,purchase_id,actor_id,reason,created_at)
    values(pg_temp.fixture_id(9,i),pg_temp.fixture_id(5,i),pg_temp.fixture_id(4,1),'Estorno fictício para teste de histórico e economia',least(now()-interval '5 minutes',at_time+interval '1 day'));
  end if;
 end loop;

 for i in 1..400 loop
  mi:=case when i<=80 then 1 else (i-1)%240+1 end; mid:=pg_temp.fixture_id(1,mi);
  at_time:=now()-interval '4 hours'-(i/6)*interval '1 day';
  ticket_status:=(array['open','answered','closed'])[(i-1)%3+1]; answered:=ticket_status<>'open';
  rid:=pg_temp.fixture_id(7,i);
  insert into private.support_requests(id,member_id,message,status,response,answered_at,answered_by,created_at)
   values(rid,mid,'Atendimento '||lpad(i::text,3,'0')||' — FICTÍCIO STAGE. Dúvida simulada sobre '||(array['cartão digital','assinatura','desconto registrado','acesso à conta'])[(i-1)%4+1]||'.',ticket_status,
    case when answered then 'Resposta fictícia para validar atendimento e histórico no stage.' end,
    case when answered then at_time+interval '30 minutes' end,case when answered then pg_temp.fixture_id(4,1) end,at_time);
  if answered then
   insert into private.notification_outbox(id,member_id,event_key,kind,status,attempts,next_attempt,reference_id,provider_id,created_at)
    values(pg_temp.fixture_id(8,i),mid,'support.answer:'||rid::text,'support.answer',
     case when i%4=0 then 'failed' when i%4=1 then 'pending' else 'sent' end,
     case when i%4=0 then 5 else 0 end,'infinity',rid::text,case when i%4 in (2,3) then 'stage-fixture-not-delivered-'||i end,at_time+interval '30 minutes');
  end if;
 end loop;
 for i in 1..64 loop
  insert into private.notification_outbox(id,member_id,event_key,kind,status,attempts,next_attempt,created_at)
   values(pg_temp.fixture_id(8,1000+i),pg_temp.fixture_id(1,i),'stage-fixtures-v1:billing:'||i,
    case when i%8=0 then 'risk.fixture.review' else 'billing.past_due' end,case when i%3=0 then 'pending' else 'failed' end,
    case when i%3=0 then 0 else 5 end,'infinity',now()-i*interval '1 day');
 end loop;
 for i in 1..96 loop
  insert into private.webhook_events(event_id,event_type,object_id,provider_created,status,attempts,last_error,created_at)
   values('evt_StageFixture'||lpad(i::text,6,'0'),case when i%3=0 then 'invoice.payment_failed' else 'invoice.paid' end,
    'in_StageFixture'||lpad(i::text,6,'0'),extract(epoch from now()-i*interval '1 day')::bigint,
    case when i%12=0 then 'failed' else 'processed' end,case when i%12=0 then 10 else 1 end,
    'FICTÍCIO STAGE — evento fabricado, não recebido do Stripe',now()-i*interval '1 day');
 end loop;
 for i in 1..80 loop
  insert into private.checkout_operations(operation_id,member_id,status,created_at)
   values(pg_temp.fixture_id(10,i),pg_temp.fixture_id(1,i),'expired',now()-interval '5 days');
 end loop;
 for i in 1..60 loop
  insert into private.collection_operations(operation_id,member_id,actor_id,invoice_id,action,status,created_at)
   values(pg_temp.fixture_id(14,i),pg_temp.fixture_id(1,i),pg_temp.fixture_id(4,1),'in_StageFixture'||lpad(i::text,6,'0'),
    case when i%2=0 then 'link' else 'retry' end,case when i%3=0 then 'failed' else 'succeeded' end,now()-i*interval '1 day');
 end loop;
 for i in 1..40 loop
  insert into private.wedea_shares(invoice_id,member_id,customer_id,subscription_id,active_members,paid_amount,amount_cents,status,transfer_id,created_at,completed_at)
   values('in_StageShareFixture'||lpad(i::text,6,'0'),pg_temp.fixture_id(1,i),'cus_StageFixture'||i,'sub_StageFixture'||i,
    case when i<=20 then 120 else 240 end,6990,case when i<=20 then 0 else 1587 end,
    case when i<=20 then 'skipped' when i<=30 then 'review' else 'sent' end,
    case when i>30 then 'tr_StageFixture'||i end,now()-i*interval '1 day',case when i<=20 or i>30 then now()-i*interval '1 day'+interval '5 minutes' end);
 end loop;
 for i in 1..480 loop
  insert into private.audit(actor_id,action,target_id,reason,correlation_id,created_at)
   values(pg_temp.fixture_id(4,1),case when i%2=0 then 'fixture.stage.purchase' else 'fixture.stage.member' end,
    case when i%2=0 then pg_temp.fixture_id(5,i) else pg_temp.fixture_id(1,(i-1)%240+1) end,
    'Registro fictício da carga stage-fixtures-v1; nenhuma operação externa executada',pg_temp.fixture_id(15,i),now()-(i/8)*interval '1 day');
 end loop;
 insert into private.bootstrap_metadata(key,value) values('stage-fixtures-v1',jsonb_build_object('createdAt',now(),'namespace','f17e','partners',60,'members',240,'staff',60,'purchases',3720,'synthetic',true)::text);
end $$;
select 'stage-fixtures-v1' as dataset,
 (select count(*) from private.partners where id::text like 'f17e0002-%') as partners,
 (select count(*) from private.members where id::text like 'f17e0001-%') as members,
 (select count(*) from private.purchases where id::text like 'f17e0005-%') as purchases;
commit;
