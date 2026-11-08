> **OTP atual:** códigos de SMS/e-mail são gerados e validados pela RKMED. SMS Dev é somente transporte. Configuração e limites: [integração SMS Dev](smsdev-otp.md). A configuração de SMS nativo mencionada abaixo foi substituída por D29.

# Decisão vigente: OTP de telefone por SMS

A decisão atual substitui WhatsApp por SMS. Login oferece SMS ou e-mail; primeiro cadastro verifica ambos. O envio usa o provedor nativo configurado no Supabase Auth, com `SMS_MODE=supabase-native` e `SMS_ALLOWED_TEST_NUMBERS` no gateway. Desativar o hook Send SMS legado antes de habilitar o provedor nativo. Credenciais e entrega externa ainda precisam de configuração/aceite; referências a WhatsApp abaixo são históricas.

# Supabase RKMED — implantação para testes

Atualizado em 08/11/2026. Backend publicado por solicitação explícita do usuário.

| Configuração | Valor |
| --- | --- |
| Projeto | `chuyompxoctmpawhfmyb` |
| API | `https://chuyompxoctmpawhfmyb.supabase.co` |
| Frontend autorizado | `https://rk-med-proto.vercel.app` |
| Ambiente do domínio | `sandbox` |
| Primeiro administrador | Conta existente e verificada `jak_singer@hotmail.com` |

## Banco e arquivos

Aplicadas as 12 migrations versionadas do repositório, de `20261006140000_bootstrap` até `20261108190000_wedea_revenue_share`. O MCP gerou timestamps de implantação; o histórico foi alinhado aos identificadores originais dos arquivos para evitar reaplicação pela CLI.

Verificado no servidor: 23 tabelas privadas, todas com RLS; nenhuma delas legível diretamente por `anon`/`authenticated`. RPCs de serviço e atribuição de perfis não podem ser executadas por clientes. A publicação Realtime inclui apenas `rk_operational_signal` para os novos fluxos. O bucket `member-photos` é privado, aceita JPEG e limita arquivos a 5 MiB.

Carregados os três documentos atuais de `docs/legal-mocks/`, nas versões `test-terms-2026-11-08`, `test-privacy-2026-11-08` e `test-photo-2026-11-08`, com `test_only=true` e o aviso obrigatório de texto gerado por IA. Não representam documentos aprovados para produção.

A atribuição inicial de administrador foi feita pelo operador autorizado e registrada em auditoria como `role.bootstrap`. A senha e as sessões existentes não foram alteradas. Nenhuma conta Docker, OTP fixo, CPF de fixture ou assinatura artificialmente paga foi copiada. O domínio começa sem associados, compras ou parceiros; eles devem ser cadastrados para os cenários de teste.

## Funções publicadas

Todas as seis funções estão `ACTIVE`, versão 2 nesta rodada:

| Função | Responsabilidade |
| --- | --- |
| `rkmed-api` | Foto, acessos internos e comandos autenticados de assinatura/cobrança |
| `rkmed-stripe-webhook` | Novo webhook RKMED, com assinatura Stripe e eventos de teste |
| `phone-code` | Gateway de OTP por WhatsApp, com origem, destinatários autorizados e limites |
| `auth-sms` | Hook assinado de OTP de telefone; nome do protocolo Supabase, sem entrega por SMS |
| `auth-email` | Hook assinado de e-mail |
| `provider-jobs` | Conciliação, notificações e repasses, protegido por bearer privado |

O gateway JWT da plataforma está desabilitado nessas funções porque os handlers verificam sessão/perfil, assinatura do provedor/hook ou bearer de jobs. Isso não concede acesso anônimo às operações.

Os cinco endpoints legados, o bucket `user_pictures`, a conta existente, o schema Stripe e o cron antigo foram preservados. O novo webhook possui nome próprio para não substituir a integração anterior. O endpoint a configurar para **os novos fluxos** é:

```text
https://chuyompxoctmpawhfmyb.supabase.co/functions/v1/rkmed-stripe-webhook
```

## Empacotamento reproduzível

```bash
node scripts/dev/package-functions.mjs /tmp/rkmed-function-packages https://rk-med-proto.vercel.app
```

O comando apenas gera seis arquivos JSON de entrada para `deploy_edge_function` do MCP; não publica por conta própria e não inclui arquivos `.env`. O argumento de origem é obrigatório para reproduzir a configuração pública desta implantação. Sem ele, o pacote mantém a leitura normal das variáveis do servidor.

