# Wedea — repasse das mensalidades (D27)

RKMed continua sendo responsável pelas assinaturas e cobranças de R$69,90/mês. Wedea recebe R$15,87 por fatura de mensalidade paga com valor positivo quando há pelo menos 201 associados pagantes com benefícios ativos. Em uma mensalidade integral, RKMed retém R$54,03 antes das tarifas Stripe/Billing/Connect. Compras nos estabelecimentos parceiros continuam fora desse fluxo.

## Regra e processamento

O webhook assinado `invoice.paid` consulta a fatura e a assinatura reais. A conciliação dos benefícios e a decisão de repasse são gravadas na mesma transação PostgreSQL, incluindo o associado recém-ativado no total. Contam assinaturas ativas, com período pago vigente, de associados sem bloqueio; cancelamento agendado mantém a contagem até o fim do período pago. Pagamentos simultâneos usam bloqueio transacional para serializar a decisão.

O total é o estado conciliado do banco no processamento, não uma reconstrução histórica do instante Stripe. Webhooks atrasados usam esse estado no primeiro processamento. O registro por fatura guarda total, valor pago e decisão; reentregas preservam a decisão original mesmo após alteração do total. Não há pagamento retroativo de faturas processadas abaixo do limite. Faturas de valor zero não geram repasse. O fluxo atual espera um pagamento Stripe por fatura; pagamentos externos, créditos sem cobrança e múltiplos pagamentos ficam pendentes para revisão, sem transferência automática.

O repasse usa `transfers.create`, em BRL, e chave de idempotência estável por fatura. O destino e a cobrança são congelados na primeira tentativa. Quando a cobrança cobre R$15,87, `source_transaction` vincula a liberação ao saldo dela. Uma cobrança positiva menor, por desconto, mantém a obrigação integral de R$15,87 e usa o saldo disponível da RKMed; saldo insuficiente deixa o repasse pendente.

Reembolso, disputa ou chargeback não revertem o repasse Wedea. Os eventos de risco continuam na fila operacional existente. RKMed financia reembolsos e contestações, além das tarifas. Não existe chamada automática de reversão de transferências neste fluxo.

## Configuração no sandbox

1. Ativar Connect na conta Stripe RKMed e criar/onboardar a conta Wedea via Accounts v2. Usar configuração recipient, dashboard Express, cobrança de tarifas administrada pela plataforma e responsabilidade por saldos negativos na plataforma (`fees_collector` e `losses_collector`: `application`). Completar verificação e dados bancários. Para integração de onboarding, preferir componentes `account_onboarding`, `notification_banner` e `account_management`; `payouts` é útil para acompanhar recebimentos.
2. Confirmar que `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status` está `active`. O backend revalida esse estado antes dos repasses.
3. Preencher `STRIPE_WEDEA_ACCOUNT_ID=acct_...` somente no ambiente das Edge Functions; manter `STRIPE_TEST_ACCOUNT_ID` como conta da RKMed. Nunca usar `VITE_*`. A conta Wedea precisa pertencer ao mesmo sandbox; contas live são recusadas.
4. A chave restrita do backend precisa de leitura de contas v2, Invoice Payments, PaymentIntents e Charges, além de escrita de Transfers e das permissões de cobrança já existentes.
5. Aplicar a migração e publicar as funções somente no ambiente autorizado. O webhook existente precisa receber `invoice.paid`, eventos de assinatura/falha e os eventos de risco já documentados. Executar `provider-jobs` periodicamente com `JOBS_SECRET` para retomar repasses pendentes, independentemente do limite de retentativas dos eventos.
6. Validar um pagamento inicial e uma renovação reais de teste, limites 200/201, repetição do evento, destinatário sem capacidade e falhas de rede. Conferir as transferências nos saldos Stripe. Transferência ao saldo Stripe da Wedea e repasse bancário são operações distintas; o calendário bancário é configurado na conta conectada.

O código permanece restrito a `local`/`sandbox`; configuração/aceitação real de Connect e produção não estão concluídas. O dashboard Express tem informações limitadas sobre cobranças e disputas deste modelo; RKMed opera essas ações.

## Retentativas e conciliação

`private.wedea_shares` possui RLS e acesso somente por RPCs de serviço. Guarda uma decisão por fatura, reserva de worker, parâmetros estáveis, ID Stripe e estado. A reserva dura dois minutos; resposta perdida pode repetir a mesma chamada com a mesma chave. Após 23 horas da primeira tentativa, uma reserva incerta passa a `review` e não cria outra transferência automaticamente, evitando cobrança duplicada após expiração da idempotência Stripe.

Para investigar, um operador com acesso autorizado ao banco deve consultar somente os identificadores financeiros necessários:

```sql
select invoice_id, active_members, amount_cents, status, destination,
       charge_id, transfer_id, first_attempt_at, completed_at
from private.wedea_shares
where status in ('pending', 'sending', 'review')
order by created_at;
```

Em `review`, localizar no Stripe a transferência por `transfer_group=rkmed:wedea:<invoice_id>`/metadata da fatura, verificar conta, moeda e valor e conciliar o registro com o ID existente. Nunca redefinir o registro/chave e reenviar sem confirmar se já houve transferência. Se não houver repasse, a retomada após investigação exige operação administrativa auditada; não há botão público para liberar pagamentos incertos.

Referências: [assinaturas com Connect](https://docs.stripe.com/connect/subscriptions), [cobranças e transferências separadas](https://docs.stripe.com/connect/separate-charges-and-transfers), [preços no Brasil](https://stripe.com/br/pricing).

## Verificação local

- `npm run typecheck` e `npm run build:sandbox`.
- `node --experimental-strip-types --test --test-isolation=none tests/integrations/wedea.test.mjs tests/integrations/billing-lifecycle.test.mjs`.
- `npm run db:lint` e `npm run db:test`: autorização/RLS, limites 200/201, renovação, queda do total, bloqueio, expiração, falha, fatura zero, desconto, reentrega e prazo de idempotência.
- `node tests/connected/wedea-concurrency.mjs`: duas conexões PostgreSQL reais disputam o mesmo repasse; exatamente uma reserva é concedida. Usa somente Docker local em `127.0.0.1:54322` e remove sua própria fatura sintética.

Os testes do transporte Stripe usam respostas simuladas; não comprovam aceitação externa do Connect.
