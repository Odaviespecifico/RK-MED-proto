# Prontidão para produção — 09/11/2026

**Resultado:** homologação publicada e conectada ao banco real. Produção comercial ainda não liberada.

Frontend: https://rk-med-proto.vercel.app — deploy `dpl_J2pbGLG1qTctsJ6Xhg1LHYhy8qa6`. Backend: projeto Supabase `chuyompxoctmpawhfmyb`, ambiente `sandbox`, 20 migrations. A publicação usa o conteúdo atual do workspace; nenhuma alteração foi commitada/enviada ao GitHub nesta rodada.

## Entregue e verificado

- Build padrão conectado, demonstração por comando explícito, build hospedado com validação HTTPS/referência/chave pública. Bundle e fontes para publicação examinados sem segredos privados ou módulos/sessões de mocks.
- Banco e funções alinhados com suporte, visão geral, economia e gestão de assinatura. Dados preservados; sem seeds/reset remoto. Suporte existente teve estrutura/funções comparadas antes de reconciliar o histórico.
- Publicação das seis funções e configuração de OTP, ClickSend, Resend, Stripe de teste e worker. CPF protegido, fotos privadas e permissões permanecem no servidor.
- Conta e preço Stripe conferidos: R$ 69,90/mês, modo teste. Webhook criado com dez eventos, assinatura verificada por evento sem efeito financeiro. Worker respondeu HTTP 200 sem falhas e foi agendado a cada cinco minutos com bearer no Vault.
- Credencial ClickSend autenticada; um SMS de teste foi aceito com status individual SUCCESS e o usuário confirmou recebimento no aparelho. Homologação liberada para qualquer e-mail/celular brasileiro por autorização explícita do usuário (D32). Backend hospedado aceitou uma solicitação de OTP de e-mail; usuário confirmou recebimento de e-mails de teste.
- Typecheck, 83 testes Node, lint SQL e 297 verificações pgTAP passaram. Testes locais de API, OTP/sessão, cadastro/foto, Edge, UI e PWA offline passaram. Atualização real do service worker também foi testada: aviso, confirmação e recarga da versão nova. Smoke HTTPS comprovou chamadas ao projeto correto, rotas, ausência de mocks, recusa de RPCs privadas e erro visível em falha da rede de parceiros.

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

D33: início de turno exige código do estabelecimento e do funcionário, com validação contra o parceiro autenticado. Códigos visíveis somente na gestão autorizada de parceiros; seleção livre removida.

D34: mapas incorporados por endereço disponíveis nas visões de parceiros, com expansão individual, controles interativos, comportamento offline e carregamento sob demanda. Precisão depende do endereço informado e do provedor.

D35/D36: suporte com histórico próprio do associado, resposta e encerramento, fila de e-mail e repetição controlada de falhas; gestão de acessos internos com busca/paginação, perfil, vínculo de estabelecimento, ativação/desativação, redefinição de senha e auditoria. Operações administrativas exclusivas de admin, com motivo, confirmação e controle de revisão concorrente. Sessões anteriores perdem autorização na aplicação após mudanças efetivas/redefinição. Validação adicional com Auth/Postgres reais locais e navegador a 360px aprovada. Não foi enviado e-mail de suporte para associado hospedado, pois ainda não há associados reais cadastrados nesse ambiente; transporte/worker e histórico foram verificados localmente.

Publicação D35/D36: Vercel READY no domínio estável, migration aplicada sem seeds/reset, três handlers atualizados e smoke HTTPS aprovado. Análise hospedada aponta avisos conhecidos de objetos legados e das RPCs security definer intencionalmente expostas a authenticated; as novas RPCs verificam papel/sessão no servidor e as rotinas de credenciais/destinatários permanecem exclusivas de service_role. Avisos legados e configurações Auth continuam na lista de preparação comercial acima.

D37: cadastro completo de parceiro de teste em Admin → Parceiros, exclusivo de admin e somente local/sandbox. Cria estabelecimento ativo oculto dos associados, conta Auth e primeiro funcionário. Marca de teste preservada na gestão; contexto do próprio parceiro permite identificação e mapa sem expô-lo no diretório público. Operação recuperável por reserva privada, com finalização transacional, repetição controlada e bloqueio de identidades pendentes. Credenciais não entram em auditoria ou armazenamento persistente do navegador.

Publicação D37: migration 20261109201327 aplicada sem seeds/reset (20 migrations), gateway rkmed-api atualizado e Vercel `dpl_J2pbGLG1qTctsJ6Xhg1LHYhy8qa6` READY no domínio estável. Confirmados RLS da reserva e ausência de EXECUTE para navegadores nas rotinas privilegiadas; análise hospedada manteve 49 avisos conhecidos, sem novos avisos nos objetos test_partner. Fluxo completo e falha/recuperação verificados com Auth/Edge/Postgres reais locais e navegador a 360px. Nenhuma conta/parceiro sintético inserido no ambiente hospedado durante a publicação.

D37 smoke HTTPS aprovado após publicação: rotas públicas conectadas, recusa anônima das novas rotinas de finalização/liberação e ausência de mocks. Nenhum OTP, pagamento ou cadastro hospedado disparado.
