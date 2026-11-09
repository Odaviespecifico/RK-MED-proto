-- D30: preço oficial da Linha Gold passa a ser R$ 69,90 (6990 centavos).
-- Alinha o backend ao preço já existente no produto Stripe da RKMED; o produto
-- e o preço não são recriados nem alterados por esta migração.
alter table private.subscriptions alter column amount_due set default 6990;
