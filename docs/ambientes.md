# Configuração de ambientes

O projeto utiliza três arquivos de ambiente na raiz, todos ignorados pelo Git:

| Arquivo | Uso |
| --- | --- |
| `.env.stage` | Frontend local conectado ao Supabase hospedado de homologação, iniciado com `npm run stage` |
| `.env.test` | Frontend de testes, Supabase local ou hospedado de homologação, Edge Functions locais e ferramentas Stripe de teste |
| `.env.prod` | Configuração comercial explícita; preencher somente com os valores próprios desse ambiente |

Execute `npm run env:init` em uma máquina nova. O comando cria os dois arquivos com campos conhecidos e permissões `0600`, sem sobrescrever arquivos existentes. Os valores padrão estão em `scripts/env/files.mjs`; segredos devem ser preenchidos localmente ou fornecidos pelo gerenciador de segredos/CI. Variáveis do processo têm precedência sobre o arquivo selecionado.

## Arquitetura atual e variáveis necessárias

| Camada | Implementação atual | Configuração |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind e PWA; interfaces pública, associado, parceiro e equipe | `VITE_APP_MODE`, `VITE_APP_ENV`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_REF` |
| Recursos visuais opcionais | Detecção facial local e mapa de parceiros | `VITE_FACE_DETECTION_MIN_CONFIDENCE`, `VITE_GOOGLE_MAPS_EMBED_KEY` |
| Backend | Supabase Edge Functions, PostgreSQL com RPC/RLS e Storage privado; sem servidor Fastify separado | `APP_ENV`, `APP_ORIGIN`; credenciais internas do Supabase fornecidas pelo runtime |
| Identificação e sessão | RKMED gera/verifica OTP de e-mail e SMS; adaptador interno emite sessão gerenciada pelo Supabase Auth | `OTP_HMAC_SECRET`; ver [OTP independente](smsdev-otp.md) |
| Entrega de SMS | ClickSend, sem validação de OTP pelo fornecedor | `CLICKSEND_MODE`, `CLICKSEND_API_KEY`, `CLICKSEND_USERNAME`, `SMS_ALLOWED_TEST_NUMBERS` |
| Entrega de e-mail | Resend para OTP e notificações transacionais | `RESEND_MODE`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_ALLOWED_TEST_EMAILS` |
| Assinaturas e Wedea | Stripe Checkout/Billing, Customer Portal, webhook assinado e Connect com transferências separadas | `STRIPE_SECRET_KEY`, `STRIPE_TEST_ACCOUNT_ID`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PORTAL_CONFIGURATION_ID`, `STRIPE_WEDEA_ACCOUNT_ID` |
| Rotinas operacionais | `provider-jobs` concilia pagamentos, retoma transferências e envia notificações | `JOBS_SECRET`, `OPERATIONS_TEST_EMAIL` |
| Ferramentas locais Stripe | Catálogo/Checkout sintético e receptor HTTP independente | Somente em `.env.test`: `STRIPE_TEST_ENV`, `STRIPE_TEST_ORIGIN`, `STRIPE_CLI_WEBHOOK_SECRET` |

Desde 15/11/2026, o código aceita produção com configuração explícita e isolada. Os nomes `*_TEST_*` da tabela continuam exclusivos de local/homologação; produção utiliza os campos próprios abaixo. O suporte foi validado localmente com transportes simulados, sem credenciais live ou publicação comercial.

Foram retirados dos dois arquivos e dos padrões do inicializador: `TWILIO_*`, `AUTH_SMS_HOOK_SECRET`, `AUTH_EMAIL_HOOK_SECRET`, `SMS_MODE` e campos `LEGACY_*`. Twilio não é importado por nenhum handler ativo; os handlers nativos `auth-sms`/`auth-email` apenas recusam o fluxo de entrega antigo e não leem segredos de hook. O adaptador Twilio legado e seus testes permanecem no repositório, sem configuração nos arquivos de ambiente.

## Comandos

| Comando | Arquivo/configuração |
| --- | --- |
| `npm run stage` | `.env.stage`; interface conectada ao Supabase de homologação em `http://127.0.0.1:5175`; recusa configuração local/produção |
| `npm run dev` | `.env.test`; respeita `VITE_APP_MODE` configurado |
| `npm run dev:sandbox` | `.env.test`; seleciona a interface conectada (`VITE_APP_MODE=sandbox`) |
| `npm run build` | `.env.test`; mantém o build de testes atual em `dist/` |
| `npm run build:sandbox` | `.env.test`; interface conectada em `dist-sandbox/` |
| `npm run build:prod` | `.env.prod`; exige configuração comercial completa e isolada, sem aceitar target preview |
| `npm run preview` | Visualização local do build de testes |
| `npm run functions:serve` | `supabase functions serve --env-file .env.test` |
| `npm run stripe:init` | Mesmo inicializador dos dois arquivos, sem apagar valores |
| `npm run stripe:doctor` e demais ferramentas Stripe | `.env.test`; as operações continuam restritas a Stripe de teste |
| `npm run local:prepare` | Atualiza somente o destino público/local e `APP_ENV`/`APP_ORIGIN` de `.env.test`, preservando as configurações dos provedores; prepara fixtures locais |

