# Validação e entrada em produção — RKMED Linha Gold

Este é o roteiro executável para validar o sistema e conduzir a liberação comercial do RKMED. O histórico de evidências e bloqueios registrados permanece em [prontidão para produção](prontidao-producao.md) e o detalhamento de variáveis por ambiente fica em [configuração de ambientes](ambientes.md).

> **Regra de liberação:** testes locais (Docker/mocks) ou deploy bem-sucedido na Vercel **não** substituem a validação nos ambientes hospedados, nos provedores reais e em celulares físicos. Nenhuma etapa abaixo deve ser marcada como concluída sem evidência registrada.

---

## 1. Validação automatizada e integridade do código

Antes de qualquer publicação, executar na raiz do repositório com Docker local ativo (`npm run db:start` e `npm run local:prepare`):

```bash
npm run typecheck
npm test
npm run db:lint
npm run db:test
```

Com o servidor sandbox/preview e `npm run functions:serve` ativos, validar as jornadas conectadas e o benchmark local:

```bash
npm run test:connected:api
npm run test:connected:edge
npm run test:connected:enrollment
npm run test:connected:ui
npm run test:connected:offline
npm run test:connected:reports
npm run test:connected:operational
npm run test:connected:pagination
npm run test:performance
```

Critérios obrigatórios desta etapa:

- [ ] `typecheck`, testes Node, `db:lint` e suíte pgTAP (`db:test`) aprovados sem erros.
- [ ] Build comercial (`npm run build:prod`) aprovado com `.env.prod` válido.
- [ ] Conferência do bundle gerado em `dist/`: ausência de módulos de `src/mocks/`, ausência de chaves privadas ou `service_role` em `VITE_*`, manifesto e Service Worker configurados para produção.

---

## 2. Aprovação jurídica, fiscal e de conteúdo

O runtime de produção bloqueia automaticamente documentos marcados como `test_only = true` no cadastro e no Checkout.

- [ ] Revisar com o jurídico os textos de Termos de Uso, Política de Privacidade e Termo de Uso de Imagem (base em `supabase/migrations/20261122183000_legal_documents_br_v1.sql`), substituindo todos os marcadores (`[RAZÃO SOCIAL DA RKMED]`, `[CNPJ]`, `[ENDEREÇO COMERCIAL]`, `[E-MAIL DE SUPORTE]`).
- [ ] Publicar nova migration inserindo/ativando as versões finais com `test_only = false` e desativando versões de teste anteriores.
- [ ] Formalizar políticas operacionais de retenção/exclusão (LGPD), atendimento ao direito de arrependimento (7 dias — CDC) e canais reais de suporte.
- [ ] Validar configuração fiscal com contabilidade/responsáveis. **Stripe Tax está desabilitado** por padrão; não presumir que ativar `automatic_tax` baste sem enquadramento fiscal.

---

## 3. Isolamento de infraestrutura e configuração de produção

Garantir separação completa entre homologação (`sandbox`) e produção (`production`):

### 3.1 Supabase (banco, Auth, Storage e Edge Functions)

- [ ] Criar projeto Supabase exclusivo para produção (`APP_PROJECT_REF` diferente de `SANDBOX_SUPABASE_PROJECT_REF`).
- [ ] Aplicar todas as migrations versionadas em ordem, **sem** `db reset` e **sem** `seed.sql`. Confirmar histórico atualizado (`upToDate=true`).
- [ ] Configurar `private.settings.environment = 'production'` via acesso administrativo ao banco (validado pela RPC `rk_backend_environment`).
- [ ] Confirmar bucket privado `member-photos` (limite `5MiB`, sem acesso público direto).
- [ ] Publicar as seis Edge Functions (`rkmed-api`, `phone-code`, `stripe-webhook`, `provider-jobs`, `auth-email`, `auth-sms`) sem origem sandbox fixa (não usar `package-functions.mjs <saida> <origem>` com origem de homologação).
- [ ] Configurar secrets exclusivos de produção no Supabase (nunca reutilizar valores de `.env.test`):
  - `APP_ENV=production`, `APP_ORIGIN=https://<dominio-comercial>` (sem barra final), `APP_PROJECT_REF`, `SANDBOX_SUPABASE_PROJECT_REF`.
  - `CORS_ALLOWED_ORIGINS` sem endereços HTTP de loopback (recusados em produção).
  - `OTP_HMAC_SECRET` e `JOBS_SECRET` aleatórios (mínimo 32 caracteres) e `OPERATIONS_EMAIL`.
