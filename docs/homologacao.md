> **OTP atual:** códigos de SMS/e-mail são gerados e validados pela RKMED. SMS Dev é somente transporte. Configuração e limites: [integração SMS Dev](smsdev-otp.md). A configuração de SMS nativo mencionada abaixo foi substituída por D29.

# Decisão vigente: OTP de telefone por SMS

A decisão atual substitui WhatsApp por SMS. Login oferece SMS ou e-mail; primeiro cadastro verifica ambos. O envio usa o provedor nativo configurado no Supabase Auth, com `SMS_MODE=supabase-native` e `SMS_ALLOWED_TEST_NUMBERS` no gateway. Desativar o hook Send SMS legado antes de habilitar o provedor nativo. Credenciais e entrega externa ainda precisam de configuração/aceite; referências a WhatsApp abaixo são históricas.

# RKMED — ambiente funcional de testes

**Decisão atual — 04/11/2026:** a API oficial do WhatsApp da Meta substitui o Twilio (D26 em [plan.md](../plan.md)). A migração do código de entrega ainda está pendente; referências ao transporte Twilio abaixo descrevem o legado e não devem ser usadas para configurar novos envios. A alternativa por SMS foi removida por decisão do usuário em 04/11/2026; códigos de telefone serão entregues apenas pelo WhatsApp. Supabase Auth e Resend permanecem.

O fluxo prioritário usa Supabase Auth, PostgreSQL e Storage locais reais: funcionário → cartão/CPF → foto privada → desconto calculado no banco → compra → histórico → estorno. As contas abaixo são sintéticas; o status pago da Ana é uma fixture SQL, não um pagamento Stripe.

Nenhuma produção foi publicada e nenhum pagamento ou mensagem externa foi executado. Homologação completa com provedores e celulares físicos continua pendente. Textos legais são exclusivamente de teste.

## Iniciar do zero

Com Node 22+ e Docker disponíveis, na raiz:

```bash
npm ci
npm run db:start
npm run local:prepare
npm run dev:sandbox
```

Em outro terminal:

```bash
npm run functions:serve
```

Abrir http://127.0.0.1:5174. Studio: http://127.0.0.1:54323. Caixa de e-mail local: http://127.0.0.1:54324. As Edge Functions escutam em `http://127.0.0.1:54321/functions/v1/`.

`local:prepare` confere o destino loopback, grava somente configuração pública em `.env.test`, preserva outras opções e carrega fotos sintéticas no bucket privado. Não imprime a chave administrativa. `functions:serve` usa `.env.test`, ignorado pelo Git; as chaves internas do Supabase são fornecidas pelo runtime local. Não adicionar nenhum segredo a `VITE_*`.

Para recriar **somente** o banco Docker local, apagando dados sintéticos:

```bash
npm run db:reset
npm run local:prepare
```

Após mudanças em `config.toml`, reiniciar os serviços locais afetados; não usar `db push`, link ou deploy remoto para este roteiro. Para recarregar configurações do Auth, parar/iniciar a stack local sem `--no-backup`.

## Acessos sintéticos

Em `/acesso-parceiro` ou `/acesso-admin`, senha local comum: `RKMED-local-test-2026!`.

| E-mail | Perfil / finalidade |
| --- | --- |
| `parceiro@rkmed.test` | Laboratório Vida; funcionário Marina, código `2468` |
| `outro-parceiro@rkmed.test` | Academia Movimento; funcionário Pedro, código `1357` |
| `admin@rkmed.test` | Administração e criação de acessos |
| `suporte@rkmed.test` | Operação, bloqueios, estornos e cobranças; sem criação de acessos |
| `diretoria@rkmed.test` | Somente leitura; CPF mascarado, sem contatos, fotos, exportação ou alterações |
| `ana@rkmed.test` | Associada elegível por fixture local; CPF sintético `12345678909` para busca no balcão |
| `carlos@rkmed.test` | Associado bloqueado e com pagamento pendente |
| `novo@rkmed.test` | Identidade inicial para teste de cadastro; o teste automatizado pode já tê-la concluído |

A tela de associado `/entrar` continua oferecendo exatamente WhatsApp e e-mail por OTP; a senha dos associados acima serve exclusivamente ao harness de fixtures locais. Os números NANP reservados em `auth.sms.test_otp` usam `482913` somente no Docker local, sem Twilio. Nunca copiar OTP fixo, seed ou senha comum para um projeto compartilhado. Esses números não pertencem ao fluxo brasileiro de aquisição; o teste automatizado usa a API local para a ligação do contato.

## Roteiro do balcão

