# Desenvolvimento RKMED

React/Vite/TypeScript, Supabase PostgreSQL/Auth/Storage e Edge Functions. O site https://rk-med-proto.vercel.app usa o Supabase hospedado de homologação. [Prontidão e pendências](prontidao-producao.md).

## Rodar com banco real local

Requer Node 22+, npm e Docker. Na raiz:

```bash
npm ci
npm run db:start
npm run local:prepare
npm run dev:sandbox
# Outro terminal:
npm run functions:serve
```

A aplicação conectada abre em http://127.0.0.1:5174. `npm run dev` também usa o modo conectado, normalmente em 5173; ajustar `APP_ORIGIN` local se usar OTP ou comandos Edge nessa origem. Studio: 54323; Mailpit: 54324. Consultar as contas sintéticas no registro de [homologação](homologacao.md). Nunca copiar seeds/senhas/OTP fixos para o projeto hospedado.

`db:reset` apaga exclusivamente o banco Docker local. Não usar reset contra homologação/produção. Os testes `connected` verificam a origem local antes de acessar credenciais privilegiadas.

## Build e demonstração

| Comando | Resultado |
| --- | --- |
| `dev` / `build` | Frontend conectado, Supabase de `.env.test`; build em `dist` |
| `dev:sandbox` / `build:sandbox` | Conectado em 5174 / artefato em `dist-sandbox` |
| `build:hosted` | Conectado a Supabase remoto HTTPS; saída `dist`; comando da Vercel |
| `dev:demo` / `build:demo` | Demonstração isolada; build em `dist-demo` |
| `build:prod` | Reservado; produção comercial ainda recusada pelo runtime |

A demonstração usa `src/mocks`. O build conectado elimina seu módulo e não consulta suas sessões, não retorna fixtures e não simula pagamento ou envio bem-sucedido. Testes `flows.mjs`/`mobile-layout.mjs` antigos usam `dev:demo` em 5173. Testes `connected/ui.mjs` e `sandbox-ui.mjs` usam 5174. Offline conectado usa preview em 4174.

## Ambientes e publicação

Somente `.env.test` e `.env.prod`, privados/ignorados. `env:init` cria templates sem sobrescrever arquivos existentes. Vite lê um arquivo explícito e expõe somente `VITE_*`; variáveis do processo prevalecem. Ver [ambientes](ambientes.md).

Na Vercel, configurar `VITE_APP_MODE=sandbox`, `VITE_APP_ENV=sandbox`, URL/chave publicável/referência do projeto de testes. O build hospedado força sandbox e recusa URL local/projeto divergente. A referência confere o destino; não comprova isolamento administrativo da conta. Segredos ficam exclusivamente nas Edge Functions. Não há dependência de `.env.test` versionado para compilar na nuvem.

As funções são empacotadas com `scripts/dev/package-functions.mjs`, preservando o nome `rkmed-stripe-webhook` para não substituir o webhook legado. Sem origem explícita, o pacote lê as variáveis de servidor normalmente; com origem HTTPS, fixa apenas o roteamento público da homologação. Não usar esse pacote de sandbox em produção.

## Cadastro e provedores

[ClickSend e OTP](clicksend-otp.md) descreve o contrato atual. A RKMED emite/verifica os dois códigos. Supabase só mantém identidade/sessão; não há OTP nativo, WhatsApp ou PIN no fluxo atual. Cadastro exige e-mail e celular na mesma identidade, dados/aceites, foto privada validada e Checkout. O retorno do Checkout nunca ativa benefício.

Por solicitação do usuário em 09/11, homologação aceita qualquer e-mail e celular brasileiro: as duas listas usam `*` explícito. Defaults vazios continuam bloqueando envio. Limites, consumo único e validação dos contatos continuam ativos. Usar e-mail distinto de contas internas para cadastrar associado; perfis não são convertidos automaticamente.

Stripe continua somente em teste. Worker concilia e processa a outbox a cada cinco minutos no hospedado, com bearer no Vault. Não criar outro agendador para repetir cobranças: recuperação D+0/D+1/D+3 pertence ao Stripe Billing. Stripe Tax permanece desabilitado.

## Verificações

```bash
npm run typecheck
npm test
npm run db:lint
npm run db:test
npm run test:connected:api
npm run test:connected:enrollment
npm run test:connected:ui
npm run build:sandbox
npm run preview -- --port 4174 --outDir dist-sandbox
# Outro terminal:
npm run test:connected:offline
node tests/pwa-update.mjs
```

`tests/hosted/smoke.mjs` exige `RKMED_HOSTED_KEY` publicável; consulta apenas homologação e não envia OTP nem cria pagamentos. Os testes conectados usam fixtures locais. Com provedores configurados, o teste de cadastro pode criar uma sessão Checkout de teste; não efetua pagamento. Não tratar transporte injetado, câmera emulada ou teste local como aceite em aparelho/provedor real.


## Entrada de funcionário

