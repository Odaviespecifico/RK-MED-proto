# Stripe Checkout — pendências de integração

Cenário A: atualizadas somente as propriedades dos dois objetos de criação de Checkout Session. Este arquivo concentra as pendências desta alteração; a integração continua restrita a testes.

## Values to Replace

Não há parâmetros `sample_only` ausentes nem placeholders literais nas chamadas existentes. Nenhum valor real foi substituído por exemplo.

**Files containing placeholders:** nenhum nas chamadas de Checkout.

| Campo preservado | Valor atual | Ação |
| --- | --- | --- |
| `mode` (ambas as chamadas) | `subscription` | Correto para a mensalidade recorrente de R$ 69,60. |
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

Foram removidos os parâmetros não presentes nos Field Intents: `customer`, `metadata`, `subscription_data`, `locale` e `client_reference_id`, onde existiam. As opções de transporte/idempotência foram preservadas, assim como a inicialização existente do cliente Stripe e sua versão de API.

## Setup and Next Steps

### Bloqueio funcional antes de aceitar pagamentos

- [ ] Resolver a associação entre Checkout e associado antes de usar o fluxo conectado. A remoção solicitada de `customer` faz o Checkout de assinatura criar outro Customer, enquanto o backend continua salvando e conciliando o Customer criado previamente. Os webhooks resolvem o associado pelo Customer persistido, portanto o novo pagamento não será associado automaticamente ao cadastro. A autorização para restabelecer `customer` nos Field Intents ou uma mudança separada na associação será necessária; essa mudança de fluxo está fora do escopo cirúrgico solicitado.
- [ ] Atualizar, em tarefa separada, as expectativas dos testes existentes: dois testes ainda exigem ausência de `automatic_tax`; o teste de Checkout sintético também espera o antigo identificador aleatório. Não alterar o payload configurado para satisfazer essas expectativas antigas.
- [ ] Validar o Checkout hospedado real no sandbox, incluindo `origin_context: mobile_app` no fluxo atual de PWA, antes de considerar o comportamento aceito.

### Ambiente, chaves e dependências

- [ ] Executar `npm ci` se as dependências ainda não estiverem instaladas. Nenhuma dependência nova é necessária. Node e Edge usam Stripe 23.0.0; se houver downgrade para versão abaixo de 21.0.0, revisar `ui_mode` para `hosted`.
- [ ] Para as Edge Functions, preencher o arquivo ignorado `supabase/functions/.env` a partir de [supabase/functions/.env.example](supabase/functions/.env.example): `APP_ENV`, `APP_ORIGIN`, `STRIPE_SECRET_KEY`, `STRIPE_TEST_ACCOUNT_ID`, `STRIPE_PRICE_ID` e `STRIPE_WEBHOOK_SECRET`. Usar Price ativo de teste em BRL, 6960 centavos, recorrência mensal e quantidade 1. Configurar `STRIPE_PORTAL_CONFIGURATION_ID` para o portal já existente.
- [ ] Para os utilitários independentes, executar `npm run stripe:init` e preencher `.env.stripe.local` conforme [.env.stripe.example](.env.stripe.example), com `STRIPE_TEST_ENV`, `STRIPE_TEST_ACCOUNT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `STRIPE_TEST_ORIGIN`. Esse arquivo não configura as Edge Functions.
- [ ] Usar credenciais do sandbox esperado, preferencialmente chave restrita de teste com permissões necessárias. Os nomes existentes são consistentes entre código e exemplos; manter segredos sem prefixo `VITE_`. O redirecionamento hospedado atual não precisa de chave publicável no navegador.
- [ ] Configurar o webhook existente para eventos de Checkout, assinaturas, faturas e risco; conferir assinatura e ambiente. Para testes conectados locais: `npx --no-install stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook`. Usar o segredo emitido por esse listener nas Edge Functions.

### Estrutura e fluxo

Único arquivo criado: `STRIPE_INTEGRATION_TODO.md`, na raiz. As duas chamadas existentes foram atualizadas; nenhuma rota, infraestrutura, inicialização, autenticação ou persistência foi adicionada.

O fluxo conectado autentica o associado e verifica contatos, consentimento e foto, reserva a operação, valida conta/preço de teste e cria a sessão. O navegador recebe a URL e redireciona ao Stripe Checkout hospedado; sucesso e cancelamento retornam à cobrança. O retorno nunca ativa benefícios. Os eventos assinados e a conciliação existentes dependem da correção da associação de Customer descrita acima para atualizar o associado correto.

O utilitário independente `npm run stripe:checkout` usa seu catálogo sintético e retorna uma URL de teste. `npm run stripe:webhook` atende os retornos locais e registra recibos sintéticos, sem ativar associados.

### Testes e operação

Verificação desta alteração: `npm run typecheck` passou. A execução direcionada de `tests/integrations/adapters.test.mjs` e `tests/stripe/sandbox.test.mjs`, com `--test-isolation=none`, terminou com 18 testes aprovados e 2 falhas nas expectativas antigas de ausência de `automatic_tax` (linhas 93 e 100, respectivamente). O teste HTTP passou após permitir a porta local. Nenhuma chamada remota de pagamento foi executada.

- [ ] Executar `npm run typecheck` e os testes Stripe/adaptadores. As expectativas antigas apontadas acima precisam de atualização separada; testes offline não comprovam aceitação pela API.
- [ ] Após resolver a associação, concluir um Checkout no sandbox com `4242 4242 4242 4242`, validade futura e CVC de teste; usar somente dados sintéticos. Testar cancelamento, falha de pagamento, renovação e reenvio de eventos, verificando associação ao cadastro e idempotência.
- [ ] Conferir produtos/preços e eventuais códigos promocionais no mesmo sandbox; validar os efeitos dos descontos na mensalidade antes de habilitá-los para operação real.
- [ ] Confirmar assinatura/fatura persistidas e elegibilidade derivada de evento verificado, nunca da página de sucesso. Validar rastreamento da operação e prevenção de assinatura duplicada depois da correção da associação.
- [ ] Revisar o tratamento tributário antes de produção: `automatic_tax.enabled` permanece `false`, conforme Checkout Studio. Habilitar Stripe Tax exige configuração própria e registros aplicáveis.
- [ ] Concluir homologação de provedores e demais critérios de produção do projeto. Nenhum pagamento remoto, deploy ou teste com cartão real faz parte desta alteração.

### Recursos

- [Criar Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- [Cartões e cenários de teste](https://docs.stripe.com/testing)
- [Webhooks de assinaturas](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Suporte Stripe](https://support.stripe.com)
- [Stripe MCP](https://docs.stripe.com/mcp)