- [ ] Configurar **Auth remoto**: `Site URL` igual a `https://<dominio-comercial>` e lista de redirects permitidos contendo apenas origens HTTPS de produção (nunca `localhost`/`127.0.0.1`). Confirmar que hooks nativos antigos de OTP não contornam o fluxo próprio da RKMED.
- [ ] Revisar avisos de segurança do painel Supabase (`search_path`, grants de funções `SECURITY DEFINER`, políticas de senha e funções legadas).
- [ ] Configurar o worker agendado com [`scripts/deploy/schedule-jobs.sql`](../scripts/deploy/schedule-jobs.sql) usando `rkmed_jobs_secret` no Vault (nunca gravar bearer em texto plano no cron ou no repositório).

### 3.2 Frontend (Vercel)

- [ ] Criar projeto/target Vercel dedicado à produção com `RKMED_DEPLOY_ENV=production` **exclusivamente** no target `Production` (previews devem permanecer apontando para homologação).
- [ ] Configurar apenas variáveis públicas `VITE_*` de produção (`VITE_APP_MODE=sandbox`, `VITE_APP_ENV=production`, `VITE_APP_ORIGIN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_REF`, `VITE_SANDBOX_SUPABASE_PROJECT_REF`).
- [ ] Provisionar o primeiro administrador por processo operacional confiável (nunca por autocadastro público) e cadastrar parceiros/funcionários reais pelo painel administrativo.

---

## 4. Validação de provedores externos (homologação → live controlada)

Antes de abrir o cadastro ao público, manter `SMS_ALLOWED_NUMBERS` e `RESEND_ALLOWED_EMAILS` restritos aos contatos da equipe de validação; liberar para `*` somente após concluir os testes abaixo.

### 4.1 OTP, e-mail transacional e recuperação de senha (Resend + ClickSend)

- [ ] Configurar `RESEND_MODE=transactional-production` (domínio/remetente verificados) e `CLICKSEND_MODE=production` com credenciais live. Ver [configuração OTP](clicksend-otp.md).
- [ ] Validar recebimento real de OTP por **e-mail** (entregabilidade fora da caixa de spam) e por **SMS** em aparelhos reais.
- [ ] Confirmar cooldown de reenvio, expiração do código, consumo único e bloqueio após limite de tentativas.
- [ ] Exercitar recuperação de senha (`phone-code` / `recover`) para associado, parceiro e equipe: resposta pública genérica, recebimento do e-mail real, uso único/expiração do link, retorno ao domínio HTTPS oficial e login com a nova senha.

### 4.2 Stripe Billing, Checkout, Webhook e Wedea Connect

