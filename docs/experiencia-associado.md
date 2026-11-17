# Autenticação, cadastro e pagamento — 16/11/2026

Solicitação: revisão mobile e desktop por etapas, preservando a identidade RKMED e os controles reais de autorização e pagamento.

## Etapas implementadas

1. **Apresentação e layout:** três telas breves de apresentação no celular, com toque/teclado, progresso e opção de pular. Desktop mantém benefícios à esquerda e formulário à direita. Consultar benefícios não desmonta o formulário; reduzir a janela após começar no desktop não reinicia a apresentação.
2. **Dados, contatos e login:** cadastro começa por nome, CPF, nascimento e aceites; depois informa e-mail, confirma e-mail, informa celular e confirma SMS. Os dados ficam somente em memória até a confirmação dos dois canais. Se a gravação final falhar, pode ser repetida sem consumir novamente o SMS já confirmado. Destinos mascarados, correção de contatos, reenvio em 60 segundos e indicação de código expirado. Login começa por e-mail e oferece SMS para o número já verificado; usa `purpose=login`, sem atualizar o telefone da conta. A recuperação de senha permanece disponível para contas internas, sem link no login do associado.
3. **Pagamento:** plano, valor, periodicidade, renovação, cancelamento e termos na mesma estrutura do cadastro. Checkout continua hospedado na Stripe, com redirecionamento explicado e retorno ao cadastro. A operação mantém identificador durante tentativas; o servidor reutiliza sessões pendentes e impede assinatura duplicada. Contexto do backend determina o status e a elegibilidade. Retorno `checkout=processing` apenas inicia consulta periódica, nunca concede benefícios. Pagamento em dia com bloqueio administrativo não mostra benefícios disponíveis.
4. **PWA:** convite na própria página, sem modal ou bloqueio. A dispensa vale na memória da visita, sem gravação persistente. Recarregar ou entrar novamente na área do cliente apresenta o aviso; navegação interna não o repete. Modo standalone, desktop e áreas públicas/equipe não mostram o aviso. O diálogo nativo depende de evento do navegador e só é aberto após clique; iOS oferece instruções de compartilhamento. Somente `appinstalled` sinaliza instalação concluída.

O catálogo Stripe configurado em `.env.stage` foi consultado em leitura: preço ativo, BRL 6990 centavos, recorrência mensal, intervalo 1, modo teste. O código mantém o contrato de preço já validado pelo servidor. Nenhuma cobrança ou envio externo de OTP foi realizado nessa verificação.

## Verificação reproduzível

- `npm run typecheck`, `npm test`, `npm run build:sandbox`.
- Com Vite sandbox em 5192: `node tests/connected/member-experience.mjs`. Usa componentes reais com serviços simulados; cobre apresentação, preservação de campos, envio recusado, código incorreto/expirado, reenvio, correções, ambos os canais, foto com câmera emulada, login por um canal, estados de pagamento, janela reduzida e texto ampliado.
- Com demo em 5173: `node tests/pwa-install.mjs` e `node tests/flows.mjs`. Inclui nova visita, saída/retorno, navegação interna, instruções iPhone, instalação nativa após clique, falha e standalone.
- `npx supabase test db --local supabase/tests/member-enrollment.test.sql supabase/tests/otp.test.sql supabase/tests/providers.test.sql`: seis novas verificações de cadastro mais testes existentes de OTP/provedores, todos em transações revertidas. Recusam ausência de canais e confirmação de apenas um; confirmam a mesma identidade e benefício inativo após cadastro.

## Limites do aceite

Viewport reduzido representa menor área disponível; não comprova comportamento de teclado em aparelho físico. Instalação nativa, câmera e PWA offline em iPhone/Android reais por HTTPS continuam exigindo aceite específico. Estados do pagamento nos testes de navegador usam respostas simuladas; conciliação, isolamento e bloqueio de pagamento sem verificação são exercitados pelos testes backend. Pagamentos e entregas reais de SMS/e-mail não foram executados nesta etapa. Textos jurídicos finais seguem pendentes de aprovação. Implementação local; publicação do frontend e da API com a nova URL de retorno ainda necessária.
