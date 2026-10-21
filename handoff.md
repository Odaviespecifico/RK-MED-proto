# RKMED — handoff para a próxima sessão

Atualizado em 21/10/2026. Workspace: `/home/davi/Documents/Progamação/RK MED`.

## Objetivo e limites

O usuário pediu para continuar o desenvolvimento até ter um sistema funcional em produção. O trabalho atual prepara o produto localmente para homologação; a instrução anterior de **não publicar em produção** continua vigente. Não houve deploy, provisionamento remoto, pagamento ou envio externo de mensagens.

Leia `agents.md` e `plan.md` antes de editar. `agents.md` é a orientação canônica; o arquivo `AGENTS.md` apenas aponta para ele. O DOCX de requisitos é a fonte original e não deve ser alterado.

Não pedir novamente decisões já confirmadas. Arquitetura: React/Vite, Supabase Auth, leituras/RPC com RLS e Edge Functions para integrações/ações privilegiadas. Nada de Next.js. Preservar a interface existente.

Credenciais de provedores foram adiadas pelo usuário: preparar estrutura local por enquanto. Não solicitar segredos no chat, imprimir arquivos de ambiente ou publicar suas saídas. Não habilitar produção apenas trocando uma variável: adaptadores atuais recusam ambiente/chaves live intencionalmente.

## Estado do repositório

- Há muitas alterações **não commitadas**, incluindo arquivos novos e exclusões em `prototype/`. Elas pertencem ao trabalho acumulado; não reverter nem limpar.
- Frontend promovido para `src/` e `public/`, pacote/lockfile únicos na raiz. `prototype/` é referência arquivada; as exclusões são esperadas.
- Demonstração isolada em `src/mocks/`. Sandbox usa dados e autorização reais do Supabase Docker local. Nunca substituir erro de integração por sucesso simulado.
- Nenhum subagente foi utilizado. Não delegar sem instrução explícita aplicável.
- O usuário retomou o desenvolvimento após a criação deste handoff. A validação de relatórios/CSV e a implementação de alertas operacionais em tempo real foram concluídas em 21/10; continuar pelas pendências abaixo.

## Funcionalidades existentes antes da última rodada

- Auth real local, perfis controlados pelo servidor e sessões da equipe com máximo de 8h/inatividade de 30min. Associado usa sessão persistida com refresh.
- Cadastro vincula e-mail e telefone na mesma identidade, valida maioridade/CPF e grava aceite versionado. Reenvio de OTP e fallback SMS adicionados à UI, entrega externa ainda não homologada.
- Fotos privadas: 600×600 JPEG, detecção de um rosto no backend com modelo local, reencodificação sem metadados. Não é identificação ou prova de vivacidade.
- QR estático opaco; balcão com código de funcionário por sessão, QR/CPF exato, confirmação de foto, cálculo no banco, recibo temporário e compra atômica/idempotente. Estorno vinculado e auditado.
- Administração: associados/bloqueios, parceiros, funcionários, criação de acessos somente pelo admin, cobrança com confirmação e fila de comunicações. Diretoria somente leitura e sem contatos/fotos/exportação.
- Stripe sandbox: Checkout, portal, cancelamento no fim do período, fatura existente para cobrança manual, webhook assinado/durável/deduplicado, conciliação por estado atual com leases. Retorno do Checkout não ativa benefício.
- Hooks de Auth assinados, intenções de canal de telefone no servidor, allowlists Twilio/Resend, outbox com leases/backoff/idempotência. Transportes desabilitados sem configuração.
- PWA com precache apenas de arquivos estáticos e snapshot explícito do associado em IndexedDB. Logout/troca de conta limpam dados.
- Offline corrigido para falha de transporte mesmo quando `navigator.onLine` permanece `true`. `PortalConnectionError` distingue status de transporte `0` de recusas HTTP; 401/403 não abrem cache como se fossem offline.
- Abertura offline pela URL inicial `/` também recupera `/app` quando há snapshot válido. Sem operações enfileiradas.
- Termos/privacidade públicos carregam documentos versionados de teste. Aviso de IA obrigatório permanece visível.

