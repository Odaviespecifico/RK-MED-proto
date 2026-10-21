# Desenvolvimento da aplicação RKMED

O frontend foi promovido de `prototype/` para a raiz, preservando estilos, assets e fluxos da demonstração. A raiz agora tem um único `package.json`, lockfile, `index.html`, configuração Vite e configuração de hospedagem. `prototype/README.md` permanece como referência histórica; arquivos locais antigos dessa pasta não são usados.

> Atualização de implementação: o [roteiro de homologação](homologacao.md) reúne os comandos e acessos atuais. O sandbox agora possui domínio/RLS, cadastro, foto no backend, cartão, balcão, gestão e endpoints de integração; provedores externos aguardam credenciais e aceitação.

## Iniciar

```bash
npm ci
npm run dev
```

Abre a demonstração em `http://127.0.0.1:5173`, sem chamadas a provedores. Os [acessos de demonstração](demonstracao.md) e dados existentes do navegador foram preservados. Usar apenas dados fictícios nesse modo: seu armazenamento e regras locais não são autorização ou proteção de dados reais.

Para preparar Supabase local:

```bash
npm run db:start
npm run local:prepare
```

Em uma máquina nova, copiar `.env.example` para `.env.local` na **raiz** e preencher somente a URL local e a chave publicável/anon. O arquivo existente nesta máquina foi preservado. Não compartilhar a saída completa de `db:status`, pois também contém segredos administrativos.

```bash
npm run dev:sandbox
```

Abre o modo sandbox em `http://127.0.0.1:5174`. A porta separada isola sessões, dados locais e a PWA da demonstração. Para alternar portas, manter origens distintas. O build sandbox agora registra seu próprio service worker estático e mantém snapshot explícito do associado em IndexedDB; veja os testes e limites no roteiro de homologação. Não usar o mesmo domínio instalado para alternar builds demo/sandbox: um worker antigo pode servir a versão já salva antes da troca de ambiente.

## Configuração pública

| Variável | Uso |
| --- | --- |
| `VITE_APP_MODE` | `demo` (padrão) ou `sandbox`; `.env.sandbox` seleciona sandbox |
| `VITE_APP_ENV` | `local` para localhost; `sandbox` para um projeto remoto dedicado a testes |
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` no ambiente local |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável ou JWT de papel `anon`; chave privilegiada é rejeitada |
| `VITE_SUPABASE_PROJECT_REF` | Obrigatória para conferir a URL de um projeto remoto de testes |
| `VITE_FACE_DETECTION_MIN_CONFIDENCE` | Limiar da detecção local de rosto; padrão 0,8 |
| `VITE_GOOGLE_MAPS_EMBED_KEY` | Opcional; chave pública restrita à API e aos domínios autorizados |

Configuração incorreta interrompe a inicialização/build; não muda silenciosamente para uma demonstração. `VITE_*` com nomes de segredos/Twilio/Stripe é rejeitado antes de compilar. O frontend não precisa de chave Stripe para redirecionar ao Checkout criado pelo servidor.

Para usar um Supabase remoto, criar/selecionar um projeto **dedicado a testes** e definir `VITE_APP_ENV=sandbox`, URL, referência e chave públicas correspondentes em `.env.sandbox.local`, ignorado pelo Git. A referência confere o destino; ela não comprova sozinha que a conta/projeto foi administrativamente separado da produção. Nenhum projeto remoto foi criado ou vinculado nesta entrega.

## Organização e comportamento

| Local | Responsabilidade |
| --- | --- |
| `src/app/` | Seleção explícita de modo, inicialização e rotas do ambiente sandbox |
| `src/features/public/` e `src/features/auth/` | Landing e formulário de login compartilhados, com a interface preservada |
| `src/components/` | Primitivos e identidade visual |
| `src/lib/` | Configuração pública, formatos e detecção de rosto |
| `src/mocks/` | Fixtures, OTP/senha fake, sessões locais e fluxos da demonstração; importação lazy somente no modo demo |
| `src/integrations/` | Cliente Supabase, contrato de autenticação e contrato de Checkout via backend |
| `supabase/functions/_shared/providers/` | Transportes de servidor Stripe sandbox e Twilio WhatsApp Sandbox, ainda sem endpoints publicados |
| `scripts/stripe/` | Ferramentas de catálogo, Checkout, fatura sintética e receptor local de eventos |
| `tests/` | Testes da aplicação, integrações, Stripe e jornadas de navegador |

O build sandbox elimina a importação de `src/mocks/DemoApp.tsx`; não consulta suas fixtures nem seus dados/sessões no navegador. As chaves antigas `rkmed-prototype-*` são mantidas apenas na demonstração para preservar o comportamento existente. O cliente real usa uma chave de sessão própria por ambiente/projeto, com refresh rotativo.

No sandbox, a landing lê parceiros ativos do banco. Cadastro, carteirinha, histórico, identificação do funcionário, validação, compra, estorno e painéis usam permissões do servidor. As funções de provedores exigem credenciais sandbox e não simulam sucesso na ausência delas. Nem login nem retorno do Checkout liberam benefícios.

## Supabase Auth e OTP

`src/integrations/auth.ts` normaliza contatos e chama `signInWithOtp`/`verifyOtp`. Login usa `shouldCreateUser=false`: esse formulário autentica contas já existentes, sem cadastrar uma identidade diferente ao alternar canais. Supabase continua responsável pelo desafio, expiração, tentativas e sessão. Não existe PIN.

- O template OTP local está em `supabase/templates/otp.html`; mensagens aparecem no Mailpit em `http://127.0.0.1:54324`.
- Telefones sintéticos reservados usam OTP fixo somente no Docker. Isso não comprova entrega externa.
- O cadastro verifica e-mail e telefone na mesma identidade, oferece reenvio com espera e SMS dentro do fluxo de celular. Login continua com duas opções: WhatsApp e e-mail.
- `phone-code` e os hooks assinados controlam o canal de entrega no servidor. As funções Twilio/Resend ficam desabilitadas até configuração explícita do sandbox.

