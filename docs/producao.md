> **OTP atual:** códigos de SMS/e-mail são gerados e validados pela RKMED. SMS Dev é somente transporte. Configuração e limites: [integração SMS Dev](smsdev-otp.md). A configuração de SMS nativo mencionada abaixo foi substituída por D29.

# Decisão vigente: OTP de telefone por SMS

A decisão atual substitui WhatsApp por SMS. Login oferece SMS ou e-mail; primeiro cadastro verifica ambos. O envio usa o provedor nativo configurado no Supabase Auth, com `SMS_MODE=supabase-native` e `SMS_ALLOWED_TEST_NUMBERS` no gateway. Desativar o hook Send SMS legado antes de habilitar o provedor nativo. Credenciais e entrega externa ainda precisam de configuração/aceite; referências a WhatsApp abaixo são históricas.

# RKMED — passo a passo para entrar em produção

**Decisão atual — 04/11/2026:** a API oficial do WhatsApp da Meta substitui o Twilio (D26 em [plan.md](../plan.md)). A migração do código de entrega ainda está pendente; referências ao transporte Twilio abaixo descrevem o legado e não devem ser usadas para configurar novos envios. A alternativa por SMS foi removida por decisão do usuário em 04/11/2026; códigos de telefone serão entregues apenas pelo WhatsApp. Supabase Auth e Resend permanecem.

Este guia cobre a contratação e o pagamento dos serviços, a preparação técnica, a cobrança da assinatura e a entrega ao cliente final. Destina-se ao responsável pela RKMED, à equipe de desenvolvimento e à operação.

**Situação atual:** frontend principal conectado ao Supabase local para cadastro, RLS/RPC, foto privada, cartão, balcão, compras, estorno e gestão. Edge Functions de sandbox preparadas para cobrança, hooks e notificações; credenciais e aceitação externa ainda pendentes. Veja [homologação](homologacao.md). Nenhuma produção foi publicada. A demonstração permanece isolada; fixtures pagas não representam cobrança Stripe real.

As regras confirmadas estão em [agents.md](../agents.md) e [plan.md](../plan.md). Este guia não aprova decisões de negócio que continuam abertas. Nenhum serviço foi contratado, nenhuma cobrança foi feita e nenhum deploy foi executado para elaborar esta documentação.

## 1. Definir responsáveis e fechar as decisões de lançamento

1. Nomear o responsável da RKMED pelas contas, pagamentos dos fornecedores, recebimentos e aprovação do lançamento.
2. Nomear o responsável técnico por implementação, publicação, monitoramento e recuperação de falhas.
3. Nomear os responsáveis por suporte, cobrança e cadastro/treinamento dos parceiros.
4. Conferir no `plan.md` as decisões confirmadas/delegadas em 19/10 e registrar as aprovações de lançamento:
   - Cancelamento, acesso até o fim do período pago e precedência dos bloqueios (D09).
   - Processamento de fotos, HEIC e alternativa quando houver falha (D12).
   - Limites de sessão dos funcionários e permissões exatas do suporte/diretoria (D14 e arquitetura).
   - Forma de aceite contratual e documentos finais aprovados (D16/D21).
   - Quais mensagens serão enviadas, a quem e por qual canal (D17).
   - Precedência dos descontos, arredondamento e limites de valores (D18 e regras financeiras).
   - Acesso ao backend, dados de rascunho/cache e proteção de dispositivos compartilhados (D19/D20 e contrato offline).
   - Orçamento dos serviços e celulares/navegadores suportados (D22/D23).
5. Aprovar os textos reais de termos, privacidade, foto, cancelamento e atendimento com os responsáveis competentes. Versionar o aceite e definir retenção, exclusão e resposta a incidentes. Os textos em `docs/legal-mocks/` servem apenas para testes; produção deve rejeitar essas versões.

**Concluído quando:** cada decisão necessária ao lançamento tem resposta, responsável e registro. Uma proposta no plano não equivale a uma regra aprovada.

## 2. Contratar e pagar os serviços necessários

Criar as contas sob controle da RKMED, com e-mail institucional e recuperação de acesso documentada. Conceder acesso individual à equipe. Guardar credenciais em um gerenciador de senhas e segredos nos provedores, sem incluí-los no repositório ou em mensagens.