Regras financeiras: R$69,60/mês; taxa explícita por parceiro, centavos inteiros e meio centavo para cima; bloqueio/falha de pagamento prevalecem; cancelamento no fim do período pago. Compras nos parceiros não são receita Stripe nem split.

## Relatórios e exportação — implementação e validação local concluídas

Foi escolhida a lacuna RF-ADM/DG: totais completos calculados no servidor e CSV autorizado/auditado. Os alertas em tempo real foram implementados na etapa seguinte, descrita abaixo.

Arquivos novos:

| Arquivo | Conteúdo |
| --- | --- |
| `supabase/migrations/20261020150000_reports.sql` | Índice por data, validador privado de período, `rk_report` e `rk_export_purchases` |
| `src/lib/reports.ts` | Tipos, centavos exatos com BigInt, datas Recife e serialização CSV |
| `src/features/admin/ConnectedReports.tsx` | Formulário por período/parceiro, indicadores, confirmação e download |
| `supabase/tests/reports.test.sql` | 26 verificações de autorização, limites, reconciliação, precisão e auditoria |
| `tests/integrations/reports.test.mjs` | 2 casos de serialização, fórmulas, CPF, precisão e data |
| `tests/connected/reports.mjs` | Navegador móvel com diretoria/suporte e download real de CSV sintético |

Arquivos alterados nesta rodada:

- `src/integrations/portal.ts`: métodos `report` e `exportPurchases`.
- `src/features/admin/ConnectedAdmin.tsx`: aba de relatórios; não carrega listas inteiras nessa aba.
- `src/app/SandboxApp.tsx`: navegação para `/admin/relatorios`.
- `package.json`: script `test:connected:reports`.

Contrato implementado:

- Admin/suporte/diretoria podem consultar indicadores; apenas admin/suporte exportam. Autorização é verificada no banco, incluindo sessão expirada.
- Datas inclusivas de início/fim interpretadas em `America/Recife`, com limite de 366 dias.
- Período seleciona a **data da compra**. Estornos existentes no momento da consulta são excluídos dos valores válidos, mesmo que tenham ocorrido depois do período.
- Totais monetários retornam strings para não perder centavos acima de `Number.MAX_SAFE_INTEGER`.
- Exportação inclui registros estornados com sua situação. Limite de 5.000 registros: acima disso há erro explícito, nunca CSV truncado silenciosamente.
- Máximo de cinco exportações por ator por minuto, com lock e auditoria. Motivo da auditoria registra período/quantidade, não conteúdo pessoal.
- CPF já mascarado no servidor; sem telefone, e-mail, foto ou QR no CSV. O serializador ainda rejeita CPF não mascarado.
- CSV em UTF-8 com BOM, separador `;`, campos entre aspas, aspas internas duplicadas. Controles são substituídos por espaços; prefixos de fórmula, inclusive variantes Unicode, recebem rótulo literal `Texto: `.
- Referência consultada: [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection). Documentar a transformação de nomes; não prometer segurança universal para todo editor/reimportação.
- A exportação consulta novamente o banco; pode divergir de um indicador anterior se houve compra/estorno entre as consultas. A interface informa isso.

## Verificações concluídas em 21/10/2026

- `npm run db:test`: **92 verificações pgTAP aprovadas**, incluindo as 26 novas de relatórios. As quatro falhas anteriores foram resolvidas corrigindo a fixture histórica de datas de 2000 para 2020; o cálculo do banco não precisou ser alterado.
- `npm test`: **35 testes aprovados**, inclusive CSV/precisão e receptor HTTP de webhook. O sandbox restrito falha no receptor HTTP; a execução autorizada fora dele passou. Isso não foi falha funcional nem rejeição automática de segurança.
- `node tests/connected/reports.mjs`: **passou**, incluindo diretoria sem exportação na UI/API, download autorizado para suporte, ausência de CPF integral/contatos e viewport móvel sem overflow.
- `npm run typecheck`, `npm run build:sandbox` e `git diff --check`: **passaram**.
- `db:lint` da migration de relatórios já havia passado na rodada anterior.
- O botão geral “Atualizar” foi removido somente da aba de relatórios; a consulta explícita do formulário atualiza os dados.
- README, `plan.md`, `docs/producao.md` e `docs/homologacao.md` agora registram a implementação e os resultados confirmados. O roteiro de homologação tem instruções de uso, limites e referência de CSV.

