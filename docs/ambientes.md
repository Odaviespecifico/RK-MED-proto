# Configuração de ambientes

O projeto utiliza somente dois arquivos de ambiente, ambos na raiz e ignorados pelo Git:

| Arquivo | Uso |
| --- | --- |
| `.env.test` | Frontend de testes, Supabase local ou hospedado de homologação, Edge Functions locais e ferramentas Stripe de teste |
| `.env.prod` | Configuração reservada para produção; preencher somente com os valores próprios desse ambiente |

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

Os nomes e as proteções dos adaptadores atuais foram mantidos. Por isso, `STRIPE_TEST_ACCOUNT_ID` e as listas de destinatários de teste continuam nos campos de configuração do runtime. Removê-los exigiria mudar o contrato dos adaptadores. O arquivo `.env.prod` continua reservado para a futura habilitação de produção, não representa suporte live já implementado.

Foram retirados dos dois arquivos e dos padrões do inicializador: `TWILIO_*`, `AUTH_SMS_HOOK_SECRET`, `AUTH_EMAIL_HOOK_SECRET`, `SMS_MODE` e campos `LEGACY_*`. Twilio não é importado por nenhum handler ativo; os handlers nativos `auth-sms`/`auth-email` apenas recusam o fluxo de entrega antigo e não leem segredos de hook. O adaptador Twilio legado e seus testes permanecem no repositório, sem configuração nos arquivos de ambiente.

## Comandos

| Comando | Arquivo/configuração |
| --- | --- |
| `npm run dev` | `.env.test`; respeita `VITE_APP_MODE` configurado |
| `npm run dev:sandbox` | `.env.test`; seleciona a interface conectada (`VITE_APP_MODE=sandbox`) |
| `npm run build` | `.env.test`; mantém o build de testes atual em `dist/` |
| `npm run build:sandbox` | `.env.test`; interface conectada em `dist-sandbox/` |
| `npm run build:prod` | `.env.prod`; mantém a recusa existente enquanto o aplicativo não suportar produção |
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

Criar `.env.prod` não habilita produção: o frontend e os adaptadores ainda recusam esse ambiente conforme o planejamento. Não há deploy ou troca de credenciais remotas nesta alteração.

Referências: [Vite e variáveis públicas](https://vite.dev/guide/env-and-mode), [segredos de Edge Functions](https://supabase.com/docs/guides/functions/secrets).


## Comandos atuais de frontend

`npm run dev` e `npm run build` selecionam o frontend conectado ao banco configurado em `.env.test`. Para demonstração isolada: `dev:demo` e `build:demo` (saída `dist-demo`). `build:hosted` força frontend conectado e ambiente sandbox HTTPS, exigindo referência/URL/chave publicável remotas fornecidas pela Vercel. Sua saída é `dist`. `build:sandbox` continua disponível para QA local em `dist-sandbox`.

A Vercel usa `build:hosted`; as variáveis públicas foram configuradas no projeto existente. A designação de target `production` da Vercel representa o domínio estável de homologação, e não habilita cobrança live ou `APP_ENV=production`. `.env.prod` permanece separado e bloqueado pelo runtime. Credenciais ClickSend de teste não foram copiadas para produção.

D32: a homologação atual usa `SMS_ALLOWED_TEST_NUMBERS=*` e `RESEND_ALLOWED_TEST_EMAILS=*`, por autorização explícita do usuário. Os valores padrão vazios continuam fechados. A liberação não muda limites/consumo único do OTP nem o modo de teste Stripe.
