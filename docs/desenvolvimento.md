# Desenvolvimento RKMED

React/Vite/TypeScript, Supabase PostgreSQL/Auth/Storage e Edge Functions. O site https://rk-med-proto.vercel.app usa o Supabase hospedado de homologação. [Prontidão e pendências](prontidao-producao.md).

## Rodar com banco real local

Requer Node 22+, npm e Docker. Na raiz:

```bash
npm ci
npm run db:start
npm run local:prepare
npm run dev:sandbox
# Outro terminal:
npm run functions:serve
```

A aplicação conectada abre em http://127.0.0.1:5174. `npm run dev` também usa o modo conectado, normalmente em 5173; ajustar `APP_ORIGIN` local se usar OTP ou comandos Edge nessa origem. Studio: 54323; Mailpit: 54324. Consultar as contas sintéticas no registro de [homologação](homologacao.md). Nunca copiar seeds/senhas/OTP fixos para o projeto hospedado.

`db:reset` apaga exclusivamente o banco Docker local. Não usar reset contra homologação/produção. Os testes `connected` verificam a origem local antes de acessar credenciais privilegiadas.

## Build e demonstração

| Comando | Resultado |
| --- | --- |
| `dev` / `build` | Frontend conectado, Supabase de `.env.test`; build em `dist` |
| `dev:sandbox` / `build:sandbox` | Conectado em 5174 / artefato em `dist-sandbox` |
| `build:hosted` | Conectado a Supabase remoto HTTPS; saída `dist`; comando da Vercel |
| `dev:demo` / `build:demo` | Demonstração isolada; build em `dist-demo` |
| `build:prod` | Reservado; produção comercial ainda recusada pelo runtime |

A demonstração usa `src/mocks`. O build conectado elimina seu módulo e não consulta suas sessões, não retorna fixtures e não simula pagamento ou envio bem-sucedido. Testes `flows.mjs`/`mobile-layout.mjs` antigos usam `dev:demo` em 5173. Testes `connected/ui.mjs` e `sandbox-ui.mjs` usam 5174. Offline conectado usa preview em 4174.

## Ambientes e publicação

Somente `.env.test` e `.env.prod`, privados/ignorados. `env:init` cria templates sem sobrescrever arquivos existentes. Vite lê um arquivo explícito e expõe somente `VITE_*`; variáveis do processo prevalecem. Ver [ambientes](ambientes.md).

Na Vercel, configurar `VITE_APP_MODE=sandbox`, `VITE_APP_ENV=sandbox`, URL/chave publicável/referência do projeto de testes. O build hospedado força sandbox e recusa URL local/projeto divergente. A referência confere o destino; não comprova isolamento administrativo da conta. Segredos ficam exclusivamente nas Edge Functions. Não há dependência de `.env.test` versionado para compilar na nuvem.

As funções são empacotadas com `scripts/dev/package-functions.mjs`, preservando o nome `rkmed-stripe-webhook` para não substituir o webhook legado. Sem origem explícita, o pacote lê as variáveis de servidor normalmente; com origem HTTPS, fixa apenas o roteamento público da homologação. Não usar esse pacote de sandbox em produção.

## Cadastro e provedores

[ClickSend e OTP](clicksend-otp.md) descreve o contrato atual. A RKMED emite/verifica os dois códigos. Supabase só mantém identidade/sessão; não há OTP nativo, WhatsApp ou PIN no fluxo atual. Cadastro exige e-mail e celular na mesma identidade, dados/aceites, foto privada validada e Checkout. O retorno do Checkout nunca ativa benefício.

Por solicitação do usuário em 09/11, homologação aceita qualquer e-mail e celular brasileiro: as duas listas usam `*` explícito. Defaults vazios continuam bloqueando envio. Limites, consumo único e validação dos contatos continuam ativos. Usar e-mail distinto de contas internas para cadastrar associado; perfis não são convertidos automaticamente.

Stripe continua somente em teste. Worker concilia e processa a outbox a cada cinco minutos no hospedado, com bearer no Vault. Não criar outro agendador para repetir cobranças: recuperação D+0/D+1/D+3 pertence ao Stripe Billing. Stripe Tax permanece desabilitado.

## Verificações

```bash
npm run typecheck
npm test
npm run db:lint
npm run db:test
npm run test:connected:api
npm run test:connected:enrollment
npm run test:connected:ui
npm run build:sandbox
npm run preview -- --port 4174 --outDir dist-sandbox
# Outro terminal:
npm run test:connected:offline
node tests/pwa-update.mjs
```

`tests/hosted/smoke.mjs` exige `RKMED_HOSTED_KEY` publicável; consulta apenas homologação e não envia OTP nem cria pagamentos. Os testes conectados usam fixtures locais. Com provedores configurados, o teste de cadastro pode criar uma sessão Checkout de teste; não efetua pagamento. Não tratar transporte injetado, câmera emulada ou teste local como aceite em aparelho/provedor real.
