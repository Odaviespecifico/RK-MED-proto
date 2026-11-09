# Stripe Checkout — pendências de integração

## Connect Wedea — D27

Repasse condicional implementado no backend; configuração e aceitação externa pendentes. Seguir [docs/wedea-connect.md](docs/wedea-connect.md). Preencher `STRIPE_WEDEA_ACCOUNT_ID`, concluir onboarding/capacidade recipient no sandbox e validar transferências reais de teste antes de publicação. A mensalidade continua usando o Checkout recorrente existente; a divisão ocorre após `invoice.paid`, com decisão persistida e transferência idempotente, sem reversão em reembolsos ou contestações.

Cenário A: atualizados os parâmetros das duas chamadas existentes de Checkout Session. Na continuação da implementação, o vínculo com o Customer do associado foi restabelecido e os testes foram atualizados. Este arquivo concentra as pendências; a integração continua restrita a testes.

## Values to Replace

Não há parâmetros `sample_only` ausentes nem placeholders literais nas chamadas existentes. Nenhum valor real foi substituído por exemplo.

**Files containing placeholders:** nenhum nas chamadas de Checkout.

| Campo preservado | Valor atual | Ação |
| --- | --- | --- |
| `mode` (ambas as chamadas) | `subscription` | Correto para a mensalidade recorrente de R$ 69,90. |
| `line_items` (ambas as chamadas) | `[{ price: price.id, quantity: 1 }]` | ID obtido do catálogo validado; não substituir por `price_...`. |
| `success_url` (adaptador) | `${origin.origin}/app/cobranca?checkout=processing` | URL existente da aplicação, preservada. |
| `cancel_url` (adaptador) | `${origin.origin}/app/cobranca` | URL existente da aplicação, preservada. |
| `success_url` (utilitário) | `${config.origin}/success?session_id={CHECKOUT_SESSION_ID}` | Retorno local do receptor de testes existente, preservado. |
| `cancel_url` (utilitário) | `${config.origin}/cancel` | Retorno local do receptor de testes existente, preservado. |

## Configured Parameters

**Files containing these parameters:**

- [supabase/functions/_shared/providers/stripe.ts](supabase/functions/_shared/providers/stripe.ts)
- [scripts/stripe/fixtures.mjs](scripts/stripe/fixtures.mjs)

| Parâmetro | Valor |
| --- | --- |
| `ui_mode` | `hosted_page` — Stripe SDK 23.0.0 no Node e nas Edge Functions |
| `billing_address_collection` | `auto` |
| `phone_number_collection` | `{ enabled: true }` |
| `automatic_tax` | `{ enabled: false }` |
| `allow_promotion_codes` | `true` |
| `payment_method_collection` | `always` — ambas as chamadas usam `subscription` |
| `submit_type` | `auto` |
| `name_collection` | `{ individual: { enabled: true } }` |
| `saved_payment_method_options` | `{ payment_method_save: 'enabled' }` |
| `integration_identifier` | `hosted_mobile_app_0001` |
| `origin_context` | `mobile_app` |

Foram removidos `metadata`, `subscription_data`, `locale` e `client_reference_id`, onde existiam. Na continuação solicitada, `customer: customerId` foi restabelecido no adaptador conectado como exceção à remoção de parâmetros fora dos Field Intents: ele mantém o vínculo já existente entre o pagamento e o associado. O utilitário sintético continua sem Customer prévio. As opções de transporte/idempotência foram preservadas, assim como a inicialização existente do cliente Stripe e sua versão de API.

## Setup and Next Steps

### Implementação local e aceitação externa

- [x] Restabelecer `customer` no adaptador conectado para usar o Customer persistido do associado. Teste de regressão com transportes simulados cobre Checkout → evento do provedor → conciliação para o mesmo cadastro; a criação da sessão não ativa benefícios.
- [x] Atualizar as expectativas antigas de `automatic_tax` e do identificador de integração; verificar os parâmetros do Checkout Studio e a idempotência.
- [ ] Validar o Checkout hospedado real no sandbox, incluindo `origin_context: mobile_app` no fluxo atual de PWA, antes de considerar o comportamento aceito.

### Ambiente, chaves e dependências