| Serviço | Ação do responsável | Como entra no orçamento | Resultado esperado |
| --- | --- | --- | --- |
| Domínio e DNS | Registrar/renovar o domínio e garantir acesso ao DNS | Registro e renovação do domínio | Domínio controlado pela RKMED |
| Hospedagem do frontend | Confirmar o provedor; Vercel é a opção preparada no projeto | Plano compatível com uso comercial, limites e excedentes | Conta pronta para homologação e produção |
| Supabase | Criar projetos separados e escolher capacidade, backups e suporte adequados | Plano, computação, armazenamento, tráfego e recuperação contratada | Backend de homologação e backend de produção separados |
| Stripe | Ativar a conta comercial e cadastrar a conta bancária de recebimento | Tarifas de processamento e recursos de cobrança contratados | Conta habilitada a cobrar e receber |
| Meta / WhatsApp oficial | Preparar a conta e o número da RKMED para a integração direta escolhida em D26 | Conferir condições comerciais e limites vigentes da conta | Integração implementada e entrega real de OTP aprovada |
| Resend | Verificar o domínio e contratar capacidade suficiente | Plano e volume de e-mails | Envio real de verificação e mensagens transacionais |
| Backup e monitoramento | Definir ferramentas, destino das cópias e alertas | Armazenamento, retenção e serviços escolhidos | Recuperação e detecção de falhas operacionais |

Não há orçamento mensal fechado aprovado. Antes de contratar, registrar o valor atual de cada fornecedor, moeda, tributos aplicáveis, franquia, excedentes, data de renovação e responsável. Configurar alertas de consumo/saldo. Valores devem ser conferidos nas condições comerciais vigentes da conta, sem reutilizar os totais contraditórios do levantamento original.

Separar três fluxos financeiros:

- **Operação → fornecedores:** a RKMED paga hospedagem, infraestrutura e mensagens.
- **Associado → RKMED via Stripe:** assinatura mensal de **R$ 69,60**.
- **Associado → estabelecimento:** pagamento da compra com desconto diretamente ao parceiro. O sistema registra o desconto; não faz split nem repasse dessa compra.

**Concluído quando:** contas, faturamento, acessos e orçamento estão disponíveis. Contratar serviços não substitui implementar o backend.

## 3. Preparar desenvolvimento e homologação

1. Confirmar Node.js 22+, npm e Docker acessível com `docker info`. A primeira inicialização baixa as imagens do Supabase. Em ambientes com sandbox, a CLI e o Docker podem precisar de autorização para acessar o daemon e gravar seus arquivos locais.
2. Na raiz do repositório, instalar e verificar a base local:

   ```bash
   npm ci
   npm run db:start
   npm run db:status
   npm run db:reset
   npm run db:lint
   npm run db:test
   ```

   `db:reset` apaga e recria exclusivamente o banco **local**. Não é procedimento de produção. `db:status` pode exibir credenciais locais; não publicar sua saída.

3. Instalar e validar o frontend:

   ```bash
   npm ci
   npm run typecheck
   npm run test
   npm run build
   ```

4. Criar um ambiente de homologação com URL HTTPS e Supabase próprio. Usar dados sintéticos, Stripe de teste e destinatários controlados para mensagens.
5. Separar URLs, chaves, webhooks, dados e configurações entre desenvolvimento, homologação e produção. Previews devem apontar para homologação.

**Concluído quando:** os comandos passam no ambiente preparado e existe homologação isolada. Os testes atuais da base/protótipo não comprovam segurança ou cobrança de produção.

### 3.1. Rotina de desenvolvimento com Supabase local

O ambiente local usa o projeto `rkmed` de `supabase/config.toml`. Não exige login na nuvem nem `supabase link`. Os serviços ficam disponíveis enquanto o Docker e a stack estiverem em execução:

**Verificação em 21/10/2026:** migrations de domínio aplicadas localmente, lint SQL sem erros e 155 testes pgTAP aprovados. Frontend conectado ao Auth/RPC/Storage local; 37 testes automatizados e PWA offline aprovados. Provedores externos e homologação remota permanecem pendentes.

| Serviço | Endereço local | Uso |
| --- | --- | --- |
| API/Auth/Storage | `http://127.0.0.1:54321` | Integração local com o backend |
| PostgreSQL | `127.0.0.1:54322` | Banco local; usuário/banco/senha de desenvolvimento: `postgres` |
| Supabase Studio | `http://127.0.0.1:54323` | Inspeção do ambiente local |
| Caixa de e-mails de teste | `http://127.0.0.1:54324` | Mensagens capturadas sem envio externo |
| Frontend conectado | `http://127.0.0.1:5174` | `npm run dev:sandbox`; demo isolada em 5173 |