1. Entrar como parceiro e iniciar atendimento com `2468`.
2. Abrir a câmera para ler o QR do associado, colar seu identificador opaco ou escolher busca por CPF exato.
3. Conferir nome, CPF mascarado, foto e situação atual. Sem foto carregada e confirmação visual, a interface não permite registrar.
4. Informar R$ 200,00, revisar o cálculo do servidor: 20% = R$ 40,00; final R$ 160,00.
5. Confirmar. Reenvios com a mesma operação retornam a mesma compra; o recibo não serve para outra compra.
6. Conferir histórico e economia na conta do associado. O outro parceiro não vê essa compra.
7. Entrar como suporte/admin para estornar com motivo. O original e a auditoria ficam preservados.
8. Bloquear o associado e repetir a consulta: benefício indisponível. Bloquear entre validação e confirmação também impede o registro.

Sessões da equipe têm limite servidor de 8h e inatividade de 30min. O código do funcionário vale por sessão e estabelecimento; “Trocar funcionário” encerra o vínculo. Membros usam sessões Supabase persistentes e refresh rotativo.

## Cadastro e pagamento

O cadastro confirma primeiro o e-mail e depois o celular na mesma identidade Auth. O banco impede conclusão sem os dois contatos verificados, maioridade, CPF válido/único e aceite das três versões disponíveis. Dados de CPF e nascimento não são salvos em rascunhos do navegador.

A foto é recortada em 600×600 no navegador e novamente decodificada, validada pelo modelo local de detecção de rosto e reencodificada em JPEG sem metadados no servidor. Falha ou HEIC sem suporte exige nova imagem. O bucket é privado; URLs de leitura duram 60s. A detecção não comprova identidade ou vivacidade.

O cadastro fica `incomplete` até confirmação do provedor. Para habilitar Stripe, preencher no arquivo **ignorado** `.env.test`:

- `APP_ENV=local`, `APP_ORIGIN=http://127.0.0.1:5174`.
- `STRIPE_SECRET_KEY`: preferir chave restrita de teste com permissões necessárias.
- `STRIPE_TEST_ACCOUNT_ID`, `STRIPE_PRICE_ID`: conta sandbox esperada e preço mensal BRL 6960.
- `STRIPE_WEBHOOK_SECRET`: segredo do encaminhamento/endpoint de testes.
- `STRIPE_PORTAL_CONFIGURATION_ID`: plano fixo, sem troca de assinatura; cancelamento permitido somente no fim do período.

As ferramentas [Stripe de teste](stripe-testes.md) usam o mesmo `.env.test` da raiz que `functions:serve`. O receptor independente pode usar `STRIPE_CLI_WEBHOOK_SECRET` quando seu listener tiver segredo diferente do webhook das Edge Functions.

Encaminhar eventos Stripe **à Edge Function**, não ao receptor independente de demonstração:

```bash
npx --no-install stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

Assinar `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.dispute.created`, `charge.refunded` e `radar.early_fraud_warning.created`. Configurar no Billing do sandbox a recuperação D+0, D+1 e D+3; não adicionar um segundo agendador de cobranças. Essa configuração ainda precisa de aceitação na conta real de testes.

O webhook verifica o corpo bruto e a assinatura, registra IDs mínimos duráveis e deduplica eventos. A sincronização adquire uma reserva no banco **antes** de ler a assinatura/fatura atuais da Stripe; um `invoice.paid` atrasado não reativa uma dívida mais recente. Retorno do Checkout nunca ativa benefício. Falha de pagamento e bloqueio administrativo prevalecem sobre cancelamento agendado.

Cobrança manual exige confirmação de associado, fatura, ação e valor. Retentativa usa a fatura existente e chave idempotente; enviar link apenas coloca a comunicação na fila. Ação concluída/fila aceita não significa pagamento confirmado nem e-mail entregue. Sinais de risco geram revisão operacional; estorno de desconto não estorna Stripe.

Stripe Tax não foi habilitado. Antes de produção, validar a configuração fiscal e eventuais registros com os responsáveis; não supor que ativar `automatic_tax` seja suficiente.

## Twilio, Resend e jobs

Os transportes ficam desabilitados por padrão. Para testar envio externo, usar somente destinatários de teste autorizados e preencher `.env.test`:

- Twilio: `TWILIO_MODE=whatsapp-sandbox`, SID/token, remetente oficial `whatsapp:+14155238886`, `TWILIO_ALLOWED_TEST_NUMBERS`. Cada número precisa aderir ao WhatsApp Sandbox. Credenciais de teste da API Twilio não equivalem ao WhatsApp Sandbox; envios podem ter custo.
- Resend: `RESEND_MODE=transactional-sandbox`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_ALLOWED_TEST_EMAILS` e `OPERATIONS_TEST_EMAIL`. O remetente precisa estar autorizado no provedor.
- Auth: configurar os hooks HTTP Send SMS → `auth-sms` e Send Email → `auth-email`, com os respectivos segredos `AUTH_SMS_HOOK_SECRET`/`AUTH_EMAIL_HOOK_SECRET`. A configuração padrão local mantém Mailpit e OTPs sintéticos, sem hooks externos. Nunca habilitar hooks com segredos vazios.
- Jobs: `JOBS_SECRET`, aleatório com pelo menos 32 caracteres, mantido exclusivamente no backend. Agendar POST em `provider-jobs` com esse bearer, por exemplo a cada cinco minutos no sandbox. Nenhum cron remoto foi criado.