O pacote hospedado fixa `APP_ENV=sandbox` e `APP_ORIGIN=https://rk-med-proto.vercel.app`; os demais valores vêm do ambiente Supabase. Nenhuma chave de provedor é incorporada. O código-fonte local continua usando as variáveis locais normalmente.

O modelo facial é incorporado como módulo textual com manifesto e pesos base64, preservando os bytes originais: o MCP transporta arquivos de texto. O leitor é injetado em `sanitizePhoto`; validação de rosto, dimensões, tamanho e remoção de metadados continuam no backend. O import TensorFlow foi limitado a core + backend CPU em versões fixas, resolvendo o erro de bundle hospedado que ocorria com o pacote completo.

## Verificações realizadas

- Typecheck e build sandbox passaram após o ajuste de import.
- Os 47 testes Node passaram, incluindo aceitação de rosto, rejeição de imagem sem rosto e remoção de metadados.
- As 192 verificações SQL passaram no Docker local na preparação desta implantação; não foram anunciadas como execução da suíte inteira no projeto hospedado.
- No servidor: histórico das 12 migrations, RLS/grants, bucket privado e publicação Realtime foram conferidos.
- Contexto de administrador, consulta paginada de associados/compras e resumo operacional foram exercitados com uma sessão SQL temporária, totalmente revertida ao final. Isso valida autorização no banco, não substitui login pelo navegador.
- Doze verificações HTTPS passaram: parceiros/documentos públicos, recusa de três RPCs privados, recusa explícita das seis funções sem autenticação/configuração e preflight CORS da origem autorizada.

Respostas observadas após configuração da origem:

| Verificação | HTTP |
| --- | --- |
| `rk_partners`, `rk_documents` | 200 |
| `rk_context`, `rk_backend_pending`, `rk_wedea_pending` sem sessão | 401 |
| `rkmed-api` sem sessão | 401 |
| `rkmed-api` OPTIONS da origem autorizada | 200 |
| `phone-code` com corpo vazio | 400 |
| Hooks `auth-email`/`auth-sms`, webhook sem configuração | 503 |
| `provider-jobs` sem bearer | 403 |

## Pendências para testar a jornada completa

1. Confirmar/publicar o frontend conectado a este projeto. Esta rodada não publicou a Vercel nem mudou as variáveis daquele projeto. O frontend deve compilar com `VITE_APP_MODE=sandbox`, `VITE_APP_ENV=sandbox`, URL acima, `VITE_SUPABASE_PROJECT_REF=chuyompxoctmpawhfmyb` e chave publicável ativa do projeto. Nunca usar chave de serviço em `VITE_*`. Validar no navegador que o site usa o backend conectado.
2. Conferir Site URL/redirects, templates e hooks do Auth remoto. O arquivo `supabase/config.toml` local não foi enviado como configuração global hospedada. Não ativar hooks antes de configurar segredos/transportes.
3. Configurar o catálogo/conta Stripe de teste, segredo de webhook, portal, conta Wedea e recuperação D+0/1/3 conforme [homologação](homologacao.md#cadastro-e-pagamento) e [Wedea](wedea-connect.md). O webhook novo ainda recusa execução sem configuração. As chaves existentes dos endpoints legados não foram exibidas, copiadas ou alteradas.
4. Concluir a migração para WhatsApp oficial da Meta e configurar destinatários de teste autorizados. O código de transporte legado continua pendente sob D26; não habilitar Twilio ou SMS para contornar essa pendência.
5. Configurar Resend e segredos de hooks/jobs; depois agendar o worker novo com autenticação, sem duplicar a recuperação financeira da Stripe. Nenhum cron novo foi ativado nesta rodada.
6. Entrar com o administrador informado usando sua senha existente em `/acesso-admin`, na versão conectada. Criar parceiros/funcionários e demais acessos pelos fluxos autorizados. Não há senha padrão hospedada.
7. Executar [o checklist manual](../tests/test.md), incluindo pagamento de teste, comunicação, câmera e instalação em aparelhos físicos HTTPS. Pagamento/mensagem externos não foram executados nesta implantação.

Os advisors registram avisos preexistentes em funções legadas com `search_path` mutável, grants de execução de funções definer e configuração de Auth (OTP longo/proteção contra senhas vazadas). Esses objetos/configurações não foram removidos ou reconfigurados nesta rodada. Revisar [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [grants de funções](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) e [segurança de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) antes de aceitação completa. Os novos avisos informativos de tabelas privadas sem política são intencionais: acesso direto negado, com operações restritas às RPCs verificadas. A execução autenticada das RPCs RKMED é deliberada e inclui autorização no servidor.

Backend implantado para testes não equivale a frontend atualizado, provedores homologados ou prontidão para produção.
