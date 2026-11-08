# Stripe — ambientes de testes RKMED

## Estado desta entrega

Estrutura local implementada para Billing e Invoicing, com SDK Stripe 23.0.0, CLI 1.54.0 e API `2026-09-30.endive` fixados. **Verificação em 19/10/2026: 13 testes offline aprovados**, incluindo o receptor HTTP em loopback (executado fora do sandbox do agente). O operador escolheu preparar somente a estrutura local, sem fornecer credenciais ou criar recursos remotos. O frontend continua com simulações.

O plugin foi instalado, mas `stripe_implementation_planner` não ficou disponível nesta sessão. O fallback solicitado (`npx skills add https://docs.stripe.com`) instalou as skills oficiais em `.agents/skills/`. A implementação segue a skill `stripe-best-practices` e a documentação oficial; este documento **não é uma saída do planejador MCP**. As skills instaladas ficam disponíveis na próxima interação.

O frontend agora está na raiz da aplicação, com demonstração isolada e modo Supabase sandbox. O contrato de Checkout e os transportes de servidor estão descritos no [guia de desenvolvimento](desenvolvimento.md); eles não foram expostos por endpoint nem ligados à elegibilidade dos associados. Os comandos deste documento continuam independentes da UI.

As ferramentas deste diretório são utilitários de desenvolvimento executados no terminal. O receptor HTTP local não é um novo serviço de produção: ele verifica e registra eventos de teste, sem criar usuários, ativar carteirinhas ou alterar elegibilidade. A integração da aplicação permanece prevista em Supabase Edge Functions/PostgreSQL.

## Plano de integração e limites

1. Separar ambientes/credenciais e provar assinatura, isolamento e dados de teste com esta estrutura.
2. Criar o catálogo sintético: um Product Linha Gold e um Price recorrente mensal em BRL, de 6960 centavos.
3. Exercitar Checkout em `mode=subscription`. A própria assinatura gera suas faturas de ciclo; não criar outra fatura para cobrar a mesma mensalidade.
4. Exercitar Invoicing separadamente por um rascunho de teste com outro cliente sintético, sem envio nem cobrança automática.
5. Antes de conectar associados reais ou de homologação ao pagamento, implementar Auth/permissões, cadastro com dois contatos verificados e as decisões pendentes em `plan.md`.
6. Implementar no backend da aplicação a caixa de eventos durável, processamento idempotente, consulta ao estado atual do provedor, conciliação, notificações e auditoria. Só então ligar pagamento confirmado à elegibilidade, inclusive falha imediata e tentativas D+0/1/3. Eventos fora de ordem não podem sobrescrever o estado atual cegamente.
7. Implementar gestão via Customer Portal após aprovar cancelamento/acesso ao período pago. Tratar também disputas, reembolsos e sinais de fraude conforme política aprovada. Esses eventos já podem ser observados pelo receptor de testes, mas ainda não produzem ações de negócio.

Não há split, comissão nem cobrança Stripe da compra no parceiro. Não há implementação de cobrança manual de dívidas reais nesta entrega. O rascunho Invoicing abaixo é apenas um cenário técnico independente.

## Ambientes

