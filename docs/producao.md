# Entrada em produção RKMED

Estado em 09/11/2026: a homologação https://rk-med-proto.vercel.app já consulta Supabase hospedado real. Não é produção comercial. A lista de evidências e bloqueios atual fica em [prontidão](prontidao-producao.md).

## Concluir homologação

1. Cadastrar parceiros, funcionários e acessos pelo administrador existente. O banco hospedado não recebeu fixtures; listas vazias são esperadas.
2. Criar associado com e-mail diferente de contas internas. O cadastro aceita qualquer e-mail/celular brasileiro, conforme autorização do usuário; o OTP é próprio da RKMED, entregue por Resend/ClickSend. Ver [configuração atual](clicksend-otp.md).
3. Comprovar recebimento dos dois códigos, cadastro retomável, dados/aceites, foto privada e Checkout de teste.
4. Efetuar pagamentos de teste e conferir webhook, elegibilidade, falha, recuperação, cancelamento/reativação, cobranças manuais e duplicidade. Stripe Tax está desabilitado; configuração fiscal requer validação dos responsáveis.
5. Conferir portal Billing, recuperação D+0/D+1/D+3, destinatário Connect Wedea e alertas/outbox. Não confundir webhook configurado, e-mail aceito ou saldo Stripe com pagamento/repasse homologado.
6. Revisar Auth hospedado/hooks antigos e os avisos legados de permissões/search_path. Testar recusa de acesso anônimo, cruzamento de associados/parceiros e alterações pela diretoria.
7. Testar câmera, instalação, atualização, recarga offline e limpeza de sessão em Android/iPhone físicos via HTTPS.

## Preparar o lançamento comercial

- Aprovar termos/privacidade/foto, cancelamento, retenção/exclusão, suporte e conteúdo real. Documentos atuais de teste não podem ser aceitos em produção.
- Preparar backend de produção separado e implementar sua configuração explícita no código. Frontend/Edge/transporte atuais recusam produção; não remover guardas para reaproveitar credenciais de teste.
- Revisar capacidade, acesso operacional, monitoramento, rate limits e alertas. Ensaiar restauração de banco **e objetos Storage** com responsáveis e objetivos de recuperação.
- Aplicar migrations revisadas e publicar funções compatíveis, sem seed/reset. Segredos live, IDs/preços/webhook/portal e domínio devem pertencer ao ambiente correto. Previews apontam para homologação.
- Configurar somente URL/referência/chave publicável no frontend. Conferir bundle sem segredos/mocks e excluir dados sintéticos antes de abrir cadastro comercial.
- Registrar versão publicada, evidências de aceite e procedimento de reversão do frontend. Correções do banco usam migrations novas; voltar o frontend não desfaz schema.

## Publicação atual

A Vercel usa `npm ci`, `npm run build:hosted`, saída `dist` e raiz do repositório. O target estável chamado `production` pela Vercel continua executando o sandbox RKMED. `build:prod` segue reservado/bloqueado.

O Supabase de homologação tem 17 migrations, seis funções atuais, bucket privado e worker agendado. O script [schedule-jobs.sql](../scripts/deploy/schedule-jobs.sql) depende de `rkmed_jobs_secret` no Vault e preserva o cron legado. Não gravar bearer no comando cron ou em arquivos versionados.

Referências: [Supabase em produção](https://supabase.com/docs/guides/deployment/going-into-prod), [backups](https://supabase.com/docs/guides/platform/backups), [Stripe go-live](https://docs.stripe.com/get-started/checklist/go-live).
