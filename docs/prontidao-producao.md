# Prontidão para produção — 09/11/2026

**Resultado:** homologação publicada e conectada ao banco real. Produção comercial ainda não liberada.

Frontend: https://rk-med-proto.vercel.app — deploy `dpl_FP6woehta7pYaFYpKL5hcmxcdE1J`. Backend: projeto Supabase `chuyompxoctmpawhfmyb`, ambiente `sandbox`, 17 migrations. A publicação usa o conteúdo atual do workspace; nenhuma alteração foi commitada/enviada ao GitHub nesta rodada.

## Entregue e verificado

- Build padrão conectado, demonstração por comando explícito, build hospedado com validação HTTPS/referência/chave pública. Bundle e fontes para publicação examinados sem segredos privados ou módulos/sessões de mocks.
- Banco e funções alinhados com suporte, visão geral, economia e gestão de assinatura. Dados preservados; sem seeds/reset remoto. Suporte existente teve estrutura/funções comparadas antes de reconciliar o histórico.
- Publicação das seis funções e configuração de OTP, ClickSend, Resend, Stripe de teste e worker. CPF protegido, fotos privadas e permissões permanecem no servidor.
- Conta e preço Stripe conferidos: R$ 69,90/mês, modo teste. Webhook criado com dez eventos, assinatura verificada por evento sem efeito financeiro. Worker respondeu HTTP 200 sem falhas e foi agendado a cada cinco minutos com bearer no Vault.
- Credencial ClickSend autenticada; um SMS de teste foi aceito com status individual SUCCESS e o usuário confirmou recebimento no aparelho. Homologação liberada para qualquer e-mail/celular brasileiro por autorização explícita do usuário (D32). Backend hospedado aceitou uma solicitação de OTP de e-mail; usuário confirmou recebimento de e-mails de teste.
- Typecheck, 64 testes Node, lint SQL e 235 verificações pgTAP passaram. Testes locais de API, OTP/sessão, cadastro/foto, Edge, UI e PWA offline passaram. Atualização real do service worker também foi testada: aviso, confirmação e recarga da versão nova. Smoke HTTPS comprovou chamadas ao projeto correto, rotas, ausência de mocks, recusa de RPCs privadas e erro visível em falha da rede de parceiros.

O banco hospedado começou e terminou a verificação sem associados, parceiros ou assinaturas. Cadastrar a operação pelo administrador existente; telas vazias são esperadas. Os testes com fixtures pagas ocorreram exclusivamente no Docker local.

## Aceite pendente na homologação

- Concluir a jornada integrada e-mail → SMS → dados/aceites → foto → pagamento de teste no site hospedado. Entrega isolada de SMS/e-mail já confirmada.
- Comprovar pagamento, renovação, falha, recuperação, cancelamento/reativação e ausência de duplicidade com eventos reais Stripe de teste. Webhook configurado não equivale a pagamento homologado.
- Conferir portal Billing, recuperação D+0/D+1/D+3 e destinatário Connect Wedea. O identificador Wedea ainda não está configurado; não há teste de repasse real.
- Revisar configurações Auth hospedadas e hooks legados para impedir caminhos alternativos de OTP. O motor novo já recusa uso dos hooks nativos RKMED.
- Homologar permissões e operação com os responsáveis e aparelhos Android/iPhone físicos via HTTPS, incluindo câmera, instalação e atualização da PWA.

## Bloqueios para lançamento comercial

- Ambiente de produção separado, suporte explícito a produção nos runtimes, segredos live e isolamento de previews. Os bloqueios atuais foram preservados.
- Documentos jurídicos finais, retenção/exclusão, atendimento e conteúdo operacional aprovados. Os documentos atuais são de teste e não servem para produção.
- Monitoramento e alertas; backup de banco **e fotos** com restauração ensaiada, responsáveis e procedimentos de recuperação.
- Revisar avisos legados de segurança: `search_path` mutável, grants de funções definer, prazo do OTP nativo e proteção de senhas. Tabelas privadas com RLS sem políticas mantêm negação direta intencional; RPCs públicas de documentos/parceiros são deliberadas.
- Validar desempenho hospedado e configuração fiscal com os responsáveis. Stripe Tax continua desabilitado; nenhum registro fiscal foi presumido.

Critério de liberação: todos os itens de aceite e bloqueios acima precisam de evidência. Não usar o sucesso de testes locais ou o deploy da Vercel como substituto dessa validação.