O servidor 5174 já estava ativo. Uma segunda instância tentou iniciar em 5175 e foi encerrada; não presumir que processos sobreviveram à sessão. Nenhum provider externo foi acionado.

Baseline já verificado em sessões anteriores: jornadas de balcão, membro, cadastro/foto no runtime Edge real local, recusas de acesso, documentos públicos, offline/logout/isolamento e demonstração preservada. Esses fluxos não foram repetidos sem motivo nesta rodada e não substituem homologação em provedores ou dispositivos físicos.

## Alertas operacionais em tempo real — concluídos em 21/10/2026

Arquivos novos: `supabase/migrations/20261021160000_operational_alerts.sql`, `supabase/tests/operational.test.sql`, `src/integrations/operational.ts`, `src/features/admin/OperationalAlerts.tsx`, `tests/integrations/operational.test.mjs` e `tests/connected/operational.mjs`. Portal, painel interno, shell e scripts foram conectados à funcionalidade. A migration já foi aplicada somente no Docker local.

Mudanças na outbox privada, nas assinaturas e nos eventos duráveis incrementam `public.rk_operational_signal`. Apenas id/revisão/data são publicados em `supabase_realtime`; nenhuma tabela privada foi adicionada. A política SELECT usa helper privado somente leitura que verifica perfil servidor admin/support, sessão Auth válida, 8h máximo e 30min inativo. O navegador não pode escrever no sinal. Resumo autorizado contém contagens de pagamento pendente, falha/esgotamento de envio, sinais de risco e falha de evento.

O painel aparece para admin/suporte em todas as abas internas. Atualiza na recepção de sinal, reconexão e retorno à aba, agrupa rajadas e faz consulta alternativa a cada 30s enquanto visível. Essas leituras não prolongam a inatividade. Diretoria, associado, parceiro e anônimo não recebem sinais nem leem resumo. Erros removem contadores; nada disso entra no snapshot offline. Abrir a fila já aberta consulta novamente seus detalhes por ação explícita do operador. Envio aceito remove falha de entrega, mas não encerra sinal de risco: a contagem representa sinais registrados; encerramento estruturado de revisão não foi implementado e não há alteração automática da elegibilidade.

Verificações finais confirmadas:

- **36 testes automatizados** e **124 verificações pgTAP** aprovados.
- Lint SQL, typecheck frontend/Edge e build sandbox aprovados.
- WebSockets Realtime reais locais + navegador móvel: atualização sem refresh, payload mínimo, isolamento dos perfis, sessão revogada sem novos eventos, resumo recuperado após reload e abertura/atualização da fila aprovados.
- Regressão de relatórios/CSV conectados aprovada com o novo painel visível para suporte.
- Documentação e checklist atualizados; produção e provedores externos continuam fechados.

`npm run test:connected:operational` exige Docker/Supabase, frontend em 5174 e navegador Brave. Usa SQL exclusivamente no container local validado por `scripts/dev/local.mjs`, cria/remove uma ocorrência sintética e expira apenas a própria sessão de suporte criada para o teste; não envia mensagens. No ambiente do agente, navegador/loopback podem exigir execução fora do sandbox.

## Paginação e carga local — concluídas em 21/10/2026

Novos arquivos: migration `20261021180000_cursor_pagination.sql`, `supabase/tests/pagination.test.sql`, `src/lib/pagination.ts`, `src/lib/useCursorPage.ts`, `src/components/PageControls.tsx`, `MemberDirectory.tsx`, `PurchaseHistory.tsx` e `PurchaseTable.tsx`. Os painéis agora usam RPCs paginados e totais do servidor; busca/cobranças filtram no banco. A UI usa 25 registros (backend 1–100), cursores (data,id), anterior/próxima e reinício ao mudar filtro. Os endpoints antigos ficaram limitados a 100 e foram removidos do adapter do frontend.

Economia usa todos os registros válidos, inclusive para a linha do associado. O saldo completo é texto exato, separado das páginas. O snapshot mantém páginas baixadas antes, aceita formato anterior e pagina offline com aviso de histórico possivelmente incompleto. Não expira conteúdo novo. Houve extração da tabela compartilhada para evitar ciclo entre balcão e histórico e remount de painéis por identidade.