- [ ] Executar `npm ci` se as dependências ainda não estiverem instaladas. Nenhuma dependência nova é necessária. Node e Edge usam Stripe 23.0.0; se houver downgrade para versão abaixo de 21.0.0, revisar `ui_mode` para `hosted`.
- [ ] Executar `npm run env:init` e preencher o arquivo privado `.env.test`: `APP_ENV`, `APP_ORIGIN`, `STRIPE_SECRET_KEY`, `STRIPE_TEST_ACCOUNT_ID`, `STRIPE_PRICE_ID` e `STRIPE_WEBHOOK_SECRET`. Usar Price ativo de teste em BRL, 6990 centavos, recorrência mensal e quantidade 1. Configurar `STRIPE_PORTAL_CONFIGURATION_ID` para o portal já existente.
- [ ] No mesmo `.env.test`, preencher `STRIPE_TEST_ENV` e `STRIPE_TEST_ORIGIN` para os utilitários independentes. Configurar `STRIPE_CLI_WEBHOOK_SECRET` se o listener da porta 4242 tiver segredo diferente do webhook das funções. Ver [ambientes](docs/ambientes.md).

Diagnóstico local desta continuação: `npm run stripe:doctor` indicou `testKeyConfigured: false`, `expectedAccountConfigured: false`, `webhookSecretConfigured: false` e `remoteConnectionVerified: false` nos utilitários. A aceitação remota depende dessa configuração.

- [ ] Usar credenciais do sandbox esperado, preferencialmente chave restrita de teste com permissões necessárias. Os nomes existentes são consistentes entre código e exemplos; manter segredos sem prefixo `VITE_`. O redirecionamento hospedado atual não precisa de chave publicável no navegador.
- [ ] Configurar o webhook existente para eventos de Checkout, assinaturas, faturas e risco; conferir assinatura e ambiente. Para testes conectados locais: `npx --no-install stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook`. Usar o segredo emitido por esse listener nas Edge Functions.

### Estrutura e fluxo

Único arquivo criado: `STRIPE_INTEGRATION_TODO.md`, na raiz. As duas chamadas existentes foram atualizadas; nenhuma rota, infraestrutura, inicialização, autenticação ou persistência foi adicionada.

O fluxo conectado autentica o associado e verifica contatos, consentimento e foto, reserva a operação, valida conta/preço de teste e cria a sessão com o Customer já vinculado ao cadastro. O navegador recebe a URL e redireciona ao Stripe Checkout hospedado; sucesso e cancelamento retornam à cobrança. O retorno nunca ativa benefícios. Os eventos assinados resolvem o Customer persistido e a conciliação consulta a assinatura e a fatura atuais para atualizar o associado correto.

O utilitário independente `npm run stripe:checkout` usa seu catálogo sintético e retorna uma URL de teste. `npm run stripe:webhook` atende os retornos locais e registra recibos sintéticos, sem ativar associados.

### Testes e operação

Verificação desta continuação: `npm run typecheck` e `npm run build:sandbox` passaram. A suíte completa de testes Node terminou com 38 aprovados e zero falhas, usando `node --experimental-strip-types --test --test-isolation=none tests/*.test.mjs tests/integrations/*.test.mjs tests/stripe/*.test.mjs`, com permissão para a porta local do receptor HTTP. As expectativas antigas foram corrigidas e o teste de regressão de associação foi adicionado. Nenhuma chamada remota de pagamento foi executada.

- [x] Executar `npm run typecheck` e `npm run build:sandbox`.
- [x] Executar a suíte completa de testes Node: 38 aprovados, incluindo vínculo do Customer, idempotência e webhook local.
- [ ] Com as credenciais configuradas, concluir um Checkout no sandbox com `4242 4242 4242 4242`, validade futura e CVC de teste; usar somente dados sintéticos. Testar cancelamento, falha de pagamento, renovação e reenvio de eventos, verificando associação ao cadastro e idempotência. Testes offline não comprovam aceitação pela API.
- [ ] Usar um associado sintético novo para aceitar o payload atualizado. Uma sessão pendente já criada conserva o payload anterior; não reutilizar sua chave de idempotência com parâmetros diferentes.
- [ ] Conferir produtos/preços e eventuais códigos promocionais no mesmo sandbox; validar os efeitos dos descontos na mensalidade antes de habilitá-los para operação real.
- [ ] Confirmar no sandbox assinatura/fatura persistidas e elegibilidade derivada de evento verificado, nunca da página de sucesso. Validar rastreamento da operação e prevenção de assinatura duplicada.
- [ ] Revisar o tratamento tributário antes de produção: `automatic_tax.enabled` permanece `false`, conforme Checkout Studio. Habilitar Stripe Tax exige configuração própria e registros aplicáveis.
- [ ] Concluir homologação de provedores e demais critérios de produção do projeto. Nenhum pagamento remoto, deploy ou teste com cartão real faz parte desta alteração.

### Recursos

- [Criar Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- [Cartões e cenários de teste](https://docs.stripe.com/testing)
- [Webhooks de assinaturas](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Suporte Stripe](https://support.stripe.com)
- [Stripe MCP](https://docs.stripe.com/mcp)