Para homologação remota, configurar em `.env.test` `VITE_APP_MODE=sandbox`, `VITE_APP_ENV=sandbox`, URL, referência e chave publicável do projeto dedicado a testes, `APP_ENV=sandbox` e `APP_ORIGIN` HTTPS. `local:prepare` volta a apontar esse arquivo para o Docker local; não executá-lo para preparar homologação remota.

## Frontend e segredos

Os arquivos reúnem campos públicos e privados, mas o Vite seleciona apenas as variáveis `VITE_*` para o navegador. A leitura automática de outros arquivos dotenv foi desativada. Não usar o prefixo `VITE_` em chaves Stripe, Resend, SMS, tokens de jobs, segredos OTP ou chaves privilegiadas do Supabase.

As Edge Functions hospedadas continuam recebendo segredos pelo ambiente do Supabase. O arquivo da raiz não é publicado automaticamente. Configurar no provedor somente as variáveis de servidor necessárias; as chaves internas `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidas pelo runtime. Não importar o arquivo inteiro como configuração pública de hospedagem.

`STRIPE_WEBHOOK_SECRET` pertence ao webhook das Edge Functions. Quando o receptor independente na porta 4242 usa outro listener, configurar seu segredo em `STRIPE_CLI_WEBHOOK_SECRET`; as ferramentas usam esse campo e, se estiver vazio, usam `STRIPE_WEBHOOK_SECRET`. A chave e a conta Stripe são compartilhadas pelo mesmo `.env.test`.

A revisão posterior à consolidação removeu a chave arquivada do protótipo que estava em `LEGACY_*`, pois não participa da arquitetura atual. Os valores das variáveis ainda utilizadas foram preservados; `.env.prod` não recebeu credenciais de testes.

Criar `.env.prod` não libera tráfego comercial: o runtime exige projeto separado, origem HTTPS, ambiente do banco compatível e credenciais próprias. Não houve deploy ou troca de credenciais remotas nesta implementação.

Referências: [Vite e variáveis públicas](https://vite.dev/guide/env-and-mode), [segredos de Edge Functions](https://supabase.com/docs/guides/functions/secrets).


## Comandos atuais de frontend

`npm run dev` e `npm run build` selecionam o frontend conectado ao banco configurado em `.env.test`. Para demonstração isolada: `dev:demo` e `build:demo` (saída `dist-demo`). `build:hosted` força frontend conectado e ambiente sandbox HTTPS, exigindo referência/URL/chave publicável remotas fornecidas pela Vercel. Sua saída é `dist`. `build:sandbox` continua disponível para QA local em `dist-sandbox`.

A Vercel usa `build:hosted`; as variáveis públicas foram configuradas no projeto existente. A designação de target `production` da Vercel representa o domínio estável de homologação, e não habilita cobrança live ou `APP_ENV=production`. O caminho comercial usa `.env.prod` e seleção explícita do build, com validações próprias de isolamento. Credenciais ClickSend de teste não foram copiadas para produção.

D32: a homologação atual usa `SMS_ALLOWED_TEST_NUMBERS=*` e `RESEND_ALLOWED_TEST_EMAILS=*`, por autorização explícita do usuário. Os valores padrão vazios continuam fechados. A liberação não muda limites/consumo único do OTP nem o modo de teste Stripe.


## Configuração comercial explícita — 15/11/2026

`VITE_APP_MODE=sandbox` é o nome histórico da interface conectada, também usada em produção; não controla o modo de cobrança. O ambiente é definido por `VITE_APP_ENV` no frontend e `APP_ENV` no servidor. Não utilizar modo demo em produção.

| Camada | Valores obrigatórios de produção |
| --- | --- |
| Frontend | `VITE_APP_MODE=sandbox`, `VITE_APP_ENV=production`, `VITE_APP_ORIGIN=https://<dominio-comercial>`, URL/referência/chave publicável do Supabase comercial; `VITE_SANDBOX_SUPABASE_PROJECT_REF` identifica o projeto de homologação e deve ser diferente do comercial |
| Edge Functions | `APP_ENV=production`, `APP_ORIGIN` igual à origem comercial, `APP_PROJECT_REF` igual à referência comercial e `SANDBOX_SUPABASE_PROJECT_REF` igual à referência de homologação; o runtime confere `SUPABASE_URL` e o ambiente persistido no banco |
| Stripe | `STRIPE_ACCOUNT_ID` próprio do runtime comercial, chave restrita `rk_live_…` (ou secret `sk_live_…`) no servidor, preço live BRL 6990/mês, configuração live do portal, segredo do webhook live e destinatário Wedea live com capacidade ativa |
| SMS | `CLICKSEND_MODE=production`, credenciais próprias e `SMS_ALLOWED_NUMBERS`; lista explícita ou `*` para abrir cadastros, vazia recusa envio |
| E-mail | `RESEND_MODE=transactional-production`, credenciais/remetente verificados e `RESEND_ALLOWED_EMAILS`; lista explícita ou `*`, vazia recusa envio |
| Operação | `OTP_HMAC_SECRET`, `JOBS_SECRET` próprios; `OPERATIONS_EMAIL` para revisão de risco |
| Vercel comercial | `RKMED_DEPLOY_ENV=production` exclusivamente no target Production; o seletor exige `VERCEL_ENV=production` e executa `build:prod` |