**37 testes automatizados**, **155 verificações pgTAP**, lint SQL, typecheck, sandbox build e navegador móvel aprovados. Teste novo cobre busca real, cursor sem duplicatas, filtro novo vencendo resposta atrasada, economia completa, 62 compras baixadas em páginas e reinício offline. Testes anteriores do balcão e do reinício offline/logout/troca de conta passaram novamente. A medição local não substitui homologação em celulares físicos.

Scripts `test:connected:pagination` (preview compilado 4174) e `test:performance` adicionados. `scripts/dev/scale-fixture.mjs` cria dados próprios só no Docker local e remove apenas a execução, sem reset. Limpeza usa bypass de triggers na própria conexão administrativa para apagar transações sintéticas; não aplicar isso em produção. Interrupção forçada pode deixar fixtures, então conferir antes de repetir. Sem keys/credenciais no artefato.

Benchmark confirmado: 2.000 associados, 10.060 compras, 200 páginas (concorrência 10), 50 commits distintos simultâneos em duas sessões. p95: páginas 117,15ms; lookup 127,82ms; cotação 90,58ms; commit 173,25ms. As fixtures foram removidas. Metodologia/limites em `docs/desempenho.md`; resultado em `docs/performance-local.json`.

## Próximos passos

1. Configurar e homologar os provedores sandbox autorizados e os agendamentos, conforme dependências externas. O usuário havia adiado credenciais; não pedir segredos no chat nem habilitar live.
2. Repetir carga/latência no ambiente hospedado e em rede móvel, incluindo cold starts; a carga Docker já foi exercitada e não comprova SLA remoto.
3. Preparar e exercitar backup/restauração de banco **e bytes dos objetos**, monitoramento e recuperação.
4. Homologar canal Realtime hospedado, dispositivos e conteúdo real; produção continua fechada.
5. Manter documentação alinhada. Alterações acumuladas continuam sem commit; preservar os arquivos existentes.

## Como iniciar/verificar localmente

```bash
npm run db:start
npm run local:prepare
npm run dev:sandbox
```

Em outro terminal, quando testar endpoints:

```bash
npm run functions:serve
```

URLs: frontend conectado `http://127.0.0.1:5174`, Supabase API `http://127.0.0.1:54321`, Studio `54323`, Mailpit `54324`. Preview PWA compilada em `4174`.

```bash
npm run typecheck
npm run db:lint
npm run db:test
npm test
npm run test:connected:reports
npm run test:connected:operational
npm run test:connected:pagination
npm run test:performance
```

`db:reset` destrói apenas o banco local e exige recarregar fotos via `local:prepare`; não é necessário para aplicar esta migration, já aplicada. Não executar reset/link/push/deploy remotos.

As contas sintéticas e a senha comum de desenvolvimento estão em `docs/homologacao.md`. Contas usadas nesta rodada: `diretoria@rkmed.test` e `suporte@rkmed.test`. Fixture de associado principal: `ana@rkmed.test`. Não copiar seed/OTP fixo/senha comum para produção.

Arquivos ignorados existentes: `.env.local`, `.env.stripe.local`, `supabase/functions/.env`. Não presumir que possuem credenciais externas. `scripts/dev/local.mjs` obtém status local sem imprimir segredos; `supabase status -o json` contém credenciais e não deve ser exibido.

## Pendências externas e de lançamento

- Configurar contas/chaves sandbox autorizadas, hooks Auth, webhook Stripe, portal, recuperação D+0/1/3 e agendamento do worker. Stripe MCP planner não estava disponível; fallback oficial de skills já foi instalado anteriormente.
- Homologar aquisição, renovação, falha, recuperação, cancelamento e entrega real de WhatsApp/SMS/e-mail.
- Aprovar textos legais reais e políticas de operação/privacidade. Os mocks têm aviso obrigatório e não equivalem a consentimento de produção.
- Validar câmera, instalação, atualização e offline em Android/iPhone físicos via HTTPS.
- Preparar e testar configuração de produção, backup/restauração, alertas, rollback e monitoramento antes de qualquer publicação.

Não apresentar o sistema como “100% funcional em produção” com essas pendências abertas.
