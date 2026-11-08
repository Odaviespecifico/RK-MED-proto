# RKMED — roteiro de testes manuais

Este roteiro orienta uma pessoa a testar o sistema, registrar o que aconteceu e comparar com o resultado esperado. Referência: funcionalidades e decisões do projeto em 08/11/2026. Os itens começam desmarcados: a existência deste documento não significa que os testes foram executados.

## 1. Como usar o checklist

Para cada cenário, execute as ações na ordem e marque a caixa somente quando **todos** os resultados esperados forem confirmados. Registre um destes resultados: **Passou**, **Falhou**, **Bloqueado** ou **Não se aplica**. Uma dependência ausente, como credenciais Stripe ou entrega SMS ainda não configurada, significa **Bloqueado**, nunca aprovação.

Use contas e dados sintéticos. Mantenha associado, parceiro e administração em navegadores ou perfis separados para conseguir comparar as telas durante uma mesma operação. Não misture contas da demonstração com contas do ambiente conectado.

| Registro da rodada | Preencher |
| --- | --- |
| Pessoa responsável e data | |
| URL e ambiente | |
| Versão/commit testado | |
| Dispositivo, sistema e navegador | |
| Contas de teste utilizadas | |
| Stripe: sandbox/conta de teste | |

Modelo de evidência para cada cenário:

| Cenário | Resultado | Esperado × observado | Evidência / identificação | Responsável |
| --- | --- | --- | --- | --- |
| Ex.: PAG-01 | | | | |

Anote horário em Recife, IDs da compra/fatura/evento e capturas com dados sensíveis ocultos. Não inclua senhas, OTPs, chaves, links de autenticação, CPF completo ou QR utilizável nos registros compartilhados.

## 2. Escolher e preparar o ambiente

| Ambiente | Endereço padrão | O que permite comprovar |
| --- | --- | --- |
| Interface com dados locais (`npm run dev`) | `http://127.0.0.1:5173` | Navegação e operações simuladas. Não comprova pagamento, entrega de mensagem ou autorização no servidor. |
| Aplicação conectada (`npm run dev:sandbox`) | `http://127.0.0.1:5174` | Auth, banco, permissões, fotos, compras e gestão no Supabase local. Stripe e mensagens exigem configuração adicional. |
| PWA conectada compilada | `http://127.0.0.1:4174` | Recarga offline e cache de conta. Instalação/câmera em celulares físicos devem ser verificadas em ambiente HTTPS de testes. |

O restante do roteiro usa a aplicação **conectada**. A ausência de uma faixa de testes na interface não identifica o ambiente: confirme a URL e a configuração com o responsável técnico.

### Preparação técnica local

Com Node.js 22+, npm e Docker disponíveis, executar na raiz:

```bash
npm ci
npm run db:start
npm run local:prepare
npm run dev:sandbox
```

Em outro terminal:

```bash
npm run functions:serve
```