- [ ] Ao iniciar o trabalho, executar `npm run db:start`; o comando reaproveita a stack existente.
- [ ] Conferir o ambiente com `npm run db:status`. A saída inclui credenciais; não compartilhar nem versionar.
- [ ] Executar `npm run local:prepare` para gravar a configuração pública local e carregar fotos sintéticas privadas.
- [ ] Iniciar `npm run dev:sandbox` e, em outro terminal, `npm run functions:serve`. O frontend conectado usa o domínio real local. Veja [o guia de desenvolvimento](desenvolvimento.md).
- [ ] Criar mudanças de banco em uma nova migration com `npx --no-install supabase migration new nome_da_alteracao` e incluir grants/RLS/testes pertinentes.
- [ ] Para reconstruir fixtures **locais**, executar `npm run db:reset`. Isso apaga os dados do banco local; não é necessário em toda inicialização.
- [ ] Após alterar banco/migrations, executar `npm run db:lint` e `npm run db:test`. A suíte atual contém 155 verificações de infraestrutura, domínio e provedores.
- [ ] Quando houver esquema de domínio, gerar tipos com `npm run db:types` e salvar na localização de tipos definida pela implementação; o comando atual imprime os tipos.
- [ ] Ao encerrar e querer liberar recursos, executar `npm run db:stop`, que preserva os volumes locais. Não usar `--no-backup` para uma parada normal.

Usar dados sintéticos. Telefone local usa OTPs sintéticos reservados; a entrega Twilio externa permanece desabilitada e não é comprovada por esses testes. Nenhum reset, link ou deploy remoto faz parte desta rotina. Para acesso por celular, preparar HTTPS e origins explícitas; `localhost` no celular não aponta para este computador. Não expor Studio/PostgreSQL em túnel público.