O inicializador continua preservando arquivos existentes. Arquivos `.env.prod` antigos precisam receber os novos campos manualmente ou via gerenciador de segredos; nenhuma credencial é copiada de `.env.test`.

Em previews, usar `RKMED_DEPLOY_ENV=sandbox` e variáveis públicas de homologação. O domínio estável atual continua selecionando `build:hosted` por padrão. O build comercial é recusado em preview e a aplicação comercial só inicia na origem configurada. Manifesto, service worker, sessão e snapshot offline têm separação para produção. As ferramentas independentes `scripts/stripe/` continuam exclusivamente de teste.

Antes de publicar os handlers novos, aplicar as migrations versionadas, incluindo `20261116011052_production_runtime_guard`. No projeto comercial aprovado, configurar pelo acesso administrativo ao banco `private.settings.environment=production`; no projeto de homologação, `sandbox`; no Docker, `local`. Os serviços consultam uma RPC exclusiva de `service_role` e recusam divergência. As migrations não promovem automaticamente um banco para produção.

A configuração comercial do banco mantém documentos `test_only` fora do cadastro e do Checkout, e impede provisionamento de parceiros sintéticos. Publicar documentos finais aprovados continua sendo requisito independente. O pacote opcional gerado com `package-functions.mjs <saida> <origem>` fixa sandbox; não usá-lo para publicar produção. O pacote sem origem utiliza os segredos/configuração do runtime.


`stage` lê somente `.env.stage` (com precedência de variáveis explícitas do processo), sem carregar `.env.test`, `.env.prod` ou `.env.local`. O arquivo precisa existir e conter `VITE_APP_ENV=sandbox`, URL HTTPS, referência e chave pública válidas. O comando inicia apenas o frontend local; não publica nem altera as configurações de origem das Edge Functions hospedadas. Operações dessas funções continuam sujeitas à origem permitida no backend. `env:init` continua criando somente `.env.test` e `.env.prod`, preservando o `.env.stage` existente.

Em 16/11/2026, o projeto stage `wfgiokooedjalmvqgbub` recebeu as 27 migrations e `private.settings.environment=sandbox`; `.env.stage` aponta para sua URL e chave publicável. A preparação inicial não criou usuários ou publicou funções. Os gateways e a configuração OTP foram publicados posteriormente conforme a seção de CORS abaixo. Primeiro administrador, demais funções/provedores e aceite integrado ainda precisam de configuração/verificação.

A comparação do catálogo com o projeto publicado `chuyompxoctmpawhfmyb` encontrou as mesmas 27 migrations e definições dos objetos de aplicação nos schemas public/private, exceto cinco funções adicionais no projeto publicado: `delete_public_user`, `event_trigger_fn`, `rls_auto_enable`, `set_phone_to_confirmed` e `sync_stripe_checkout_to_users`. Três têm gatilhos ativos em Auth, Stripe ou eventos DDL; não foram copiadas sem avaliação. A comparação não abrange dados, configurações Auth/Storage, extensões ou integrações completas. O projeto publicado está documentado como homologação, e `.env.prod` não identifica outro projeto comercial.

### Origem do frontend e CORS

A origem hospedada atual é `https://rkmed.vercel.app`, sem barra final em `APP_ORIGIN`. Os gateways `phone-code` e `rkmed-api` também aceitam as origens exatas declaradas em `CORS_ALLOWED_ORIGINS` (separadas por vírgula). Em homologação, foram configuradas `http://127.0.0.1:5175` e `http://localhost:5175`. Não há wildcard, correspondência por sufixo ou liberação implícita de outras portas. Produção recusa origens HTTP de loopback mesmo se incluídas por engano na lista. Links, recuperação de senha e retorno de pagamentos usam a origem canônica.

Os dois gateways foram publicados nos projetos `chuyompxoctmpawhfmyb` e `wfgiokooedjalmvqgbub`; o stage recebeu a configuração OTP de `.env.stage`. O site URL e redirecionamentos Auth dos dois projetos foram atualizados para o domínio novo e endereços locais de stage. Isso não publica o frontend ou os demais workers/webhooks. Se um processo antigo ainda chamar o projeto anterior, reiniciar `npm run stage` para recarregar `.env.stage`.