- [ ] **PRE-01 — Serviços:** abrir a aplicação em 5174, o Supabase Studio em `http://127.0.0.1:54323` e a caixa local de e-mail em `http://127.0.0.1:54324`. Esperado: serviços acessíveis e aplicação sem erro de configuração.
- [ ] **PRE-02 — Dados:** confirmar com o técnico que migrations, fotos e contas sintéticas foram preparadas. Não reiniciar/apagar o banco durante uma rodada: isso invalida suas evidências.
- [ ] **PRE-03 — Provedores:** antes dos testes PAG, confirmar Stripe de teste, preço mensal BRL de 6960 centavos, portal, webhook e funções configurados conforme [homologação](../docs/homologacao.md#cadastro-e-pagamento). As configurações dos utilitários Stripe não são carregadas automaticamente pelas Edge Functions.
- [ ] **PRE-04 — Mensagens:** configurar o motor OTP RKMED (`OTP_HMAC_SECRET`), SMS Dev e Resend conforme [smsdev-otp.md](../docs/smsdev-otp.md). Confirmar recebimento em destinatários autorizados. Aceitação pela API não comprova entrega; não usar códigos fixos do Supabase para aprovar o novo fluxo.

Não executar `db:reset` para apenas iniciar uma rodada. Caso o responsável precise recriar o banco **local descartável**, o procedimento está em [homologação](../docs/homologacao.md#iniciar-do-zero).

### Acessos do Supabase local

Senha de equipe exclusiva do ambiente local: `RKMED-local-test-2026!`.

| Conta | Como usar / finalidade |
| --- | --- |
| `admin@rkmed.test` | `/acesso-admin`; administração e criação de acessos |
| `suporte@rkmed.test` | `/acesso-admin`; operação e cobranças, sem criação de acessos |
| `diretoria@rkmed.test` | `/acesso-admin`; consulta sem alterações/exportação |
| `parceiro@rkmed.test` | `/acesso-parceiro`; Laboratório Vida; código Marina: `2468` |
| `outro-parceiro@rkmed.test` | `/acesso-parceiro`; Academia Movimento; código Pedro: `1357` |
| `ana@rkmed.test` | `/entrar` → e-mail → código recebido na caixa local; elegível por fixture |
| `carlos@rkmed.test` | `/entrar` → e-mail; associado com bloqueio e pendência |
| `novo@rkmed.test` | Identidade para cadastro; verificar se já foi usada por outra rodada |

O associado entra por OTP, não pela senha da equipe. Ana estar ativa inicialmente **não comprova pagamento Stripe**. Para PAG-01, use um cadastro novo sem pagamento anterior. A fixture de Carlos reúne bloqueio e pendência; para isolar falha de cobrança, use outro associado sem bloqueio.

Para busca sintética de Ana no balcão, CPF `12345678909`. Essa entrada é exclusiva da execução local e não deve aparecer nas evidências compartilhadas.

No Docker, telefones reservados no arquivo `supabase/config.toml` têm OTP `482913`. Não use esse código no sandbox hospedado. Os números reservados não representam um cadastro brasileiro completo pela interface; a equipe pode preparar o vínculo por API local com `npm run test:connected:enrollment`. Isso testa o vínculo técnico, mas **não aprova** cadastro manual nem chegada de SMS. Para a jornada integral, use contatos autorizados no sandbox com SMS Dev/Resend configurados. Os códigos fixos do Docker pertencem ao harness antigo, não ao motor OTP RKMED.

## 3. Site público e navegação — RF-LP

- [ ] **PUB-01 — Página inicial:** abrir `/`, percorrer todas as seções e usar os botões de entrar/cadastro. Esperado: navegação correta, mensalidade de **R$ 69,60**, textos legíveis e ausência de telas quebradas.
- [ ] **PUB-02 — Parceiros e mapa:** conferir categoria, endereço e desconto dos parceiros; selecionar endereços e abrir o Google Maps. Esperado: link correspondente ao parceiro selecionado; sem chave de mapa incorporado, endereço e link continuam disponíveis.
- [ ] **PUB-03 — Documentos:** abrir Termos e Privacidade, além dos documentos apresentados no cadastro. Esperado: conteúdo carregado e versões identificáveis. Documentos de teste mantêm o aviso de texto gerado por IA; conteúdo indisponível não permite aceitar silenciosamente.
- [ ] **PUB-04 — Menu móvel:** em tela de 360 px e em celular, abrir/fechar o menu e acessar links. Esperado: nenhum corte horizontal e controles alcançáveis.

## 4. Cadastro e autenticação — RF-CAD, D05, D11, D12, D20, D26

### Cadastro completo

- [ ] **CAD-01 — E-mail:** iniciar `/cadastro` com um e-mail de teste ainda não utilizado, solicitar o código e confirmá-lo. Esperado: avanço para verificação do celular na mesma conta; ainda sem benefício ativo.
- [ ] **CAD-02 — Celular:** solicitar o código pelo SMS e confirmar. Esperado: contato verificado vinculado à identidade anterior, sem segunda conta; não existe opção WhatsApp nem PIN.
- [ ] **CAD-03 — Dados e aceites:** informar nome, CPF sintético válido e não utilizado, nascimento de adulto; ler Termos, Privacidade e Uso da foto e aceitar. Esperado: avanço para foto, com versões e aceite registrados no servidor.
- [ ] **CAD-04 — Somente câmera:** na etapa da foto, confirmar que não existe opção de escolher arquivo e que o aviso de nitidez é exibido. Esperado: a captura só é possível pela câmera ao vivo.
- [ ] **CAD-05 — Foto pela câmera:** em nova conta, permitir o acesso quando a câmera abrir, enquadrar um rosto e capturar. Esperado: captura habilitada quando o enquadramento é aceito e foto salva. A mensagem não deve afirmar comprovação de identidade ou vivacidade.
- [ ] **CAD-05A — Pagamento após o cadastro:** concluir a foto e confirmar que a etapa de pagamento aparece imediatamente, com a mensalidade de R$ 69,60. Esperado: o benefício continua indisponível até a confirmação do provedor; falha ao abrir o Checkout mostra erro e permite tentar novamente.

### Rejeições e interrupções

- [ ] **CAD-06 — Validação dos dados:** tentar separadamente CPF inválido, CPF já cadastrado, nascimento de menor e campos obrigatórios vazios. Esperado: bloqueio com explicação; nenhum cadastro duplicado.
- [ ] **CAD-07 — Verificação incompleta:** confirmar somente o e-mail e tentar acessar `/app` ou concluir o cadastro. Repetir sem aceitar os documentos. Esperado: orientação para concluir as etapas; sem checkout/benefício por bypass.
- [ ] **CAD-08 — OTP incorreto/expirado:** informar código incorreto e, com apoio técnico para aguardar a validade configurada, código expirado. Esperado: recusa; o sistema não considera o contato verificado.
- [ ] **CAD-09 — Reenvio:** solicitar novo código antes e depois do intervalo indicado. Esperado: espera respeitada, mesmo canal de envio e confirmação possível com código válido. Solicitações repetidas devem ser limitadas pelo servidor.
- [ ] **CAD-10 — Capturas inválidas:** tentar capturar sem rosto (o botão deve ficar indisponível), com dois rostos e com imagem desfocada. Esperado: rejeição ou orientação para tentar novamente; sem foto aprovada indevidamente.
- [ ] **CAD-11 — Permissão da câmera:** negar acesso ou usar aparelho sem câmera disponível. Esperado: erro compreensível e possibilidade de tentar novamente após autorizar; a tela não trava.
- [ ] **CAD-12 — Queda de rede e retomada:** desligar a conexão durante cadastro/upload e depois reconectar. Esperado: erro recuperável e nenhuma aprovação fictícia. Ao recarregar, pode ser necessário reinserir dados transitórios; CPF/nascimento não devem reaparecer a partir de rascunho persistente.

### Login e sessão

- [ ] **AUTH-01 — E-mail:** sair, entrar por **Login com email**, solicitar e validar OTP. Esperado: acesso ao mesmo associado e mesmo histórico, sem exigir SMS novamente.
- [ ] **AUTH-02 — SMS:** sair, entrar por **Login com SMS** e validar OTP. Esperado: mesma conta usada no e-mail, sem exigir confirmação dos dois canais no login. Depende de entrega configurada.
- [ ] **AUTH-03 — Conta inexistente:** tentar login com contato não cadastrado. Esperado: nenhum acesso concedido e nenhuma nova adesão criada pelo formulário de login.
- [ ] **AUTH-04 — Persistência:** entrar como associado, fechar e reabrir navegador/aplicativo. Esperado: sessão preservada quando o armazenamento continua disponível e a sessão não foi revogada; sem prazo artificial de inatividade para membro.
- [ ] **AUTH-05 — Saída:** clicar **Sair**, usar Voltar e abrir `/app` diretamente. Esperado: não recuperar dados privados da sessão encerrada.

## 5. Pagamentos e assinatura — RF-PAG, RN-07–11, D08, D09, D15

### Preparação da rodada Stripe

Testes desta seção exigem acesso ao Dashboard do **sandbox Stripe** correspondente à aplicação e um responsável técnico disponível. Use cartões de teste somente. Para aprovação, a documentação oficial permite `4242 4242 4242 4242`, validade futura e CVC de três dígitos; para recusa genérica, `4000 0000 0000 0002`. Outros casos, incluindo autenticação 3DS, estão na [lista oficial de cartões de teste](https://docs.stripe.com/testing#cards).

Para ambiente local, o técnico deve encaminhar os eventos à função da aplicação:

```bash
npx --no-install stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

Configurar o segredo correspondente no backend e reiniciar as funções conforme necessário. O receptor independente dos utilitários Stripe não ativa a adesão. Para cada pagamento, guarde o ID do cliente, assinatura, fatura e evento, junto ao associado de teste. Evento genérico produzido pela CLI, sem vínculo com esse associado, não comprova a jornada.

### PAG-01 — Primeiro pagamento bem-sucedido

Pré-condição: associado novo, com ambos os contatos, aceites e foto, sem bloqueio; assinatura incompleta.

1. Concluir a foto no cadastro e confirmar que a etapa de pagamento é aberta com **Pagamento pendente** / benefício indisponível.
2. Clicar **Pagar R$ 69,60**.
3. No Checkout Stripe, conferir cobrança **mensal**, em **BRL**, de **R$ 69,60**, e a identificação do cliente de teste.
4. Preencher o cartão de aprovação e concluir o pagamento.
5. Retornar à aplicação; aguardar o processamento do webhook e atualizar/reabrir a área do associado.
6. No Dashboard Stripe, abrir a assinatura e a fatura correspondentes.
7. No navegador do parceiro, consultar novamente o cartão e registrar uma compra conforme BAL-03.

- [ ] **PAG-01A — Provedor:** fatura de R$ 69,60 paga, pagamento bem-sucedido e assinatura ativa, vinculados ao mesmo cliente.
- [ ] **PAG-01B — Aplicação:** após conciliação verificada, benefício disponível, pagamento em dia e período pago coerente com a assinatura Stripe.
- [ ] **PAG-01C — Uso efetivo:** o parceiro reconhece elegibilidade e consegue registrar a compra, que aparece no histórico/economia do associado.
- [ ] **PAG-01D — Sem duplicidade:** atualizar a página ou voltar à área de pagamento não cria outra mensalidade/assinatura para a mesma obrigação.

**Só considerar PAG-01 aprovado com as quatro verificações.** A tela de retorno sozinha não é evidência de pagamento.

### Demais cenários de pagamento

- [ ] **PAG-02 — Checkout abandonado:** abrir Checkout em outra conta e voltar sem pagar. Esperado: benefício indisponível e possibilidade de retomar; nenhuma fatura considerada paga pela aplicação.
- [ ] **PAG-03 — Cartão recusado:** usar o cartão de recusa em um novo checkout. Esperado: erro de pagamento, sem liberação de benefício. Corrigir com cartão de aprovação e confirmar recuperação apenas após processamento do provedor.
- [ ] **PAG-04 — 3DS:** usar o cenário oficial de autenticação exigida, primeiro cancelando/falhando o desafio e depois aprovando-o. Esperado: desafio pendente/falhado não libera benefício; conclusão bem-sucedida segue os mesmos critérios de PAG-01.
- [ ] **PAG-05 — Retorno sem evento:** com apoio técnico, interromper temporariamente apenas o encaminhamento do webhook em ambiente isolado; pagar e retornar à aplicação antes de qualquer conciliação. Esperado: o retorno não ativa benefício. Retomar processamento/reenvio/conciliação e confirmar atualização. Outros reconciliadores também precisam estar controlados neste cenário.
- [ ] **PAG-06 — Renovação aprovada:** com apoio técnico, avançar um ciclo de assinatura de teste usando recurso suportado pelo Stripe, como Test Clock quando aplicável. Esperado: nova fatura do ciclo, cobrança única de R$ 69,60, período pago atualizado e benefício disponível. Não simular renovação apenas alterando uma data no banco. Consulte [testes de Billing](https://docs.stripe.com/billing/testing).
- [ ] **PAG-07 — Falha na renovação:** preparar método que falhe na cobrança recorrente conforme cenário oficial e gerar a próxima fatura da assinatura. Esperado: evento de falha processado, benefício removido imediatamente após essa confirmação, pendência visível para equipe e recusa no balcão. Usar associado sem bloqueio administrativo para isolar o motivo.
- [ ] **PAG-08 — Recuperação D+0/1/3:** conferir com o técnico a política no Billing e executar a passagem dos prazos no ambiente de teste. Esperado: retentativas da mesma dívida em D+0, D+1 e D+3, sem outro agendador duplicando cobranças; registrar datas e resultados. Não marcar como aprovado somente por a configuração existir.
- [ ] **PAG-09 — Atualização do cartão e quitação:** no associado inadimplente, usar **Gerenciar pagamento**, trocar para método válido e pagar/retentar a fatura existente. Esperado: a mesma dívida é quitada; benefício retorna após conciliação, se não houver bloqueio administrativo.
- [ ] **PAG-10 — Cancelamento:** em assinatura paga, clicar **Cancelar ao fim do período**, voltar sem confirmar e conferir que nada mudou; repetir confirmando. Esperado: cancelamento agendado, sem nova cobrança após o encerramento; acesso permanece até o período pago acabar. Verificar antes/depois da data com apoio técnico.
- [ ] **PAG-11 — Prioridade de bloqueios:** bloquear administrativamente uma conta paga; depois receber um evento de pagamento ou agendar cancelamento. Esperado: pagamento não remove o bloqueio. Desbloquear uma conta ainda inadimplente também não libera benefício.
- [ ] **PAG-12 — Reembolso/disputa:** com apoio técnico, executar cenários de risco de teste no Stripe. Esperado: sinal correspondente na fila/alertas operacionais, sem reativação indevida por evento antigo. Registrar o estado observado e comparar com a política implementada; não presumir que todo sinal tem o mesmo efeito na elegibilidade.
- [ ] **PAG-13 — Duplicação e ordem dos eventos:** pedir ao técnico para reenviar o mesmo evento e entregar evento pago antigo após falha mais recente. Esperado: nenhuma segunda cobrança/notificação/decisão financeira e nenhum benefício reativado a partir de estado desatualizado.
- [ ] **PAG-14 — Provedor indisponível:** em ambiente isolado, simular timeout/configuração ausente e tentar checkout/portal. Esperado: erro explícito e possibilidade de tentar novamente, sem pagamento ou benefício inventado.

## 6. Cartão, economia e rede — RF-QR, D06, D07

- [ ] **MEM-01 — Cartão:** conferir nome, CPF mascarado, QR e situação da assinatura. Esperado: dados da conta atual; QR permanece estável ao atualizar/reabrir, salvo revogação/reemissão autorizada.
- [ ] **MEM-02 — Economia:** anotar saldo inicial, registrar uma compra no parceiro e atualizar a área do associado. Esperado: acréscimo exatamente igual ao desconto; histórico mostra parceiro, data e valores correspondentes.
- [ ] **MEM-03 — Paginação:** preparar mais de 25 compras com o técnico; navegar por páginas e voltar. Esperado: registros corretos, sem repetição/perda indevida; economia acumulada representa o total, não apenas a página aberta.
- [ ] **MEM-04 — Parceiros:** abrir **Parceiros**, conferir rede, categorias, endereços, descontos e o mapa da rede contra o cadastro ativo da administração.
- [ ] **MEM-05 — Cobrança e ajuda:** conferir mensalidade, período pago e bloqueios; testar os controles de pagamento disponíveis. Em **Conta**, enviar uma mensagem pelo formulário de ajuda e confirmar que ela aparece para admin/suporte; a resposta registrada pela equipe fica vinculada à solicitação. O envio exige conexão e não é enfileirado offline.
- [ ] **MEM-06 — Seções do associado:** navegar por **Início**, **Parceiros**, **Economia** e **Conta** em celular. Esperado: cartão/QR na entrada, rede e mapa em Parceiros, totais e histórico em Economia, e e-mail/telefone verificados com CPF mascarado e assinatura em Conta. Nenhuma seção deve permitir alterar a assinatura sem passar pelo fluxo de pagamento.

## 7. Balcão e compra — RF-PP, RN-12–20, D10, D13, D18

- [ ] **BAL-01 — Funcionário:** entrar como parceiro e informar código errado, depois código de outro estabelecimento, depois `2468` no Laboratório Vida. Esperado: rejeição dos inválidos e início com nome de Marina; código não volta a ser pedido em cada compra da sessão.
- [ ] **BAL-02 — Identificação:** ler o QR da conta do associado em outra tela, clicar **Buscar** e conferir foto/nome/CPF mascarado/situação. Repetir com **Buscar por CPF**, digitando o CPF exato de teste. Esperado: mesmo associado e elegibilidade atual; não existe pesquisa parcial de CPF nem PIN.
- [ ] **BAL-03 — Compra aprovada:** com Ana elegível, marcar **Conferi a pessoa com a foto**, informar `200,00`, clicar **Revisar valores** e **Confirmar registro**. Esperado: no Laboratório Vida a 20%, bruto R$ 200,00, desconto R$ 40,00 e total ao parceiro R$ 160,00; uma compra no histórico, atribuída a Marina. O cliente paga diretamente ao estabelecimento, fora da Stripe RKMED.
- [ ] **BAL-04 — Conferência obrigatória:** não marcar a confirmação visual ou usar cenário de foto indisponível preparado pelo técnico. Esperado: compra bloqueada até nova consulta com foto e confirmação.
- [ ] **BAL-05 — Sem elegibilidade:** consultar associado inadimplente/bloqueado ou identificador inexistente. Esperado: situação explicada e impossibilidade de registrar benefício. O QR visível no celular não substitui a validação online.
- [ ] **BAL-06 — Valores inválidos:** tentar zero, negativo, letras, mais de duas casas decimais e valor além do limite técnico. Esperado: rejeição, sem compra. Repetir com `10,50`; valores válidos devem calcular corretamente.
- [ ] **BAL-07 — Arredondamento:** com parceiro a 20%, revisar bruto `0,03`. Esperado: desconto R$ 0,01 e final R$ 0,02. Com parceiro de teste a 50%, bruto `0,01` deve gerar desconto R$ 0,01, arredondando meio centavo para cima. Restaurar o percentual depois.
- [ ] **BAL-08 — Confirmação repetida:** clicar rapidamente duas vezes em **Confirmar registro** e atualizar o histórico. Esperado: uma compra e um acréscimo de economia; complementar com teste técnico de repetição da mesma operação após resposta perdida.
- [ ] **BAL-09 — Bloqueio durante a compra:** validar associado pago, revisar valores e, em outro navegador, bloqueá-lo antes da confirmação. Esperado: registro recusado na confirmação, sem compra parcial.
- [ ] **BAL-10 — Funcionário desativado:** iniciar atendimento; na administração, desativar esse funcionário; tentar confirmar nova compra. Esperado: recusa mesmo com sessão já aberta. Reativar ao terminar.
- [ ] **BAL-11 — Trocar funcionário:** usar **Trocar funcionário**, iniciar com outro funcionário do mesmo parceiro e comprar novamente. Esperado: novos registros atribuídos ao novo funcionário; anteriores mantêm a autoria original. Sair/entrar deve exigir novo vínculo de atendimento.
- [ ] **BAL-12 — Isolamento e histórico:** entrar como outro parceiro. Esperado: não visualizar compras do Laboratório Vida, não usar seus códigos e não registrar compra em seu nome.
- [ ] **BAL-13 — Recibo expirado:** com apoio técnico, deixar a validação passar de seu prazo antes de confirmar. Esperado: recusa e exigência de nova consulta, sem reutilização de recibo consumido.

## 8. Administração, parceiros e equipe — RF-ADM, D14, D25

- [ ] **ADM-01 — Consulta:** entrar como admin; buscar associado por nome, limpar busca, navegar por mais de 25 resultados e atualizar. Esperado: resultados corretos e CPF sempre mascarado. Busca inexistente mostra estado vazio.
- [ ] **ADM-02 — Bloquear/desbloquear:** selecionar associado e tentar confirmar sem motivo; informar motivo e confirmar. Esperado: motivo obrigatório; alteração refletida no balcão e na área do membro. Desbloquear só restitui benefício se a assinatura também estiver regular.
- [ ] **ADM-03 — Estornar:** anotar compra/economia, abrir **Compras registradas**, selecionar **Estornar**, informar motivo e confirmar. Esperado: original preservado como estornado, motivo/auditoria disponíveis por verificação técnica e economia reduzida uma única vez. Não há reembolso Stripe da mensalidade nem transferência do pagamento feito ao parceiro.
- [ ] **ADM-04 — Estorno antigo/repetido:** usar compra antiga preparada pelo técnico e estornar; tentar novamente. Esperado: ausência de prazo comercial para estorno, com apenas um estorno efetivo por compra.
- [ ] **ADM-05 — Cadastro de parceiro:** em **Parceiros**, criar nome, categoria, endereço e percentual válidos. Esperado: parceiro aparece na rede ativa; dados permanecem após recarregar. Nome/endereço/categoria vazios e percentuais fora de 0–100 devem ser recusados.
- [ ] **ADM-06 — Alterar/inativar parceiro:** editar percentual e endereço, registrar nova compra e comparar com compra anterior. Esperado: novo desconto nas próximas compras e percentual antigo preservado no histórico. Inativar retira o parceiro da rede ativa e impede operação; histórico continua consultável. Restaurar o estado após o teste.
- [ ] **ADM-07 — Funcionários:** em **Equipe**, criar funcionário com código numérico de 4–12 dígitos e parceiro correto; testar acesso, desativar e reativar. Esperado: vínculo e estado respeitados, inclusive no teste BAL-10. Código inválido/duplicado no mesmo parceiro deve ser recusado.
- [ ] **ADM-08 — Criar acesso:** como admin, criar conta de teste com senha de pelo menos 12 caracteres e perfil pretendido. Para parceiro, selecionar estabelecimento. Esperado: novo login recebe somente as permissões escolhidas; dados inválidos não criam acesso parcial.
- [ ] **ADM-09 — Suporte:** repetir bloqueio, estorno e cobrança como suporte. Esperado: operações autorizadas; criação de acessos administrativos indisponível e recusada pelo servidor.
- [ ] **ADM-10 — Diretoria:** entrar como diretoria e percorrer consultas/relatórios. Esperado: CPF mascarado; sem contatos/fotos dos associados, bloqueios, estornos, cobranças operacionais, criação de acessos e exportação. A restrição deve existir também nas respostas do servidor, a verificar na seção técnica.
- [ ] **ADM-11 — Sessão de equipe:** deixar conta da equipe inativa por 30 minutos e, em rodada controlada, testar limite total de 8 horas com auxílio técnico. Esperado: operações recusadas após expiração; atualização automática de alertas não renova atividade. Não aplicar esses prazos ao associado.
- [ ] **ADM-12 — Visão geral:** entrar como admin/suporte e abrir `/admin`. Esperado: indicadores de associados ativos, compras, economia gerada e atenção necessária; últimas compras e assinaturas pendentes. A diretoria vê os mesmos agregados, sem contatos, fotos ou ações. Os valores devem refletir o banco, não apenas a página carregada.
- [ ] **ADM-13 — Suporte:** enviar uma mensagem como associado e abrir **Suporte** como admin/suporte. Esperado: mensagem listada com nome, data e texto; filtro por situação; resposta registrada e status alterado. A diretoria recebe recusa também na chamada direta ao servidor, e o associado não acessa a lista nem responde solicitações.

## 9. Cobranças, comunicações e alertas — RF-NOT, D08, D17

- [ ] **COB-01 — Pendências:** abrir **Cobranças e suporte** com conta inadimplente e fatura real de teste vinculada. Esperado: identificação, valor e fatura corretos; conta sem fatura cobrável não oferece uma retentativa fictícia.
- [ ] **COB-02 — Enviar link:** selecionar **Enviar link**, conferir pessoa/fatura/valor e cancelar; repetir confirmando. Esperado: cancelamento não envia; confirmação registra ação e item na fila. Com entrega configurada, conferir chegada e destino do link, sem expô-lo em evidência pública.
- [ ] **COB-03 — Retentar fatura:** selecionar **Retentar fatura**, revisar dados e confirmar uma vez. Esperado: tentativa da fatura existente, sem outra fatura para a mesma dívida. Cartão válido pode efetivamente pagar **no sandbox**; validar resultado pelo webhook e Dashboard, como PAG-01.
- [ ] **COB-04 — Falha e repetição:** repetir o cenário com método recusado e resposta perdida preparada pelo técnico. Esperado: erro/pendência explícitos, sem quitação inventada ou cobrança duplicada.
- [ ] **COB-05 — Fila e entrega:** provocar falha de envio em destinatário de teste e acompanhar tentativas/reprocessamento. Esperado: estado de falha/pendência coerente. “Aceita pelo provedor” não comprova recebimento; verificar a caixa/aparelho e os registros de entrega quando disponíveis.
- [ ] **COB-06 — Alertas em tempo real:** com admin/suporte aberto em duas sessões, gerar falha de pagamento/envio de teste. Esperado: atualização sem recarga, acesso por **Abrir cobranças e fila** e atualização manual por **Verificar alertas**. Categorias podem contar a mesma ocorrência; não somá-las como eventos únicos.
- [ ] **COB-07 — Reconexão:** interromper o canal de alertas com apoio técnico e reconectar/voltar à aba. Esperado: indicação da interrupção, atualização alternativa enquanto visível e nova consulta ao recuperar conexão; sem manter contadores antigos após perda de permissão.
- [ ] **COB-08 — Perfis e notificações:** conferir que diretoria, parceiro e associado não recebem alertas internos; validar comunicações de ciclo da assinatura apenas para o membro afetado e alertas operacionais apenas para equipe autorizada.

## 10. Relatórios e exportação

- [ ] **REL-01 — Filtros:** abrir **Relatórios**, escolher período e parceiro e clicar **Consultar relatório**. Esperado: totais completos do período em Recife, incluindo compras de páginas não carregadas; parceiro inativo permanece selecionável no histórico.
- [ ] **REL-02 — Conferência financeira:** comparar bruto, desconto e final com compras conhecidas; depois estornar uma delas e consultar novamente. Esperado: totais de compras válidas ajustados e estornadas identificadas. Esses valores representam compras nos parceiros, não receita de mensalidades.
- [ ] **REL-03 — CSV:** como admin/suporte, exportar, conferir período e confirmar; abrir arquivo em planilha. Esperado: UTF-8, separador `;`, nomes/valores legíveis, status de estorno e CPF mascarado; sem contatos, fotos ou QR. Nova consulta no momento da exportação pode refletir alterações posteriores à tela.
- [ ] **REL-04 — Limites:** testar período inválido ou maior que 366 dias e, com dados preparados pelo técnico, mais de 5.000 registros e mais de cinco exportações por minuto. Esperado: recusa explícita conforme limite; nunca arquivo parcial anunciado como completo.
- [ ] **REL-05 — Diretoria e dados especiais:** confirmar exportação negada para diretoria; com fixture de nome que começa como fórmula, conferir tratamento como texto na planilha, sem execução de fórmula.

## 11. PWA, offline e dispositivos — RNF, D07, D23

Para testar o cache, usar a versão compilada, não apenas o servidor de desenvolvimento:

```bash
npm run build:sandbox
npm run preview -- --port 4174 --outDir dist-sandbox
```

Abrir 4174 online e entrar novamente nessa origem. Se também testar pagamentos nessa porta, ajustar `APP_ORIGIN` no backend com o técnico. Para Android/iPhone físicos, usar URL HTTPS do ambiente de testes; `127.0.0.1` no celular aponta para o próprio celular.

- [ ] **PWA-01 — Preparar conteúdo:** entrar online, abrir cartão, rede, cobrança e páginas do histórico; aguardar carregamento. Esperado: conteúdo próprio disponível e última sincronização registrada.
- [ ] **PWA-02 — Reiniciar offline:** desligar Wi-Fi/dados, fechar a PWA e abrir novamente. Esperado: cartão/QR e conteúdo salvo acessíveis, aviso offline e horário da última sincronização; situação salva não aparece como validação atual de benefício.
- [ ] **PWA-03 — Histórico parcial:** consultar mais de uma página online e reabrir offline. Esperado: páginas salvas disponíveis com aviso de possível incompletude; economia total salva não vira a soma apenas da página.
- [ ] **PWA-04 — Ações bloqueadas:** offline, tentar login, checkout, portal, cancelamento, cadastro, suporte com envio, compra e alterações internas. Esperado: bloqueio/orientação de reconexão; nada executado automaticamente ao reconectar.
- [ ] **PWA-05 — Balcão online:** exibir QR offline no aparelho do associado e validar com parceiro online. Esperado: parceiro consulta estado atual no servidor, inclusive bloqueio ocorrido depois do último sync do celular.
- [ ] **PWA-06 — Logout/troca de conta:** sair offline, reabrir e depois entrar com outro associado online. Esperado: nenhum dado/cache do associado anterior disponível; perfis internos não reutilizam snapshot de membro.
- [ ] **PWA-07 — Armazenamento removido:** limpar dados do site em perfil de teste e abrir offline. Esperado: orientação de conexão para novo acesso, sem tela com dados de outra pessoa ou sessão fictícia.
- [ ] **PWA-08 — Sessão revogada:** com o técnico, revogar sessão e reconectar. Esperado: servidor exige autenticação; negação de acesso não é tratada como simples falta de internet para continuar exibindo dados online protegidos.
- [ ] **PWA-09 — Instalação física:** instalar pela opção disponível em Android e iPhone, abrir pelo ícone e repetir câmera, QR, offline e links diretos. Registrar modelos e versões; emulação desktop não substitui esta verificação.
- [ ] **PWA-10 — Atualização:** com o técnico, disponibilizar nova versão de teste e abrir a instalação anterior. Esperado: atualização orientada sem recarga forçada durante cadastro/câmera/pagamento; após aceitar/reabrir, conteúdo e sessão permanecem coerentes.
- [ ] **UX-01 — Acessibilidade:** percorrer pelo teclado, usar Tab/Enter/Escape em menus/diálogos e ampliar texto. Esperado: foco visível, retorno do foco ao fechar menu, campos rotulados e erros/status compreensíveis sem depender só de cor.
- [ ] **UX-02 — Telas e falhas:** testar pelo menos 360 px, tela de computador, rede lenta, lista vazia e API indisponível. Esperado: carregamento, vazio e erro explícitos; sem rolagem horizontal indevida ou confirmação antes da resposta.

## 12. Repasse Wedea — D27

Esta seção exige preparação técnica de contagem de associados, acesso autorizado ao sandbox Stripe Connect e consulta ao registro de repasses. Não existe painel público de gestão desse repasse. Usar [a regra e o procedimento de conciliação](../docs/wedea-connect.md); não alterar manualmente registros financeiros para aparentar aprovação.

O limite considera associados pagantes **com benefícios ativos após a conciliação**, incluindo quem acabou de pagar. O repasse é de **R$ 15,87 por fatura mensal paga de valor positivo** quando a contagem é de pelo menos 201. Compras no parceiro não entram nessa regra.

- [ ] **WED-01 — Limite:** preparar cenário cuja contagem após o pagamento fique em 200, pagar uma mensalidade e verificar ausência de repasse. Em outro pagamento, atingir 201; esperado: um repasse de R$ 15,87 à Wedea, com decisão registrada por fatura. Em mensalidade integral, R$ 53,73 ficam com RKMED antes das tarifas.
- [ ] **WED-02 — Renovação/queda:** renovar com mais de 200 ativos; depois preparar cenário com total 200 e processar outro pagamento. Esperado: primeiro com repasse, segundo sem; não pagar retroativamente faturas decididas abaixo do limite.
- [ ] **WED-03 — Contagem correta:** preparar bloqueado, inadimplente, período vencido e cancelamento agendado com período ainda pago. Esperado: os três primeiros não contam; cancelamento agendado conta enquanto pago e elegível.
- [ ] **WED-04 — Eventos repetidos/concorrentes:** repetir o evento da mesma fatura e processar pagamentos simultâneos próximos do limite. Esperado: decisão preservada por fatura e no máximo uma transferência por obrigação; contagem serializada, sem duplicidade.
- [ ] **WED-05 — Zero e desconto:** fatura zero não gera repasse. Fatura positiva abaixo de R$ 15,87 mantém obrigação integral de R$ 15,87 quando elegível; testar saldo RKMED insuficiente. Esperado: pendência, sem transferência fictícia.
- [ ] **WED-06 — Destino/rede:** testar capacidade da conta Wedea indisponível e perda de resposta. Esperado: repasse pendente/retentativa idempotente para o mesmo destino e cobrança; estado incerto após a janela documentada vai para revisão, sem reenviar cegamente. Conciliar ID/valor/moeda no Stripe.
- [ ] **WED-07 — Reembolso/disputa:** após repasse de teste, reembolsar ou simular disputa. Esperado: alerta operacional e ausência de reversão automática do repasse Wedea; RKMED suporta os custos conforme D27.
- [ ] **WED-08 — Saldo × banco:** conferir ID e valor da transferência no saldo Stripe da Wedea. Registrar separadamente eventual payout bancário; transferência de saldo não comprova crédito em conta bancária.

## 13. Verificações com apoio técnico

Estas verificações complementam o teste visual. Ocultar um botão ou mascarar um campo na tela não comprova autorização no servidor.

- [ ] **SEG-01 — Acesso direto:** tentar abrir rotas internas sem login e por perfis indevidos; repetir chamadas de API com sessões de membro/parceiro/diretoria. Esperado: recusa sem vazamento ou alteração de dados.
- [ ] **SEG-02 — Isolamento:** tentar ler compras/foto de outro associado e dados de outro parceiro com sessão válida. Esperado: servidor/RLS negam acesso; mudar IDs na requisição não troca o escopo autorizado.
- [ ] **SEG-03 — CPF e dados privados:** inspecionar respostas de rede, CSV, cache e logs autorizados. Esperado: CPF integral não retorna a funcionários/admin/suporte/diretoria; diretoria não recebe contatos ou fotos; sem CPF em URL ou rascunho persistente.
- [ ] **SEG-04 — Fotos:** conferir bucket privado, URLs temporárias, revalidação no backend e JPEG sem metadados; acesso anônimo ou de outra conta deve ser negado. Expirada a URL, nova leitura exige autorização.
- [ ] **SEG-05 — Privilégios e segredos:** alterar metadados editáveis/IDs de parceiro e tentar assumir perfil interno. Esperado: sem promoção; segredos de serviço/Stripe/mensagens não aparecem no frontend, bundle ou logs compartilhados.
- [ ] **SEG-06 — Webhook:** tentar evento sem assinatura, inválido ou de conta/ambiente incompatível. Esperado: recusa e nenhum benefício/repasse alterado. Evento válido repetido é deduplicado.
- [ ] **SEG-07 — Auditoria:** conferir registros de compra, estorno, bloqueio, criação de acesso, exportação e cobrança, com ator, motivo quando exigido, data e vínculo da operação. Esperado: histórico preservado, sem gravação de segredos ou CPF completo.
- [ ] **SEG-08 — Offline:** inspecionar cache da PWA. Esperado: somente assets permitidos e snapshot próprio aprovado; sem respostas genéricas de API, dados internos ou URLs assinadas armazenadas indiscriminadamente.

### Suítes para complementar a rodada manual

Executar somente no ambiente local preparado. Registrar os resultados reais; testes com transportes simulados não aprovam entrega/pagamento externos.

```bash
npm run typecheck
npm test
npm run build
npm run build:sandbox
npm run db:lint
npm run db:test
npm run test:connected:api
npm run test:connected:edge
npm run test:connected:enrollment
npm run test:connected:ui
npm run test:connected:reports
npm run test:connected:operational
npm run test:connected:offline
npm run test:connected:pagination
```

Os testes Edge/cadastro exigem `functions:serve`; UI/relatórios/alertas usam 5174; offline/paginação usam o build servido em 4174. O teste de cadastro altera sua fixture. Ver [pré-requisitos e cobertura](../docs/homologacao.md#pwa-e-verificações). Os testes de demonstração (`test:e2e`, `test:mobile`) usam o servidor de 5173 e seus próprios acessos em [demonstracao.md](../docs/demonstracao.md).

Desempenho/carga, backup/restauração de banco **e objetos**, monitoramento e recuperação do ambiente hospedado exigem rodada técnica própria, conforme [desempenho](../docs/desempenho.md) e [guia de produção](../docs/producao.md). Não aprovar esses itens com base apenas na navegação manual local.

## 14. Encerrar e decidir o resultado

- [ ] Registrar resultado e evidência de cada cenário executado, inclusive os bloqueados e os que não se aplicam, com justificativa.
- [ ] Confirmar o ciclo principal: cadastro → pagamento confirmado → benefício → compra → economia → estorno, com IDs conciliados entre associado, parceiro, administração e Stripe.
- [ ] Confirmar falha de cobrança → perda de benefício → quitação da mesma fatura → recuperação, sem remover bloqueio administrativo.
- [ ] Confirmar que nenhum cenário de duplicidade criou cobrança, compra ou repasse extra.
- [ ] Restaurar percentuais/estados de parceiros, funcionários e associados alterados na rodada; encerrar sessões e desligar encaminhamentos temporários. Preservar registros financeiros e evidências para análise.
- [ ] Listar defeitos com passos de reprodução, esperado, observado, impacto e evidência. Marcar como falha crítica qualquer liberação sem pagamento confirmado, cobrança duplicada, compra indevida, vazamento entre contas ou alteração por perfil sem permissão.
- [ ] Separar o parecer de interface/local do parecer de Stripe, mensagens e aparelhos físicos. Não declarar homologação completa enquanto houver cenários críticos falhos ou dependências obrigatórias bloqueadas.

Este checklist documenta como verificar o sistema; não autoriza pagamentos reais, publicação ou uso de documentos jurídicos de teste em produção.