Com `VITE_APP_ENV=sandbox`, telefone passa por `phone-code`: valida origem, allowlist e limite por número, registra o canal no servidor e pede ao Supabase para emitir o desafio. O hook assinado consome uma única intenção; não confia em metadados do usuário. SMS é recusado pelo gateway e pelo banco. O reenvio mantém o WhatsApp e respeita os limites do Auth. O envio pode falhar; a interface não libera cadastro por entrega simulada.

`provider-jobs` reprocessa eventos pendentes, reconcilia clientes e envia a outbox com reserva por trabalhador, chave idempotente no Resend e backoff limitado. A fila interna mostra pendências e alertas. Aceitação pela API de mensagens ainda não comprova entrega; testar entrega e falha real nos provedores antes de concluir homologação.

## PWA e verificações

Para testar a versão instalável em computador:

```bash
npm run build:sandbox
npm run preview -- --port 4174 --outDir dist-sandbox
```

Em homologação de pagamentos nessa porta, ajustar também `APP_ORIGIN`; o teste offline com fixtures não envia comandos externos. O worker salva somente arquivos estáticos. O snapshot explícito do próprio associado usa IndexedDB com isolamento de conta, CPF já mascarado, QR estático, foto própria e histórico/benefícios aprovados. Ações online ficam desabilitadas offline e não são enfileiradas. Situação salva não autoriza benefício; o parceiro sempre verifica online. Logout e troca de conta removem o snapshot anterior. O navegador pode apagar esse armazenamento; um aparelho desbloqueado não protege dados de quem o controla.

```bash
npm run typecheck
npm test
npm run db:lint
npm run db:test
npm run test:connected:api
npm run test:connected:edge
npm run test:connected:enrollment
npm run test:connected:ui
npm run test:connected:offline
npm run test:connected:reports
npm run test:connected:operational
npm run test:connected:pagination
```

Os testes `connected` exigem Docker/stack local e fotos preparadas. UI usa 5174; offline e paginação usam o build servido em 4174; Edge/enrollment exigem `functions:serve`. O teste de cadastro altera somente sua fixture e não cobra nem envia mensagem real. Testes de Stripe/Twilio/Resend com transportes injetados não substituem aceitação nos provedores.

## Evidências locais — 20/10/2026

- Typecheck de frontend/Edge Functions e builds demo/sandbox aprovados.
- 33 testes automatizados e 66 verificações pgTAP aprovados; lint SQL sem erros.
- Navegador móvel: documentos versionados, balcão com foto/cálculo/compra, perfil de consulta sem alterações e cartão do associado aprovados.
- Cadastro sintético na mesma identidade, aceite e foto processada pela Edge Function aprovados; sem Stripe configurada, a assinatura permanece incompleta.
- Endpoints recusam chamadas sem usuário, perfil de consulta em ações privilegiadas e webhook sem configuração válida.
- PWA compilada: snapshot sem CPF integral, reinício offline, ações desabilitadas, limpeza no logout e isolamento entre associados aprovados. Falha de transporte pode abrir a cópia salva; respostas de permissão negada não são tratadas como offline.

Reenvio de OTP pelo mesmo canal está disponível no cadastro com espera de 60 segundos; SMS foi removido. A entrega externa ainda precisa ser homologada; os testes locais não comprovam chegada da mensagem.

## Relatórios e CSV — verificados em 21/10/2026

1. Entrar como suporte ou administração e abrir **Relatórios**.
2. Informar início/fim (até 366 dias) e, opcionalmente, um parceiro. A lista inclui parceiros inativos para consultas históricas.
3. Acionar **Consultar relatório**. O banco retorna contagens e valores completos do período, sem depender das linhas carregadas nas outras telas.
4. Conferir compras válidas/estornadas, valor bruto, economia e final. O período usa a data da compra em Recife; estornos existentes na consulta reduzem os totais, mesmo que feitos depois do período. Valores são compras nos parceiros, não receita de assinaturas.
5. Acionar **Exportar CSV**, revisar período e confirmar. O servidor consulta novamente; mudanças desde o relatório podem alterar o arquivo. A exportação inclui registros estornados e sua situação.

