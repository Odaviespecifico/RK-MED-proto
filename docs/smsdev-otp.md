# SMS Dev e OTP independente da RKMED

O motor de códigos pertence à RKMED para **SMS e e-mail**. SMS Dev e Resend apenas entregam mensagens. Não configurar um provedor SMS no Supabase para este fluxo.

## Responsabilidades

- `otp-crypto.ts`: código criptográfico uniforme de seis dígitos e HMAC SHA-256, vinculado ao desafio.
- `otp-service.ts`: emissão, envio, vínculo de contato/finalidade/conta e autorização após validação.
- `private.otp_challenges` e RPCs somente de serviço: validade de 5 minutos, cooldown de 60s, até 5 pedidos/hora/contato, 5 tentativas por desafio e 10 tentativas/hora/contato. Verificação e consumo atômicos; erros de código contam mesmo quando recusados. Reenvio invalida o desafio anterior.
- `providers/smsdev.ts`: POST JSON para `https://api.smsdev.com.br/v1/send`, `type=9`, destinatário brasileiro normalizado, mensagem curta e `refer` igual ao ID do desafio. Chave somente no corpo do POST; não usar GET com credenciais na URL.
- `session-bridge.ts`: após a RKMED validar seu código, troca a identidade já comprovada por sessão Supabase com access/refresh tokens. Gera/resgata um magic link **interno**, sem enviá-lo ou devolvê-lo ao usuário. O código digitado pelo associado nunca é passado ao Supabase. Esse adaptador é a única dependência do mecanismo de sessão; o motor de OTP não depende dele.

O retorno `situacao=OK`, `codigo=1` e `id` válido identifica aceitação pela API SMS Dev, não recebimento pelo aparelho. O ID é guardado privadamente para correlação futura. `refer` não é garantia de idempotência: timeout não provoca reenvio automático. Falha de envio deixa o desafio inutilizável; o usuário aguarda para solicitar outro. Não são enviados lotes nem mensagens agendadas para OTP.

Referência do contrato: [documentação oficial SMS Dev](https://www.smsdev.com.br/envio-sms/).

## Configurar testes

Os campos existem no template de `scripts/env/files.mjs`. Use `.env.test` para execução local e o gerenciador de segredos das Edge Functions para o servidor. Arquivos locais não são publicados automaticamente.

```dotenv
APP_ENV=sandbox
APP_ORIGIN=https://rk-med-proto.vercel.app
OTP_HMAC_SECRET=<segredo aleatório de pelo menos 32 caracteres>
SMSDEV_MODE=test
SMSDEV_API_KEY=<chave privada SMS Dev>
SMS_ALLOWED_TEST_NUMBERS=+5581999990001
RESEND_MODE=transactional-sandbox
RESEND_API_KEY=<chave privada Resend>
RESEND_FROM=<remetente autorizado>
RESEND_ALLOWED_TEST_EMAILS=<emails de teste autorizados, separados por vírgula>
```

Em Docker local, usar `APP_ENV=local` e a origem real de testes, normalmente `http://127.0.0.1:5174`. Os adaptadores recusam produção nesta versão. Não prefixar segredos com `VITE_`. Manter o segredo HMAC estável entre instâncias; sua troca invalida desafios pendentes. `SMS_MODE=supabase-native`, `AUTH_SMS_HOOK_SECRET` e `AUTH_EMAIL_HOOK_SECRET` não são usados pelo motor novo.

Não enviar a chave no chat ou versioná-la. Sem segredo HMAC/configuração de transporte, o endpoint recusa a operação e não simula sucesso. SMS reais podem consumir créditos; os testes automatizados usam transporte simulado.

Revisar o Auth hospedado para retirar os transportes nativos antigos. Os handlers RKMED `auth-sms`/`auth-email` agora recusam entrega nativa; apontar os hooks nativos para esses bloqueadores impede o caminho antigo de envio. Isso não impede o resgate interno do adaptador de sessão. Funções legadas de outro fluxo continuam preservadas; suas configurações não foram automaticamente trocadas. Validar também as rotas públicas nativas do Auth antes de considerar fechado todo caminho alternativo.

## Fluxos

1. Cadastro: pedir OTP de e-mail com finalidade `signup`; validar na RKMED, criar/confirmar a identidade e estabelecer sessão. Pedir SMS com finalidade `attach`, autenticado nessa mesma sessão; validar e vincular o celular à mesma conta. Só então concluir dados, aceites e foto.
2. Login: pedir/validar código próprio por SMS ou e-mail com finalidade `login`; apenas contatos já verificados dão acesso à conta correspondente. Contato desconhecido não recebe código utilizável. Perfis internos continuam usando senha, sem rebaixar autenticação para OTP de membro.
3. Reenvio: novo desafio após o cooldown; código anterior deixa de funcionar. Recarregar a página perde o identificador transitório do desafio e exige nova solicitação, respeitando o limite do servidor.
4. Vincular telefone ocupado por outra conta falha; não fundir identidades. Em falha posterior ao consumo do código, solicitar novo desafio; não reutilizar um código já gasto para tentar emitir sessões novamente.

Chaves de transporte, códigos, números completos e tokens de sessão não entram em logs. O banco guarda HMAC do contato/código e ID de provedor; os contatos de cadastro continuam restritos à identidade já existente.

## Verificações

```bash
npm run typecheck
npm test
npm run db:lint
npm run db:test
node --experimental-strip-types tests/connected/otp.mjs
```

A última verificação requer Supabase Docker local e fixtures, usa entrega capturada em memória, cria uma sessão real e encerra-a ao terminar. Não envia SMS/e-mail. O harness antigo com OTP fixo `482913` não testa o motor novo.

A migration `20261108204032_independent_otp` foi aplicada localmente e no projeto de testes `chuyompxoctmpawhfmyb`. `phone-code` está na versão 5, `auth-sms` na versão 4 e `auth-email` na versão 3 desta implantação. O frontend precisa ser publicado com o código atual para usar o novo contrato. Credenciais de SMS Dev/Resend e o recebimento real ainda não foram homologados.
