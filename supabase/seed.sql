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

insert into private.documents(version,kind,content,test_only) values('test-terms-v1','terms','# Termos de uso — RKMED Linha Gold — MOCK

**Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.**

Versão: `mock-2026-10-06`. Ambiente: desenvolvimento e homologação.

O RKMED Linha Gold é apresentado neste protótipo como um clube de benefícios para pessoas maiores de 18 anos. O cadastro utiliza dados de identificação, contato e foto para acesso ao cartão e conferência visual nos parceiros. A detecção de rosto confirma apenas a presença de um rosto na imagem; não comprova identidade.

A mensalidade usada nos testes é de R$69,90, com cobrança recorrente pelo Stripe em ambiente de teste. Nenhum pagamento real deve ser realizado neste protótipo. O membro paga suas compras diretamente ao parceiro; o RKMED registra o valor e o desconto, sem receber o pagamento da compra.

O cartão possui QR estático e deve ser usado pelo próprio titular. O parceiro precisa de internet para verificar a situação atual e registrar a compra. Uma falha de pagamento retira imediatamente o acesso aos benefícios, ainda que o cartão salvo no celular apresente dados antigos. As retentativas previstas são D+0, D+1 e D+3.

As seções do aplicativo podem exibir cópias salvas sem internet. Elas mostram a data de atualização e não garantem a disponibilidade atual de um benefício. Alterações de cobrança, pagamentos e envio de mensagens dependem de conexão. O navegador pode apagar dados locais.

Cancelamento, retorno ao clube, contestação de registros e atendimento dependem de procedimentos ainda em definição. Contato de teste: suporte@example.invalid. Regras definitivas de contratação e cancelamento serão substituídas após revisão e aprovação.
',true) on conflict(version) do nothing;

insert into private.documents(version,kind,content,test_only) values('test-privacy-v1','privacy','# Aviso de privacidade — MOCK

**Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.**

Versão: `mock-2026-10-06`. Utilizar somente dados fictícios.

Controlador: [DEFINIR RESPONSÁVEL LEGAL]. Contato: privacidade@example.invalid.

O protótipo prevê nome, CPF, data de nascimento, contatos, foto, registros de aceite, situação da assinatura e valores de compras/descontos. Não prevê diagnóstico, prontuário ou categoria de exame. A senha de uso permanente por PIN foi removida; o primeiro cadastro exige verificação por código no e-mail e no telefone (WhatsApp via Twilio, com SMS como alternativa de entrega). Depois, o acesso pode usar um desses contatos verificados.

Os dados simulados permitem testar adesão, autenticação, cobrança, conferência visual no parceiro, registro de descontos e suporte. O parceiro recebe somente as informações necessárias para o atendimento autorizado. Administração, suporte RK e diretoria têm permissões distintas; O CPF completo não é exibido para operadores, inclusive administradores; a busca exata autorizada retorna apenas uma versão mascarada.

Supabase, Stripe, Twilio e Resend integram o desenho técnico. Resend envia e-mails de verificação e comunicações transacionais. O serviço de detecção facial está em definição. A relação final de operadores, finalidades, bases legais e transferências será revisada antes da produção.

No celular, uma cópia dos dados aprovados da área do membro permanece disponível sem prazo de expiração imposto pelo aplicativo. Sair da conta ou trocar de usuário deve limpar essa cópia. O navegador pode removê-la por conta própria; o aplicativo deve informar a data da última sincronização. Proteja o acesso ao dispositivo.

Prazos de retenção no servidor, procedimentos de exclusão, atendimento aos direitos do titular e resposta a incidentes estão pendentes de revisão jurídica. Este mock não define prazo legal. Para testes, usar privacidade@example.invalid.
',true) on conflict(version) do nothing;

insert into private.documents(version,kind,content,test_only) values('test-photo-v1','photo','# Aviso e aceite de foto — MOCK

**Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.**

Versão: `mock-2026-10-06`.

A foto será usada no protótipo para testar a exibição do cartão e a conferência visual durante uma compra no parceiro. O processamento automático verifica se existe um rosto na foto. Ele não realiza reconhecimento de identidade nem prova de vida.

Usar apenas imagens fictícias/autorizadas para teste. O desenho prevê armazenamento privado e acesso restrito ao titular e aos operadores autorizados. As condições definitivas de tratamento, eventual cópia offline, compartilhamento com o processador de imagem e exclusão aguardam aprovação.

Checkbox de teste, inicialmente desmarcado: “Li este aviso de teste e concordo em prosseguir com dados fictícios.”

Registrar versão e momento do aceite apenas como fixture. Este registro não substitui consentimento ou outra base legal aprovada para o produto real.
',true) on conflict(version) do nothing;

-- Pending identity for dual-contact enrollment acceptance; no member/role/benefits yet.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
values('00000000-0000-0000-0000-000000000000','00000000-0000-4000-8000-000000000008','authenticated','authenticated','novo@rkmed.test',
  extensions.crypt('RKMED-local-test-2026!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','') on conflict(id) do nothing;
insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
values(gen_random_uuid(),'00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000008',
  '{"sub":"00000000-0000-4000-8000-000000000008","email":"novo@rkmed.test","email_verified":true}','email',now(),now(),now()) on conflict(provider_id,provider) do nothing;