A diretoria pode consultar indicadores, mas não exportar; a recusa também é aplicada na chamada direta à API. CSV contém nomes, funcionário, CPF mascarado e valores, sem contatos, QR ou foto. Cada exportação é auditada e há limite de cinco por ator por minuto. Mais de 5.000 registros gera erro explícito: reduzir o período ou filtrar parceiro; nenhum arquivo parcial é apresentado como completo.

Centavos são transportados como texto e formatados com BigInt para preservar precisão. CSV usa UTF-8 com BOM e `;`. Nomes com prefixo que poderia ser interpretado como fórmula recebem `Texto: `; controles são convertidos em espaços e aspas escapadas. Essa transformação é intencional para leitura humana em planilhas e não deve ser usada como identificador do cadastro. Referência: [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection).

Verificação de 21/10: **35 testes automatizados**, **92 verificações pgTAP**, typecheck e build sandbox aprovados. O teste conectado de relatórios passou com viewport móvel, diretoria sem exportação na UI/API e download autorizado sem CPF integral/contatos. O lint SQL da migration já havia passado na rodada anterior. A correção de datas da fixture foi revalidada; a suíte SQL agora está aprovada.

## Alertas operacionais em tempo real — 21/10/2026

Administração e suporte veem **Alertas operacionais** em todas as abas internas. O painel mostra pagamentos pendentes, falhas de envio, tentativas esgotadas, sinais de risco e falhas no processamento de eventos. As categorias podem se sobrepor; não somar os contadores como total de ocorrências distintas.

Mudanças nas assinaturas, na outbox e nos eventos duráveis atualizam uma linha de sinalização com apenas `id`, revisão e data. Somente essa linha entra na publicação Realtime; tabelas privadas, contatos, CPF, fotos e corpos de webhooks não são transmitidos. Ao receber o sinal, a interface consulta o resumo autorizado no banco. Diretoria, associado, parceiro e anônimo não têm acesso ao sinal ou ao resumo.

O acesso verifica perfil ativo, sessão Auth válida, máximo de 8h e inatividade de 30min. Consultas automáticas de alertas **não** renovam a atividade da equipe. Expiração/revogação impede novas leituras e eventos; a interface limpa contadores se a consulta falhar. O teste local confirmou revogação durante uma assinatura WebSocket já aberta.

Na conexão inicial, reconexão e retorno à aba, o resumo é consultado novamente. Se o canal cair, o painel informa a interrupção e consulta a cada 30s enquanto a página está visível; também existe **Verificar alertas**. Sem conexão, os controles ficam desabilitados. Nenhum alerta é salvo no snapshot offline ou enfileirado pelo navegador.

**Abrir cobranças e fila** leva ao painel operacional; se ele já estiver aberto, consulta os detalhes novamente. Aceitação de envio remove a falha de entrega, mas não encerra sinal de risco. O contador de risco representa os sinais registrados; não há decisão automática, liberação de benefícios ou encerramento estruturado de revisão nesta etapa. Falhas de processamento deixam de contar quando o evento fica processado.

