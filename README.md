# RKMED Linha Gold

Aplicação React/Vite/TypeScript na raiz do repositório, com Supabase local e fluxos conectados ao Supabase local e integrações em sandbox. A interface original foi preservada. A demonstração usa dados fictícios isolados em `src/mocks/`; o modo sandbox usa módulos próprios, sem sucesso ou permissões simuladas.

## Começar

Requer Node.js 22+ e npm. Docker é necessário para o Supabase local.

```bash
npm ci
npm run dev
```

Demonstração: http://127.0.0.1:5173. [Credenciais e jornadas de demonstração](docs/demonstracao.md).

Para preparar o ambiente com Supabase local, copiar `.env.example` para `.env.local` na raiz e preencher somente a URL e a chave publicável/anon locais. O arquivo já existente nesta máquina foi preservado.

```bash
npm run db:start
npm run local:prepare
npm run dev:sandbox
# Outro terminal:
npm run functions:serve
```

Sandbox: http://127.0.0.1:5174. `db:status` também imprime segredos locais; não compartilhar sua saída. Nenhuma conta de nuvem/login é necessária para a base local. O sandbox usa Auth, RLS/RPC e Storage privados reais locais para cadastro, cartão, balcão, compras e gestão. Os provedores externos continuam sem credenciais/envios. Consulte o [roteiro de homologação](docs/homologacao.md) para acessos sintéticos, comandos, testes e pendências.

## Estrutura e documentação

- `src/app/`: inicialização, seleção de modo e sandbox.
- `src/features/` e `src/components/`: interface compartilhada e identidade visual.
- `src/mocks/`: fixtures, sessões falsas e operações da demonstração.
- `src/integrations/`: Supabase/Auth e contrato de Checkout pelo backend.
- `supabase/`: configuração, migrations, testes SQL e transportes de servidor preparados.
- `scripts/stripe/` e `tests/`: ferramentas de sandbox e verificações.
- [Homologação e ambiente funcional](docs/homologacao.md): iniciar, acessos sintéticos e testar fluxos reais locais.
- [Desenvolvimento e integrações](docs/desenvolvimento.md): modos, variáveis, contratos e limitações.
- [Guia de produção](docs/producao.md): etapas de implementação e lançamento.
- [Stripe em testes](docs/stripe-testes.md): catálogo Billing, Checkout e rascunhos Invoicing.
- `agents.md`: orientação canônica; `plan.md`: decisões e critérios de entrega.
- `docs/discovery.md` e `docs/legal-mocks/`: levantamento e documentos exclusivamente de teste.

`prototype/` é uma referência histórica, sem pacote ou frontend independente. Há um único pacote, lockfile e Vite na raiz. O DOCX original permanece inalterado.

## Verificação

```bash
npm run typecheck
npm test
npm run build
npm run build:sandbox
```

`npm run build` gera `dist/` para demonstração/PWA. `build:sandbox` gera `dist-sandbox/`, sem módulo de mocks nem registro da PWA demo. Não há deploy automático nestes comandos.

Com os servidores locais ativos e Brave instalado:

```bash
npm run test:e2e
npm run test:mobile
node tests/sandbox-ui.mjs
```

Os testes unitários de provedores usam transportes injetados. Os testes `test:connected:*` exercitam Auth, RPC, Storage e Edge Functions locais reais; não enviam mensagens nem cobram. O [guia de desenvolvimento](docs/desenvolvimento.md) explica portas, preview/offline e testes em celulares físicos ainda pendentes.

## Supabase local

| Serviço | Endereço |
| --- | --- |
| API/Auth/Storage | http://127.0.0.1:54321 |
| PostgreSQL | 127.0.0.1:54322; banco/usuário/senha locais: postgres |
| Studio | http://127.0.0.1:54323 |
| Caixa de e-mails de teste | http://127.0.0.1:54324 |

```bash
# Apaga e recria somente o banco LOCAL com migrations/seed sintéticos.
npm run db:reset
npm run db:lint
npm run db:test
npm run db:stop
```

Verificação em 21/10/2026: typecheck, 37 testes automatizados e 155 testes pgTAP passaram; as migrations passaram no lint SQL. A PWA compilada passou no reinício offline, bloqueio de ações, logout e isolamento entre contas. Relatórios/CSV e alertas operacionais em tempo real passaram em navegador móvel. Diretoria não exporta nem recebe alertas operacionais; sessões revogadas deixam de receber sinais. Consulte o [roteiro de homologação](docs/homologacao.md) para cobertura e pendências.

OTP local usa Mailpit e números sintéticos reservados, sem entrega Twilio. O seed cria identidades de teste e as migrations implementam domínio privado, RLS e autorização por RPC. Cadastro vincula os contatos na mesma identidade; login não cria usuários implicitamente.

Segredos de Stripe/Twilio/Resend/Supabase privilegiado pertencem ao backend, nunca a `VITE_*`. Os endpoints existem localmente e recusam execução sem configuração válida. Nenhuma mensagem real, pagamento, deploy ou projeto remoto foi executado.

Paginação de associados/compras e busca no servidor estão disponíveis em blocos de 25 registros, preservando totais e páginas já salvas offline. A [medição local](docs/desempenho.md) com 2.000 associados, 10.060 compras e 50 registros simultâneos ficou dentro das metas locais; resultados não comprovam SLA hospedado. Reproduzir com `npm run test:performance` e `npm run test:connected:pagination` conforme o roteiro.