Referência: [migrations e desenvolvimento local do Supabase](https://supabase.com/docs/guides/local-development/database-migrations).

## 4. Implementar o backend e conectar as telas

Este é o checklist de desenvolvimento. `[x]` indica implementação local existente, não homologação externa ou produção; `[ ]` indica trabalho pendente. Cada verificação deve ter evidência e ser atualizada junto com o `plan.md`. Uma tela do protótipo não conclui sua integração real. Seguir a ordem abaixo; decisões abertas bloqueiam os itens dependentes, sem impedir as demais entregas.

### 4.1. Base local reproduzível — fase 0, RNF-29/31/32

- [x] Fixar a CLI no `package-lock.json` e versionar `supabase/config.toml`.
- [x] Criar migration inicial privada, seed sintético e sete verificações pgTAP de infraestrutura.
- [x] Confirmar stack local saudável, recriação pelo `db:reset`, lint SQL e testes pgTAP. Registrar o resultado na seção 3 e no README.
- [x] Preparar configuração pública local do frontend em arquivo ignorado pelo Git; nunca incluir `service_role` em `VITE_*`.
- [ ] Criar adaptadores falsos locais para pagamentos e mensagens, sem chamar clientes reais. O e-mail local já deve ser capturado pela caixa de testes; telefone permanece desabilitado até haver um transporte local testado.

**Aceite:** outro desenvolvedor consegue iniciar a base e repetir os testes seguindo o README, sem conta de nuvem ou credenciais de provedores.

### 4.2. Estrutura do frontend e contratos — fase 1, RF-LP/RF-QR

- [x] Criar protótipo React/Vite com telas públicas, associado, parceiro e administração.
- [x] Definir acesso ao backend conforme D19 antes de conectar dados reais.
- [x] Estruturar módulos de domínio e acesso a dados, separando componentes visuais de fixtures e integrações.
- [x] Definir contratos de autenticação/checkout e validação de configuração, com erros explícitos e sem fallback de sandbox para demo. Contratos de domínio conectados por RPC.
- [x] Preparar cliente Supabase/Auth em sandbox e separar segredos de servidor. D19 implementado com RPC/RLS e funções privilegiadas.
- [x] Substituir gradualmente os dados locais por consultas autorizadas e invalidar/atualizar telas após operações.

**Aceite:** build e typecheck passam, as telas se adaptam a 360px e uma falha de API não é apresentada como operação concluída.

### 4.3. Identidade, dados e autorização — fase 2, RF-DG-01/09/10

- [x] Criar migrations incrementais para perfis/dados privados, parceiros, funcionários e permissões controladas pelo servidor.
- [x] Definir grants e RLS na mesma migration de cada tabela exposta; manter dados sensíveis em schema não exposto.
- [x] Provisionar o primeiro administrador por fluxo confiável e implementar criação de acessos internos por administrador existente.
- [x] Implementar autenticação real de equipe, permissões por perfil e estabelecimento, revogação e auditoria somente pelo backend.
- [x] Implementar contexto de trabalho do funcionário: validar código uma vez por sessão, trocar funcionário e encerrar no logout/troca de conta/expiração.
- [x] Criar projeções de dados que retornam CPF mascarado e busca exata autorizada, limitada e auditada. Não persistir CPF completo no navegador, URLs, logs ou exportações.
- [x] Configurar fotos privadas, validação de arquivos, remoção de metadados e acesso temporário autorizado conforme decisões aprovadas.
- [x] Testar API diretamente: anônimo negado, associado isolado, parceiro isolado, autoatribuição de função negada e consulta sem escrita/exportação.

**Aceite:** permissões continuam funcionando quando alguém ignora a interface e chama a API diretamente. Bloqueios de rota no frontend não são autorização.

### 4.4. Prioridade: QR e registro de compra — fase 4 antecipada, RF-QR/RF-PP

Depende da base de autorização. Usar associados sintéticos com elegibilidade paga criada apenas pelo mecanismo de testes, antes de integrar a Stripe.

- [x] Criar credencial QR estática, opaca, de alta entropia e revogável, sem CPF/Auth UUID exposto no conteúdo.
- [x] Criar validação online de QR e busca exata por CPF, retornando somente foto, nome mínimo e elegibilidade autorizados.
- [x] Exigir confirmação visual da foto e vincular a validação ao estabelecimento e funcionário da sessão.
- [x] Implementar cálculo no servidor com centavos inteiros, taxas em pontos-base e snapshot do desconto, com taxa por parceiro e meio centavo arredondado para cima.
- [x] Confirmar compra atomicamente, com recibo de validação de uso único e chave de idempotência; revalidar associado, parceiro e funcionário no commit.
- [x] Integrar câmera e alternativa autorizada por CPF ao backend; tratar permissão negada e falta de conexão.
- [x] Implementar estorno por administrador/suporte autorizado, sem limite de tempo, com motivo e registro vinculado, preservando a compra original.
- [ ] Testar duplo clique, concorrência, repetição, QR revogado, funcionário inativo e bloqueio entre consulta e confirmação.

**Aceite:** a jornada completa registra uma única compra correta, mantém autoria e auditoria e rejeita benefícios indisponíveis. Estorno de desconto não executa reembolso na Stripe.

### 4.5. Cadastro e login reais — fase 3, RF-CAD

- [x] Implementar validação de maioridade, CPF e duplicidade no servidor.
- [ ] Registrar aceite de versões documentais aprovadas; impedir versões de `docs/legal-mocks/` em produção.
- [ ] Implementar e-mail OTP e telefone OTP na mesma identidade Supabase, com WhatsApp pela API oficial da Meta (migração D26 pendente); Resend envia e-mails. SMS removido; manter reenvio pelo WhatsApp.
- [x] Impedir conclusão do cadastro e abertura do Checkout com somente um contato verificado.
- [x] Implementar login posterior por “Login com whatsapp” ou “Login com email”, exigindo apenas o canal escolhido; não adicionar PIN.
- [x] Persistir sessão do associado com tokens curtos e refresh rotativo, sem tempo de vida/inatividade imposto pela aplicação.
- [ ] Aplicar limites, expiração, tentativas e reenvios; testar contatos duplicados, replay, falha dos canais e recuperação de acesso aprovada.
- [x] Integrar foto ao armazenamento privado e validar no backend conforme a política definida; detecção de rosto não comprova identidade.

**Aceite:** o cadastro valida os dois contatos e os logins posteriores chegam ao mesmo associado, sem criar identidades duplicadas.

### 4.6. Assinatura e elegibilidade — fase 3, RF-PAG/RN-07–11

Preparação técnica de testes disponível em [Stripe — ambientes de testes](stripe-testes.md): SDK/CLI, catálogo/Checkout sintéticos, rascunho de fatura e receptor local de eventos assinados. Credenciais e execução contra o sandbox foram adiadas pelo operador. A aplicação tem endpoints próprios de billing e webhook; itens marcados representam implementação local, não aceitação externa. O receptor independente de testes não ativa associados.

- [x] Criar modelo de assinatura, período pago, elegibilidade e bloqueio independente conforme D09.
- [x] Implementar Checkout mensal de R$ 69,60 com Price ID selecionado no servidor e prevenção de assinaturas duplicadas.
- [x] Implementar assinatura/verificação de webhooks, registro durável de eventos, deduplicação e tratamento fora de ordem.
- [x] Liberar benefícios somente por confirmação válida do provedor ou conciliação; nunca por URL de sucesso.
- [ ] Bloquear benefícios imediatamente na falha e implementar tentativas D+0/D+1/D+3 com um único controlador de cobrança.
- [ ] Criar conciliação agendada, alertas de falha e recuperação sem duplicar faturas.
- [x] Implementar atualização de pagamento e cancelamento conforme política aprovada, preservando o histórico.
- [ ] Testar pagamento inicial, renovação, falha, recuperação, abandono, eventos inválidos/repetidos/atrasados e limites de cancelamento.

**Aceite:** a elegibilidade exibida pelo parceiro acompanha o estado confirmado e a compra é negada quando necessário, inclusive com carteirinha offline desatualizada.

### 4.7. Área do associado e offline — fases 4/1, RF-QR/RNF-25–27

- [ ] Integrar carteirinha, economia/histórico, parceiros, resumo/gestão de cobrança e suporte aos dados autorizados.
- [x] Definir os campos permitidos no snapshot e manter cache/IndexedDB isolados por conta.
- [x] Preservar conteúdo sincronizado offline sem expiração imposta pela aplicação, com estado offline e última sincronização visíveis.
- [x] Desabilitar pagamento, login, alterações e outras ações com dependência de rede, sem enfileirar para envio posterior.
- [x] Limpar dados ao sair/trocar conta e impedir cache genérico de APIs, URLs assinadas e dados de equipe.
- [ ] Tratar armazenamento removido pelo navegador, sessão revogada, reconexão e atualização da PWA sem interromper fluxos críticos.
- [ ] Testar inicialização offline instalada, câmera, logout seguido de outra conta e atualização em Android/iPhone físicos via HTTPS.

**Aceite:** o cartão sincronizado abre sem rede, outra conta não recebe dados anteriores e nenhuma venda usa o cache como prova de elegibilidade.

### 4.8. Administração, cobrança e mensagens — fase 5, RF-ADM/DG/NOT/SUP

- [x] Integrar cadastro/gestão de parceiros, funcionários e associados, com bloqueios e alterações auditadas.
- [x] Implementar painel de cobranças para administrador/suporte, com CPF mascarado e histórico autorizado.
- [x] Implementar envio de link Stripe e nova tentativa da mesma fatura, exigindo confirmação, chave durável de operação, proteção contra duplicidade e conciliação.
- [ ] Implementar fila transacional de mensagens, templates aprovados, tentativas limitadas, supressão de duplicatas e tratamento de falhas.
- [x] Implementar indicadores e relatórios reconciliados com compras/estornos; proteger exportações e negar exportação ao perfil de consulta. Verificado em 21/10/2026 por SQL e navegador; [roteiro de uso e limites](homologacao.md#relatórios-e-csv--verificados-em-21102026).
- [x] Implementar alertas operacionais em tempo real para admin/suporte, com sinal mínimo, RLS, expiração de sessão e reconexão. SQL e WebSocket/navegador locais aprovados; validar ainda no ambiente hospedado.
- [ ] Testar limites do suporte, ações simultâneas com webhooks, indisponibilidade dos provedores e tentativas indevidas de usuários de consulta.

**Aceite:** a equipe consegue operar sem editar o banco manualmente; alterações, cobranças e mensagens têm autoria e resultado rastreáveis.

### 4.9. Integração, qualidade e passagem para produção — fase 6, RF-LP/RNF

- [ ] Remover dependência de OTPs, senhas, dados e pagamentos simulados dos fluxos de produção.
- [ ] Executar unitários relevantes, testes SQL/RLS, integração de provedores e jornadas E2E completas em homologação.
- [x] Paginar associados/compras no servidor e verificar carga local com 2.000 associados, 10.060 compras e 50 commits simultâneos. [Resultados e limites](desempenho.md); p95 local de páginas 117,15 ms e commits 173,25 ms.
- [ ] Validar desempenho com carga representativa: API p95 ≤500ms, leitura até resultado ≤2s e 50 transações simultâneas, registrando ambiente e resultados.
- [ ] Validar acessibilidade, teclado, contraste, 360px, estados de erro e celulares reais.
- [ ] Validar conteúdo real, termos, suporte, segredos, backups de banco/arquivos e restauração.
- [ ] Documentar publicação, retorno à versão anterior, correção de migrations e resposta a incidentes; configurar alertas.
- [ ] Concluir o aceite da seção 9 e registrar versão/responsáveis antes de habilitar clientes reais.

**Concluído quando:** os fluxos usam backend real em homologação, os critérios de cada etapa têm evidência e as seções 5–9 de preparação operacional foram atendidas.

## 5. Configurar a assinatura e o recebimento na Stripe

1. Completar os dados comerciais e bancários solicitados na ativação da conta. Confirmar no painel se a conta pode receber pagamentos e repasses.
2. No ambiente de teste, criar o produto RKMED Linha Gold e um preço recorrente mensal em BRL de **6960 centavos**. O servidor deve selecionar o Price ID autorizado; o navegador não decide quanto cobrar.
3. Implementar a criação de Checkout vinculada ao associado autenticado e com os dois contatos verificados. Proteger contra assinaturas duplicadas em reenvios.
4. Implementar um endpoint de webhook que valide `Stripe-Signature` usando o corpo original da requisição e o segredo daquele endpoint. Gravar eventos com deduplicação e processar repetição, atraso e entrega fora de ordem.
5. Tratar pelo menos `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` e `customer.subscription.deleted`, conforme o contrato da versão de API escolhida. A liberação depende do pagamento confirmado e das regras de elegibilidade; a tela de sucesso nunca libera benefícios sozinha.
6. Implementar conciliação periódica com a Stripe para recuperar eventos perdidos e divergências. Alertar sobre eventos que não puderam ser processados.
7. Implementar perda imediata de benefícios na falha e a agenda confirmada **D+0, D+1 e D+3**. Documentar o marco de D+0 e validar a agenda em teste. Designar um único controlador de tentativas; evitar que automação própria e tentativas do provedor cobrem em paralelo. Não pressupor que a configuração padrão da Stripe corresponde a essa regra.
8. Disponibilizar gestão de pagamento/assinatura ao associado conforme as decisões de cancelamento aprovadas. O suporte pode enviar link de pagamento/atualização ou tentar novamente a **mesma fatura**; exigir confirmação, auditoria, conciliação e proteção contra cobrança duplicada.
9. Depois da homologação, criar os objetos e o webhook no ambiente real e configurar os respectivos IDs/chaves. Objetos e credenciais de teste não devem ser usados em produção.
10. Conferir no painel o destino bancário, tarifas e calendário de repasses da conta. Pagamento confirmado, saldo disponível e dinheiro creditado no banco são marcos distintos; a elegibilidade não deve esperar o repasse bancário.

Referências: [entrada em produção na Stripe](https://docs.stripe.com/get-started/checklist/go-live) e [eventos de assinaturas](https://docs.stripe.com/billing/subscriptions/webhooks).

**Concluído quando:** pagamento, falha, recuperação, cancelamento, duplicidade e conciliação funcionam em teste, e a configuração real foi conferida separadamente.

## 6. Habilitar WhatsApp oficial da Meta e e-mail reais

1. Preparar a conta e o número de WhatsApp sob controle da RKMED para a API oficial da Meta. Conferir os requisitos atuais na documentação oficial antes da configuração; Twilio saiu do escopo.
2. Implementar o novo adaptador de entrega e migrar `auth-sms`, `phone-code`, variáveis de ambiente e testes. Preservar emissão/validação do OTP pelo Supabase Auth, assinatura dos hooks, limites e vínculo à mesma identidade.
3. Entregar códigos de telefone somente pelo WhatsApp, sem alternativa por SMS. Manter a confirmação dos dois contatos no primeiro cadastro. Testar falha de entrega, reenvio e expiração sem liberar cadastro indevidamente.
4. Preparar o domínio/remetente no Resend e testar os e-mails de verificação e transacionais com destinatários controlados.
5. Comprovar cadastro com os dois contatos na mesma conta, login posterior por WhatsApp ou e-mail e ausência de contas duplicadas ao alternar canais.
6. Homologar entrega e falhas reais, mensagens aprovadas, limites, alertas e recuperação de contato pelo suporte.

**Concluído quando:** o transporte Meta substitui o legado no código, destinatários controlados recebem OTPs e falhas não permitem contornar verificação nem gerar identidades duplicadas.

## 7. Preparar o ambiente de produção e publicar

Somente executar após o backend e a homologação estarem prontos. O deploy do frontend fica sob gestão do usuário, conforme o plano do projeto.

1. Criar o projeto Supabase de produção, conferir região/capacidade e aplicar migrations revisadas pelo processo de deploy. Não copiar fixtures nem executar reset remoto. Publicar as funções implementadas, configurar buckets privados e agendar conciliação, mensagens e tarefas necessárias.
2. Configurar segredos de servidor no ambiente apropriado: chave privilegiada do Supabase, Stripe secret key, segredo do webhook, credenciais da Meta e do Resend. Os nomes exatos serão definidos pela implementação; não existe ainda um conjunto completo de variáveis de produção.
3. No build do frontend, configurar somente dados públicos necessários. `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são os nomes do `.env.test`; o modo sandbox já usa Supabase Auth, sem liberar benefícios ou permissões fictícias. Nunca usar chave privilegiada em `VITE_*`.
4. Confirmar a hospedagem. Se for Vercel, importar o repositório e usar a raiz da aplicação:

   | Diretório raiz na Vercel | Instalação | Build | Saída |
   | --- | --- | --- | --- |
   | Raiz do repositório | `npm ci` | `npm run build` | `dist` |

   O `vercel.json` da raiz foi ajustado para essa estrutura. Esta configuração publica o frontend; ela não publica banco, funções ou integrações. [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite).

   > **Erro `STATIC_BUILD_NO_OUT_DIR` ("No Output Directory named `dist` found"):** acontece quando o projeto na Vercel ainda aponta para a estrutura antiga. Se **Settings → Build and Development Settings → Root Directory** estiver como `prototype`, o build roda na raiz do repositório, mas a saída é procurada em `prototype/dist`; como o `vercel.json` da raiz fica fora do diretório raiz configurado, o painel também ignora essas opções. Corrija o **Root Directory** para a raiz do repositório (`.` ou vazio), salve e faça um novo deploy. O build em si já termina com sucesso antes desse erro.

5. Apontar o domínio pelo DNS e confirmar HTTPS. Configurar a URL oficial e redirects autorizados no Supabase Auth, URLs de retorno do pagamento e endpoint real do webhook. Não autorizar previews genéricos no Auth de produção.
6. Publicar a versão validada com os parâmetros de produção. Variáveis `VITE_*` são incorporadas ao build; alterações exigem novo build/deploy.
7. Substituir todos os nomes, fotos, contatos, endereços, parceiros e textos fictícios por conteúdo autorizado. Se usar o mapa incorporado, restringir a chave pública à API e aos domínios permitidos; sem chave, o protótipo já oferece link externo.
8. Validar acesso direto e recarregamento de rotas, instalação/atualização da PWA, câmera, cache e ausência de segredos no bundle. Testar Android e iPhone físicos em HTTPS.
9. Configurar backup de banco **e dos arquivos de fotos** em armazenamento protegido. Ensaiar restauração em ambiente isolado e registrar objetivos de recuperação e perda aceitável. O backup do banco Supabase não inclui os objetos do Storage. [Backups](https://supabase.com/docs/guides/platform/backups).
10. Configurar monitoramento/alertas e registrar como voltar à versão anterior do frontend. Para banco, preparar correção por nova migration e recuperação ensaiada; voltar o frontend não desfaz uma migration. Revisar a [lista de produção do Supabase](https://supabase.com/docs/guides/deployment/going-into-prod).

**Concluído quando:** domínio, backend, integrações reais, recuperação e monitoramento foram conferidos, com versão publicada identificada.

## 8. Cadastrar a operação e treinar os parceiros

1. Provisionar o primeiro administrador por procedimento técnico confiável e auditado. Depois, administradores existentes criam os acessos internos por e-mail/senha; cadastro público nunca concede privilégios.
2. Cadastrar parceiros reais, descontos aprovados, endereços e funcionários ativos vinculados a cada estabelecimento.
3. Entregar os acessos de forma segura e testar os limites de cada perfil. Diretoria/consulta não altera dados nem exporta; CPF completo não aparece no painel.
4. Treinar cada parceiro: entrar na conta do estabelecimento, validar o código do funcionário uma vez por sessão, ler QR, conferir foto/status, informar valor bruto e confirmar os valores calculados pelo servidor.
5. Demonstrar troca de funcionário, cartão inelegível, câmera negada, consulta exata por CPF com confirmação da foto e indisponibilidade de rede. O parceiro precisa estar online para operar.
6. Treinar suporte em cobrança, recuperação de acesso, bloqueio/reemissão de cartão, falhas e estorno de registro. Formalizar canal e horário de atendimento e responsáveis por incidentes.

**Concluído quando:** uma pessoa de cada perfil executa seu fluxo com supervisão e sabe como pedir ajuda.

## 9. Fazer o aceite antes de abrir ao público

Registrar resultado, ambiente, versão, data e responsável. Não marcar itens apenas porque a tela existe.

- [ ] Cadastro adulto com dados válidos, foto e documentos aprovados; os dois contatos são verificados na mesma conta.
- [ ] Pagamento de teste libera somente após confirmação válida; abandono, atraso e retorno direto à URL de sucesso não liberam.
- [ ] Falha bloqueia benefícios imediatamente; agenda D+0/1/3 e recuperação foram verificadas sem cobrança duplicada.
- [ ] Webhooks inválidos, repetidos e fora de ordem não corrompem o estado; conciliação recupera falhas.
- [ ] QR válido registra uma compra; duplo envio registra uma só. Elegibilidade é reavaliada na confirmação.
- [ ] Cartão revogado, associado bloqueado, funcionário inativo e acesso de outro estabelecimento são rejeitados pelo servidor.
- [ ] Estorno auditado e ações sobre a mesma fatura funcionam somente para perfis autorizados.
- [ ] Testes de API/RLS, fotos privadas, CPF mascarado e isolamento entre contas passam.
- [ ] Android e iPhone físicos passam por instalação, câmera, login e uso do cartão offline após sincronização.
- [ ] Offline informa última sincronização, não autoriza venda e não enfileira operações. Logout/troca de conta limpa os dados locais.
- [ ] Documentos, conteúdo, suporte, permissões e políticas pendentes foram aprovados.
- [ ] Backups de banco/arquivos foram restaurados em teste; alertas e procedimento de recuperação funcionam.
- [ ] Responsáveis técnico e de negócio registraram o aceite e a versão autorizada.

Depois desse aceite, fazer uma verificação controlada de ponta a ponta em produção com o responsável, cobrindo uma contratação legítima e seu pagamento real, webhook, cartão e operação no parceiro. Qualquer cobrança real exige ciência do pagador; eventual cancelamento/reembolso segue a política aprovada. Guardar referências técnicas sem expor dados pessoais ou credenciais. Abrir a divulgação após concluir essa verificação.

## 10. Jornada do cliente final: da contratação ao desconto

1. **Descoberta:** o cliente acessa o domínio oficial, vê parceiros reais, condições do clube e assinatura de R$ 69,60/mês.
2. **Cadastro:** informa os dados solicitados, confirma maioridade, verifica e-mail e WhatsApp, envia foto e aceita os documentos aprovados.
3. **Pagamento:** segue para o Checkout da Stripe e conclui o pagamento. Enquanto o backend não confirmar, vê pagamento em processamento e não tem benefício liberado. Se falhar, recebe orientação para regularizar.
4. **Ativação:** o backend valida o evento, atualiza a elegibilidade e disponibiliza a carteirinha com QR estático revogável. A comunicação de confirmação segue a matriz de mensagens aprovada.
5. **Acesso recorrente:** escolhe “Login com whatsapp” ou “Login com email”. A sessão do associado persiste com renovação segura; logout, revogação e perda do armazenamento podem exigir novo login.
6. **Instalação:** pode instalar a PWA no celular. O primeiro acesso e a sincronização exigem internet. Depois, consulta cartão e conteúdo sincronizado offline, com indicação da última atualização.
7. **Atendimento no parceiro:** apresenta o QR. O funcionário online verifica foto e elegibilidade atual. Sem celular, pode fazer a busca exata por CPF no fluxo autorizado e confirmar a foto; não existe PIN do associado.
8. **Compra:** o funcionário informa o valor bruto, revisa desconto e total calculados pelo servidor e confirma. O associado paga o total diretamente ao estabelecimento.
9. **Histórico:** a compra registrada aparece no histórico e na economia do associado após sincronização. Exemplo ilustrativo: em uma compra de R$ 200,00 com desconto aprovado de 20%, o desconto é R$ 40,00 e o pagamento ao parceiro é R$ 160,00. Isso não substitui a mensalidade.
10. **Renovação:** a Stripe cobra conforme o ciclo mensal da assinatura. Falha retira os benefícios imediatamente; o associado pode regularizar o pagamento. A recuperação só libera novamente após confirmação do provedor e verificação dos demais bloqueios.
11. **Suporte e cancelamento:** o associado encontra os canais de atendimento e a gestão de cobrança. Cancelamento e acesso ao período pago seguem a política aprovada e implementada antes do lançamento.

## 11. Rotina após o lançamento

| Frequência sugerida | Responsável | Conferência |
| --- | --- | --- |
| Diária, com alertas contínuos | Técnico/operação | Disponibilidade, erros, atraso de webhooks, conciliação e mensagens com falha |
| Diária | Financeiro/suporte | Faturas em aberto, tentativas, contatos auditados e divergências com a Stripe |
| Conforme calendário bancário da conta | Financeiro | Recebimentos, tarifas e repasses efetivos |
| Semanal | Operação | Parceiros, funcionários ativos e ocorrências no atendimento |
| Mensal e antes de exceder limites | Responsável pelas contas | Custos de mensagens, franquias, renovação do domínio e capacidade |
| Na periodicidade de recuperação aprovada e após mudanças relevantes | Técnico | Restauração, acessos, revisão de alertas e atualização do procedimento |

Em incidente de cobrança/elegibilidade, suspender o fluxo afetado de novas operações, preservar auditoria e reconciliar com o provedor. Não liberar benefícios editando estados no navegador nem criar outra fatura para compensar uma falha de processamento. Executar o procedimento de recuperação e comunicar os clientes afetados pelo canal aprovado.