A migração `20261021160000_operational_alerts.sql` já foi aplicada somente no Docker local. Em homologação hospedada, aplicar a migration e validar a publicação `supabase_realtime`, WebSocket, políticas e limites do ambiente antes de considerar o canal homologado. Não publicar tabelas privadas. Referência: [Supabase Postgres Changes e RLS](https://supabase.com/docs/guides/realtime/postgres-changes).

Verificações: **36 testes automatizados**, **124 verificações pgTAP**, lint SQL, typecheck e build sandbox aprovados. O teste `test:connected:operational` usa WebSockets e navegador reais contra Docker, cria/remove apenas uma ocorrência sintética, verifica atualização sem refresh, dados mínimos, isolamento de perfis, recuperação por nova abertura e revogação de sessão. Nenhuma mensagem externa, pagamento ou deploy foi executado.

## Paginação e carga local — 21/10/2026

Associados, cobranças por associado, compras internas, balcão e histórico do associado carregam 25 registros por página com **Página anterior** / **Próxima página**. A busca por nome tem botão explícito e é executada no banco. Filtros/atualização reiniciam a navegação; respostas de buscas antigas não substituem a atual. Economia vem do banco e não é somada apenas da página visível.

O histórico offline preserva páginas consultadas antes, sem expiração nova. O saldo completo é salvo separadamente; a interface avisa que os registros disponíveis offline podem estar incompletos ou desatualizados. O teste móvel consultou 62 compras em três páginas e reabriu o histórico offline; CPF integral não foi persistido. Logout e troca de conta mantêm a limpeza do cache.

A migração `20261021180000_cursor_pagination.sql` foi aplicada apenas localmente. SQL verificou limites, busca literal, isolamento, empates de data, inserções durante navegação e totais exatos com estorno. O frontend conectado não usa os antigos endpoints de listas completas; sua compatibilidade ficou limitada a 100 registros.

Validação: **37 testes automatizados** e **155 verificações pgTAP**, lint SQL, typecheck, build sandbox, balcão e teste móvel de paginação aprovados. A [medição reproduzível](desempenho.md) executou 200 consultas paginadas e 50 compras distintas concorrentes com 2.000 associados/10.060 compras de fixture: p95 de páginas 117,15 ms, consulta 127,82 ms e commit 173,25 ms. Fixtures geradas foram removidas. Não houve reset do seed, cobrança externa ou mensagem real. Validar latência/rede/carga no ambiente hospedado continua pendente.

## Pendências para homologação completa

SMS removido em 04/11/2026 (D26): cadastro/login e reenvios oferecem somente WhatsApp ou e-mail, e códigos de telefone ficam no WhatsApp. Pedidos pelo canal `sms` são recusados pelo adaptador, gateway e banco; o transporte SMS e sua variável de remetente foram removidos. Os nomes `auth-sms`, `AUTH_SMS_HOOK_SECRET`, `sms.otp`, `auth.sms` e `verifyOtp(type: 'sms')` pertencem ao protocolo de OTP de telefone do Supabase e não representam uma alternativa de entrega por SMS. A migration `20261104190000_whatsapp_only_delivery.sql` foi aplicada somente localmente. Verificados: 39 testes Node, 158 verificações SQL, lint SQL, typecheck, builds demo/sandbox, jornada de navegador com reenvio pelos canais existentes e recusa HTTP direta de SMS pela Edge Function. Nenhuma mensagem externa ou publicação foi executada; a migração de WhatsApp para Meta permanece pendente.

Correção de câmera/foto em 04/11/2026: o erro `activeTexture` foi reproduzido com contextos WebGL indisponíveis e corrigido com processamento alternativo por CPU. Os arquivos WASM do MediaPipe são agora vinculados à versão instalada. Foto, quadro de vídeo e rejeição de imagem sem rosto foram verificados com e sem WebGL; captura completa também passou na versão compilada. Câmera simulada não substitui o aceite em aparelhos físicos. Para repetir no servidor de desenvolvimento em 5173:

```bash
node tests/face-browser.mjs
RKMED_NO_WEBGL=1 node tests/face-browser.mjs
RKMED_NO_WEBGL=1 node tests/live-camera.mjs
```

Para a jornada compilada, executar `npm run build`, servir `dist` com preview em 4173 e usar `RKMED_TEST_URL=http://127.0.0.1:4173 node tests/live-camera.mjs`, também com `RKMED_NO_WEBGL=1`. O teste direto `face-browser.mjs` importa o módulo de desenvolvimento e não deve ser apontado ao preview.

- [ ] Inserir credenciais autorizadas e configurar hooks, webhook, portal, recuperação D+0/1/3 e agendamento no sandbox.
- [ ] Rodar aquisição, falha, recuperação, cancelamento, disputa/reembolso e comunicação real nas contas de teste; verificar permissões da chave restrita.
- [ ] Medir limites e tempo de execução das funções no sandbox hospedado; a validação realizada aqui usa runtime Docker local.
- [ ] Aprovar conteúdo/legal reais, suporte e políticas de retenção antes de produção.
- [ ] Testar instalação, câmera, atualização, reinício offline e limpeza de sessão em Android/iPhone físicos via HTTPS.
- [ ] Validar alertas em tempo real no sandbox hospedado e completar desempenho/carga, backup de banco **e objetos**, restauração, monitoramento e recuperação.

Referências de implementação: [Supabase Auth hooks](https://supabase.com/docs/guides/auth/auth-hooks), [arquivos estáticos em funções](https://supabase.com/docs/guides/local-development/cli/config#functions.function_name.static_files), [Resend envio](https://resend.com/docs/api-reference/emails/send-email), [idempotência Resend](https://resend.com/docs/dashboard/emails/idempotency-keys), [Stripe assinaturas/webhooks](https://docs.stripe.com/billing/subscriptions/webhooks).