- [ ] Configurar conta live (`STRIPE_ACCOUNT_ID`), chave restrita live (`rk_live_...`), preço mensal live de **R$ 69,90** (`6990` centavos BRL), `STRIPE_PORTAL_CONFIGURATION_ID` (plano fixo, sem troca de assinatura, cancelamento apenas no fim do período) e `STRIPE_WEBHOOK_SECRET` live.
- [ ] Assinar no endpoint live `stripe-webhook` os 10 eventos obrigatórios: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.dispute.created`, `charge.refunded` e `radar.early_fraud_warning.created`.
- [ ] Configurar retentativas automáticas de cobrança **D+0, D+1 e D+3** no Stripe Billing (sem criar um segundo agendador).
- [ ] Configurar `STRIPE_WEDEA_ACCOUNT_ID` live com capacidade ativa para transferências separadas (Connect) e validar a regra de repasse (R$ 15,87 por pagamento bem-sucedido apenas acima de 200 pagantes ativos, via `provider-jobs`).
- [ ] Executar pagamento controlado e conferir: assinatura permanece `incomplete` até o webhook (retorno do Checkout não ativa benefício), ativação correta após `invoice.paid`, falha de pagamento suspende benefício imediatamente, cancelamento mantém acesso até o fim do ciclo pago, reativação funciona e não há duplicidade de cobrança.

---

## 5. Validação funcional ponta a ponta e segurança

### 5.1 Smoke HTTP pós-publicação

Confirmar os códigos esperados contra o projeto de produção:

- [ ] `POST /functions/v1/rkmed-api` sem token → `401`.
- [ ] `POST /functions/v1/phone-code` com payload inválido → `400`.
- [ ] `POST /functions/v1/provider-jobs` sem bearer → `403`; com `JOBS_SECRET` válido → `200` com `failures: 0`.
- [ ] `POST /functions/v1/stripe-webhook` sem assinatura válida → `400`.
- [ ] `POST /functions/v1/auth-sms` e `POST /functions/v1/auth-email` → `503` (hooks nativos aposentados).
- [ ] Preflight `OPTIONS` (CORS) com `APP_ORIGIN` oficial → `200`; com origem não autorizada → `403`.

### 5.2 Jornadas de negócio e controle de acesso

- [ ] **Cadastro de associado:** e-mail OTP → SMS OTP na mesma identidade Auth → retomada de cadastro → dados pessoais/CPF/aceite das versões finais → captura ao vivo e sanitização de foto privada (JPEG 600×600 sem metadados) → Checkout → exibição do cartão digital e QR estático.
- [ ] **Operação no balcão (Parceiro):** login parceiro → abertura de turno com **código do estabelecimento + código do funcionário** (D33) → leitura do QR pela câmera e fallback por CPF exato com conferência visual da foto → cálculo de desconto no servidor → confirmação idempotente (dois toques geram uma única compra) → **Trocar funcionário** → recusa automática para associado bloqueado ou inadimplente.
- [ ] **Administração e suporte:** gestão de parceiros/funcionários/acessos (exclusivo `admin`), resposta a chamados de suporte com entrega pela `notification_outbox`, cobrança manual em `/admin/cobrancas` (envio de link e retentativa de fatura existente com confirmação explícita e idempotência) e estorno de registro com justificativa auditada (preservando o original e sem estornar Stripe).
- [ ] **Relatórios e Realtime:** consulta paginada, exportação CSV com CPF mascarado e proteção contra injeção de fórmulas (`admin`/`support`), e recebimento de alertas em tempo real via `public.rk_operational_signal` sem expor dados privados.
- [ ] **Testes negativos de autorização:** recusa de acesso anônimo às RPCs privadas; isolamento entre associados e entre parceiros; bloqueio de autopromoção de perfil; perfil **diretoria (`viewer`)** sem contatos, fotos, exportação, alertas operacionais ou mutações; expiração de sessão da equipe (8h máxima / 30min inatividade); CPF completo nunca retornado em payloads, exports ou logs.

---

## 6. Validação em dispositivos físicos (Android e iPhone via HTTPS)

Emulação em desktop não substitui este aceite. Testar em aparelhos reais (Android + iPhone) sobre HTTPS:

- [ ] Instalação da PWA na tela inicial e abertura a frio (**cold launch**) sem internet.
- [ ] Modo offline do associado: exibição do cartão/QR, rede de parceiros, economia e histórico já sincronizado com aviso claro de data da última sincronização; todas as ações online desabilitadas e sem enfileiramento.
- [ ] Reconexão: atualização do snapshot, aviso de nova versão do Service Worker sem interromper câmera/pagamento e recarga limpa.
- [ ] Câmera ao vivo: captura facial no cadastro (inclusive em dispositivos sem WebGL) e leitura de QR no balcão do parceiro.
- [ ] Segurança local: logout e troca de conta limpam sessão e IndexedDB; dados de um associado nunca aparecem para outro ou para sessões de equipe no mesmo aparelho.

---

## 7. Operação, observabilidade, backup e rollback

- [ ] **Desempenho hospedado:** validar latência real das Edge Functions (cold start e warm), paginação e limites do plano Supabase (conexões, Realtime e Storage).
- [ ] **Monitoramento e alertas:** configurar acompanhamento de erros nas Edge Functions, falhas na `notification_outbox`, eventos pendentes em `webhook_events` e alertas de cobrança/risco no painel e em `OPERATIONS_EMAIL`.
- [ ] **Backup e restauração ensaiada:** configurar backups automáticos do banco PostgreSQL **e dos objetos do Storage (`member-photos`)** — backup do banco sozinho não restaura as fotos. Executar ao menos um ensaio completo de restauração em ambiente isolado com RPO/RTO e responsáveis definidos.
- [ ] **Higienização pré-abertura:** remover/estornar dados de teste da validação controlada sem apagar auditoria indevidamente; liberar `SMS_ALLOWED_NUMBERS=*` e `RESEND_ALLOWED_EMAILS=*` apenas no momento da abertura comercial.
- [ ] **Registro de liberação e rollback:** registrar data/hora, operador, hash/versão do deploy, lista de migrations aplicadas e evidências de aceite (sem nunca salvar chaves, tokens, senhas ou PII na documentação). Manter procedimento de reversão definido: rollback de frontend na Vercel + migrations corretivas novas no banco (voltar frontend não desfaz schema e registros financeiros nunca devem ser apagados).

---

## Publicação atual

- **Vercel:** usa `npm ci`, `node scripts/deploy/build.mjs`, saída `dist` e raiz do repositório. Por padrão o seletor executa `build:hosted` (homologação); o projeto comercial exige `RKMED_DEPLOY_ENV=production` no target `Production` para executar `build:prod`.
- **Supabase:** homologação (`chuyompxoctmpawhfmyb`) com 27 migrations aplicadas até 15/11/2026 (plus a migration local `20261122183000_legal_documents_br_v1.sql` pendente de revisão jurídica antes de produção), seis Edge Functions ativas, bucket privado `member-photos` e worker agendado via Vault.

Referências: [Supabase em produção](https://supabase.com/docs/guides/deployment/going-into-prod), [Backups no Supabase](https://supabase.com/docs/guides/platform/backups), [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live).
