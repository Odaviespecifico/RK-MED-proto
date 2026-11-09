# ClickSend e OTP da RKMED

Decisão D31, 09/11/2026. ClickSend substitui SMS Dev no gateway `phone-code`. A RKMED gera códigos criptográficos de seis dígitos, armazena HMACs e valida finalidade, contato e identidade. Supabase mantém as sessões; Resend entrega os códigos de e-mail. Não configurar SMS nativo ou WhatsApp para esse fluxo.

## Configuração privada

Usar `.env.test` local e segredos das Edge Functions no servidor:

```dotenv
APP_ENV=sandbox
APP_ORIGIN=https://rk-med-proto.vercel.app
OTP_HMAC_SECRET=<segredo estável de pelo menos 32 caracteres>
CLICKSEND_MODE=test
CLICKSEND_USERNAME=<usuário da API>
CLICKSEND_API_KEY=<chave privada>
SMS_ALLOWED_TEST_NUMBERS=*
RESEND_MODE=transactional-sandbox
RESEND_API_KEY=<chave de envio>
RESEND_FROM=<remetente autorizado>
RESEND_ALLOWED_TEST_EMAILS=*
```

Em Docker local usar `APP_ENV=local` e a origem local configurada. Nenhuma credencial deve receber prefixo `VITE_`. Produção comercial permanece desabilitada. Arquivos privados não são enviados automaticamente ao Supabase.

O usuário autorizou qualquer e-mail/celular brasileiro em homologação (D32). `*` libera explicitamente todos os contatos válidos. Também é possível usar listas separadas por vírgula; vazio continua recusando envios. Essa autorização não habilita produção nem cobrança live.

## Transporte e limites

O adaptador faz um POST JSON em `https://rest.clicksend.com/v3/sms/send`, usando Basic Auth com usuário/chave no header. Cada requisição contém uma mensagem curta, sem URL, para um destinatário válido. O ID do desafio vai em `custom_string`, apenas para correlação. O remetente usa a configuração padrão da conta ClickSend.

O servidor exige `response_code=SUCCESS`, uma mensagem com `status=SUCCESS`, o destinatário esperado e um `message_id` válido. HTTP 200 sozinho não basta. O identificador do provedor fica privado. Aceitação na fila não comprova entrega no aparelho.

Timeouts não provocam repetição automática: `custom_string` não garante idempotência. Falha inutiliza o desafio. Os limites existentes permanecem: validade de cinco minutos, reenvio após 60s, cinco solicitações/hora/contato, cinco tentativas/desafio e dez tentativas/hora/contato. O consumo é atômico e único.

Cadastro verifica e-mail e depois celular na mesma identidade. Login posterior aceita o canal escolhido. OTPs, contatos completos, headers de autenticação e respostas integrais dos provedores não entram em logs.

## Verificação

A credencial ClickSend foi autenticada por consulta de conta (HTTP 200). Um único SMS de teste de integração foi enviado ao celular anteriormente configurado para homologação: HTTP 200, status individual SUCCESS, ID `1F1DC656-C54E-6E98-A242-83AD82EB9C00`. Aceitação não equivale a entrega. Testes automatizados cobrem sucesso, destinatário recusado, modo desabilitado/live, falha por mensagem com HTTP 200, JSON inválido, timeout, resposta para outro número e ausência de repetição/vazamento. Ainda é necessário comprovar o recebimento em celular autorizado pela jornada de cadastro.

O Resend aceitou a emissão de um OTP no endpoint hospedado; o usuário confirmou recebimento de e-mails de teste. Chaves Resend com permissão somente de envio retornam `restricted_api_key` em consultas de domínios; essa resposta não diagnostica falha de envio.

Referências: [API SMS ClickSend](https://developers.clicksend.com/docs/messaging/sms), [autenticação](https://developers.clicksend.com/docs/), [permissões Resend](https://resend.com/changelog/new-api-key-permissions).

Consulta imediata do recibo desse SMS retornou `404 NOT_FOUND`; portanto o registro comprova aceitação de envio, ainda sem comprovante de entrega da operadora.

**Aceite de entrega — 09/11/2026:** o usuário confirmou que o SMS de teste chegou ao celular. Transporte real validado; a jornada integrada de cadastro/assinatura permanece uma verificação separada.