Depois do login da conta do parceiro, informar **Código do estabelecimento** e **Código do funcionário**. O servidor aceita somente o estabelecimento vinculado à conta autenticada e funcionário ativo desse parceiro; não existe seleção livre. Administração/suporte consulta o código gerado na aba Parceiros. O código de dez caracteres identifica a unidade e não substitui a senha. Trocar funcionário encerra o turno e solicita os dois códigos novamente.

Na demonstração, a unidade inicial usa `RKMED00001` e a funcionária inicial usa `2468`. Esses valores são exclusivamente sintéticos. A demonstração mantém migração de dados locais antigos e gera código para novos parceiros. No banco real os códigos são gerados automaticamente, não recebem defaults de fixture.


## Mapas dos parceiros

Cartões e listas de parceiros oferecem **Ver no mapa** dentro da tela, inclusive gestão e área do próprio parceiro. O endereço cadastrado alimenta o mapa incorporado. `VITE_GOOGLE_MAPS_EMBED_KEY` continua opcional: com chave, usa Maps Embed API; sem chave, usa a incorporação pública por endereço. O link externo é uma opção adicional.

Mapas individuais só carregam ao abrir e são removidos ao fechar. O mapa agregado permite selecionar um parceiro. Sem conexão, não há iframe: o endereço fica disponível com orientação para reconectar. Respostas do Google não são adicionadas ao cache da PWA. Código do estabelecimento, funcionário, contatos de associados e dados de sessão não compõem URLs de mapa.

Verificar com `node tests/partner-maps.mjs` (dev:demo em 5173 e dev:sandbox em 5174). Esse teste isola o transporte Google e cobre telas, teclado, troca de parceiro, offline e largura 360px; o carregamento real do provedor foi conferido separadamente. A precisão depende do endereço cadastrado e da resolução do provedor.

## Suporte e acessos internos

Em **Conta → Meus atendimentos**, o associado consulta mensagens/respostas e encerra solicitações. Em **Admin → Suporte**, admin/suporte respondem e acompanham a fila: aguardando, falha ou aceito pelo provedor. Reenvio manual só está disponível em falhas; o worker agendado processa a fila automaticamente. Encerramento preserva resposta e histórico; não cancela uma resposta já enfileirada. Suporte não depende da Stripe para enviar e-mail.

Em **Admin → Equipe → Acessos internos**, admin busca contas, altera perfil/estabelecimento/situação, redefine senha e consulta auditoria. Senha inicial e nova senha têm 12–128 caracteres e são comunicadas ao responsável por canal seguro; o sistema não envia senhas por e-mail. A própria conta exige outro administrador para alterações. Desativação/alteração/redefinição bloqueiam as sessões anteriores nas RPCs da aplicação. A reativação exige novo login. Contas de associados não aparecem nessa gestão.

Verificação local adicional: `node --experimental-strip-types tests/connected/staff-access.mjs` usa Auth/RPC reais e remove sua identidade sintética; `node tests/connected/support-staff-ui.mjs` exige `dev:sandbox`, testa a 360px e remove seu atendimento/fila sintéticos. Ambos aceitam somente Docker local. Testes de transporte injetam o provedor e não enviam mensagens reais.

## Criar parceiro de teste na homologação

Entre como administrador e abra **Parceiros → Criar parceiro de teste**. Preencha estabelecimento, desconto, e-mail/senha e primeiro funcionário/código. Revise e confirme. Guarde a senha e o código do funcionário: o resultado mostra somente o e-mail e o código do estabelecimento. Entre por **Acesso da equipe** com e-mail/senha; no balcão, informe os códigos do estabelecimento e do funcionário.

O parceiro fica ativo e marcado como teste na gestão; não aparece na landing, no diretório ou nos mapas dos associados. Sua conta aparece em **Equipe → Acessos internos**, onde pode ser desativada ou ter a senha redefinida. Cadastro e compras continuam no banco real de homologação, sujeitos às regras normais de elegibilidade; não se cria associado pago nem se habilita cobrança live.

Se houver interrupção, use **Verificar e concluir cadastro**. Após recarregar a página, o mesmo administrador pode preencher novamente os mesmos dados, e-mail e código de funcionário para retomar a reserva. Uma conta Auth já criada é reutilizada; a senha informada na primeira criação permanece, podendo ser redefinida em Equipe após concluir. Contas pendentes não conseguem operar nem virar associados. Credenciais ficam somente na memória da tela e no Auth/hash do código, nunca no armazenamento persistente do navegador ou auditoria.

Testes adicionais: `node --experimental-strip-types tests/connected/test-partner.mjs` valida recuperação/concorrência com Auth/Postgres locais. `node tests/connected/test-partner-ui.mjs` exige `dev:sandbox` e `functions:serve`, executa o fluxo completo a 360px e remove sua conta/estabelecimento sintéticos locais. Os helpers recusam destinos diferentes do Docker local.