## Provedores no servidor

O [roteiro de homologação](homologacao.md#twilio-resend-e-jobs) é a referência de configuração de transportes, hooks e filas. `supabase/functions/.env` é ignorado pelo Git; nenhuma chave secreta deve entrar no frontend.

`rkmed-api` valida sessão/perfil e executa foto, Checkout, portal, cancelamento e cobranças. Stripe exige conta/Price de teste, contatos, consentimentos e foto; eventos assinados, recibos duráveis e conciliação verificam a elegibilidade. Não existe ativação pelo redirecionamento do Checkout. Os [utilitários Stripe](stripe-testes.md) são independentes desses endpoints.

Stripe Tax permanece desabilitado. Configuração de recuperação D+0/1/3, entrega externa e jornadas reais de sandbox ainda aguardam aceitação. Nenhum deploy ou envio externo foi feito.

## Verificação e próximos passos

```bash
npm run typecheck
npm test
npm run build
npm run build:sandbox
npm run test:e2e
npm run test:mobile
node tests/sandbox-ui.mjs
```

Os testes HTTP/navegador precisam de permissão para loopback e Brave. `test:e2e` e `test:mobile` usam o servidor demo (5173; pode ser substituído por `RKMED_TEST_URL`). `sandbox-ui.mjs` usa 5174 (ou `RKMED_SANDBOX_URL`) e intercepta os endpoints Auth, sem enviar códigos reais. `tests/offline.mjs` usa o preview do build demo em 4173.

- [x] Promover frontend/assets/testes/configuração para a raiz, preservando a interface demo.
- [x] Separar código simulado e módulos reais, com configuração explícita e sem fallback.
- [x] Preparar Supabase Auth, contrato de Checkout e transportes de servidor Stripe/Twilio.
- [x] Bloquear produção/segredos públicos e testar falhas, isolamento e idempotência.
- [ ] Provisionar identidade sintética e homologar e-mail OTP real na caixa local.
- [ ] Implementar autorização/RLS, cadastro com dois contatos, aceites e domínio seguindo `plan.md`.
- [ ] Implementar/validar hook de entrega, fallback SMS e endpoints autenticados, com limites e auditoria.
- [ ] Configurar credenciais de sandbox e executar a homologação com os provedores quando autorizado.

`vercel.json` foi ajustado para a raiz apenas para manter a configuração coerente. Nada foi publicado; não houve envio de mensagens, criação de recursos Stripe ou alteração de projeto remoto.

Verificação em 19/10/2026: typecheck da aplicação e dos transportes de servidor, 27 testes automatizados, builds demo/sandbox, jornada E2E da demonstração, layouts de 320–768 px, isolamento do sandbox e recarga offline da carteirinha/economia passaram. O CSS original foi conferido byte a byte; o build sandbox foi inspecionado e não contém fixtures, credenciais/sessões simuladas nem service worker demo. A entrega real de OTPs, chamadas Stripe/Twilio e testes em celulares físicos não foram executados nesta migração.