Para uma integração nova, a Stripe recomenda sandboxes separados, com dados e configurações isolados; não presumir que o modo de teste compartilhado oferece a mesma separação. [Sandboxes Stripe](https://docs.stripe.com/sandboxes).

| Ambiente da ferramenta | Uso | Credenciais e dados |
| --- | --- | --- |
| `local` | Desenvolvimento manual | Sandbox RKMED de desenvolvimento; `.env.test`, ignorado pelo Git |
| `ci` | Testes automatizados com provedor, quando necessários | Outro sandbox; segredos do CI e `STRIPE_TEST_ENV=ci` |
| `staging` | Homologação integrada futura | Outro sandbox e configuração própria, sem chaves live |
| Produção | Não suportada por estas ferramentas | Valores como `production`, chaves live e objetos live são rejeitados |

Os testes de `npm run stripe:test` são offline e independem de sandbox, conta, chave real ou Supabase. Mesmo com `STRIPE_TEST_ENV=ci`, as chamadas remotas só acontecem ao executar explicitamente `bootstrap`, `checkout` ou `invoice`.

## 1. Iniciar a estrutura local sem credenciais

Na raiz do repositório:

```bash
npm ci
npm run stripe:init
npm run stripe:doctor
npm run stripe:test
```

`stripe:init` e `env:init` criam `.env.test` e `.env.prod` com permissões restritas e segredos vazios; arquivos existentes são preservados. `stripe:doctor` valida `.env.test` sem fazer chamadas externas e sem imprimir segredos. `remoteConnectionVerified: false` é esperado nesse diagnóstico e não deve ser apresentado como conexão autenticada.

Para executar somente o receptor de assinaturas, configurar `STRIPE_WEBHOOK_SECRET`. Ele não precisa de chave da API. Sem segredo, o comando recusa inicializar.

## 2. Configurar um sandbox RKMED quando houver acesso

Esta etapa permanece pendente por escolha do operador.

1. No Dashboard da Stripe, criar/selecionar um sandbox da RKMED para desenvolvimento. Criar outro separado para CI/homologação quando esses ambientes forem usados.
2. No sandbox selecionado, obter o Account ID `acct_...` e criar preferencialmente uma **chave restrita de teste**, com apenas as permissões das operações necessárias. Para os comandos completos: leitura da própria conta, leitura/escrita de Products/Prices, Checkout Sessions, Customers, Invoices e Invoice Items. Conferir os nomes/permissões disponíveis no painel e acrescentar dependências somente se exigidas pela API. [Chaves Stripe](https://docs.stripe.com/keys).
3. Preencher o arquivo ignorado `.env.test` localmente, sem colar valores na conversa:

   ```dotenv
   STRIPE_TEST_ENV=local
   STRIPE_TEST_ACCOUNT_ID=acct_ID_DO_SANDBOX
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=
   STRIPE_TEST_ORIGIN=http://127.0.0.1:4242
   ```

   Preencher o valor vazio da chave de teste no arquivo real; o exemplo acima não contém uma chave utilizável. Nunca usar `VITE_STRIPE_SECRET_KEY`, nem mover os segredos para o bundle Vite. A ferramenta aceita chaves de teste restritas/secretas e chaves temporárias de sandbox; recusa as de produção e as publicáveis.

4. Rodar `npm run stripe:doctor` para verificar a presença das configurações. Nos comandos remotos, a conta é consultada e comparada a `STRIPE_TEST_ACCOUNT_ID` **antes de qualquer alteração**. Permissão negada ou conta diferente interrompe a operação.
5. As ferramentas leem somente `.env.test`; variáveis do processo/gerenciador de segredos têm precedência. Usar `STRIPE_WEBHOOK_SECRET` para as Edge Functions e `STRIPE_CLI_WEBHOOK_SECRET` para um listener independente diferente. No CI, guardar segredos no cofre da plataforma; não publicar saídas da CLI, URLs de Checkout ou arquivos de ambiente como artifacts.

## 3. Preparar o catálogo Billing

```bash
npm run stripe:bootstrap
```

Cria ou reutiliza o produto sintético `rkmed_gold_test_local` e o preço de R$ 69,60/mês. O ambiente faz parte do identificador e do lookup key. Operações de criação usam chaves de idempotência. Se houver produto/preço incompatível, a ferramenta interrompe e pede revisão; não altera silenciosamente valores existentes.

Preço e produto devem ter `livemode=false`. A saída contém apenas ambiente, IDs, moeda e valor. Repetir `bootstrap` reutiliza o catálogo; não recria um plano a cada execução.

## 4. Receber webhooks no computador

Usar snapshot events e a mesma versão de API fixada para a integração. O segredo do listener local difere do segredo de um endpoint cadastrado no Dashboard. O encaminhamento da CLI permite testar localhost sem publicar um endpoint. [Webhooks Stripe](https://docs.stripe.com/webhooks).

Em um terminal, autenticar a CLI no sandbox correto e iniciar o encaminhamento:

```bash
npx --no-install stripe login --project-name rkmed-local
npx --no-install stripe listen --project-name rkmed-local --events checkout.session.completed,checkout.session.async_payment_succeeded,invoice.paid,invoice.payment_failed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,charge.dispute.created,charge.refunded,radar.early_fraud_warning.created --forward-to http://127.0.0.1:4242/webhook
```

Conferir a conta/sandbox autorizada durante o login. O perfil da CLI precisa corresponder ao `STRIPE_TEST_ACCOUNT_ID` usado pelos scripts. O login OAuth do MCP e o login da CLI são conexões distintas.

Copiar o `whsec_...` exibido pelo listener para `STRIPE_WEBHOOK_SECRET` no arquivo ignorado. Manter esse terminal aberto. Em outro terminal:

```bash
npm run stripe:webhook
```

O receptor escuta apenas em `127.0.0.1:4242`. `GET /health` retorna um status genérico. `POST /webhook` limita o corpo a 1 MiB, valida `Stripe-Signature` sobre os bytes originais com tolerância padrão do SDK, rejeita eventos live e ignora eventos fora da lista.

Eventos aceitos geram recibos mínimos em `.local/stripe/<ambiente>/<conta>/events/`, ignorados pelo Git. Guardam somente ID/tipo/data do evento, modo, ambiente e ID do objeto. Não guardam corpo completo, CPF, e-mail, dados do cartão ou segredos. Mesmo ID recebido de novo retorna `duplicate`, inclusive após reiniciar o receptor. Falha ao gravar retorna erro para permitir reenvio. Recibo corrompido exige inspeção e correção local; não é aceito silenciosamente.

Esses recibos não são um ledger financeiro nem substituem a futura caixa de eventos no PostgreSQL. Não há processamento de assinatura/elegibilidade, nem autorização por associado neste receptor. Não publicar essa ferramenta na internet.

## 5. Exercitar Checkout e Invoicing

Com conta/chave de sandbox configuradas:

```bash
npm run stripe:checkout
npm run stripe:invoice
```

- `stripe:checkout` reutiliza o catálogo e cria uma **nova sessão sintética a cada execução intencional**, com chave de idempotência por operação e referência sem CPF. A saída contém um link de Checkout de teste. Abrir localmente, usar somente dados sintéticos e cartões oficiais de teste, como `4242 4242 4242 4242`, validade futura e CVC de teste. Não inserir cartão real. Conferir se o sandbox habilita cartão e outros meios desejados no Dashboard; o código não fixa `payment_method_types`. [Cartões e cenários oficiais](https://docs.stripe.com/testing).
- O retorno de sucesso aponta para o receptor local e diz que nenhum benefício foi ativado. Não altera o protótipo nem cria um associado pago.
- `stripe:invoice` cria **outro cliente sintético e um novo rascunho independente por execução**. Define `auto_advance=false`, vincula explicitamente o item de 6960 centavos à fatura e não envia, finaliza nem paga a fatura. Conferir `status=draft` e `total=6960` no sandbox. Não usar esse comando para recuperar uma dívida de assinatura.
- A assinatura concluída pelo Checkout gera suas próprias faturas e eventos Billing. Usar esses objetos para testar renovação/recuperação na futura integração; não reaproveitar o rascunho independente como mensalidade pendente.

Reenvio automático do SDK reutiliza a chave de idempotência da mesma chamada. Os comandos de cenários não implementam uma fila de recuperação após queda do processo: em caso de falha parcial, conferir os objetos sintéticos/metadata no sandbox antes de criar outro cenário. Isso não atende ainda à proteção durável exigida para cobrança de associados.

## Checklist e evidências

- [x] Instalar/fixar SDK e CLI, com lockfile.
- [x] Preparar arquivo local de configuração ignorado, sem credenciais.
- [x] Separar ambientes e exigir chave de teste/conta esperada para operações remotas.
- [x] Implementar catálogo recorrente, Checkout sintético e rascunho Invoicing.
- [x] Implementar receptor local com assinatura, corpo original, limite de tamanho e recibos mínimos deduplicados.
- [x] Validar offline configuração, preço, idempotência do catálogo, rascunho sem envio, assinaturas inválidas/expiradas, replay, eventos fora de ordem e retorno sem ativação.
- [ ] Configurar chaves e sandbox da RKMED (adiado pelo operador).
- [ ] Executar comandos contra a API real do sandbox e conferir os objetos no Dashboard.
- [ ] Receber evento real encaminhado pela CLI e confirmar repetição sem novo recibo.
- [ ] Validar pagamento aprovado/recusado, renovação, falha e recuperação com cenários do provedor.
- [ ] Implementar backend autorizado e persistência de domínio no Supabase, conciliação, agenda D+0/1/3 e elegibilidade.
- [ ] Obter/revisar o plano do `stripe_implementation_planner` quando a conexão MCP estiver disponível.

Stripe Tax não foi habilitado. Antes de produção, revisar com os responsáveis o tratamento tributário e eventuais registros necessários; não pressupor que habilitar `automatic_tax` equivale a configurar tributação. [Tributos em pagamentos recorrentes](https://docs.stripe.com/billing/taxes/collect-taxes).
