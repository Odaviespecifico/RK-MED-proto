# Dados fictícios do stage

Projeto exclusivo: `wfgiokooedjalmvqgbub`, ambiente `sandbox`. Carga `stage-fixtures-v1`, criada em 16/11/2026, com UUIDs no namespace `f17e` e nomes identificados por **FICTÍCIO STAGE**. A conta que já existia no projeto foi preservada. Nenhum dado do projeto publicado foi copiado.

| Registros | Quantidade | Cenários |
| --- | ---: | --- |
| Associados e assinaturas | 240 | 120 ativos, 60 atrasados, 30 cancelados e 30 incompletos; bloqueios administrativos e cancelamento agendado |
| Parceiros | 60 | Ativos/inativos, categorias, CNPJ válido, endereço e desconto |
| Funcionários de parceiros | 276 | 40 no primeiro parceiro e quatro nos demais; ativos/inativos, códigos aleatórios únicos de quatro dígitos por parceiro |
| Acessos internos | 60 | Administrador, suporte e diretoria; mais 60 contas de parceiro |
| Compras | 3.720 | Datas distribuídas, datas iguais para testar desempate por UUID, descontos/valores calculados e vínculos de recibo/funcionário |
| Estornos | 120 | Vinculados às compras originais, com motivo e autor |
| Atendimentos | 400 | Abertos/respondidos/encerrados; associado 001 possui 81 |
| Entregas simuladas | 330 | Enviadas/falhas/pendentes, sem liberação automática de envio |
| Eventos de pagamento simulados | 96 | Processados e falhas esgotadas, sem processamento automático |
| Operações de cobrança | 60 | Histórico de sucesso/falha simulado, sem operação pendente |
| Checkouts históricos | 80 | Expirados, sem links de pagamento |
| Repasses simulados | 40 | Ignorados, revisão e enviados, sem fila de transferência |
| Auditorias da carga | 480 | Marcadas como registros fictícios; ações posteriores de teste acrescentam auditoria normal |

Assinaturas, recibos/eventos de pagamento e repasses são **cenários fabricados no banco**, não confirmações recebidas do Stripe. Não foram criadas cobranças, faturas, assinaturas ou transferências no provedor. As telas que consultam diretamente faturas e cartões no Stripe continuam exigindo a integração de teste e objetos reais desse provedor; os dados desta carga não substituem essa integração.

Os parceiros da carga usam `is_test=false` para aparecer no diretório e nos mapas do ambiente stage. Isso não restaura o fluxo de cadastro especial de parceiro de teste, removido anteriormente. Endereços e documentos de identificação foram fabricados para teste; não representam empresas ou pessoas reais.

## Acessos de teste

As senhas aleatórias, o código do primeiro funcionário e o código do estabelecimento estão no arquivo privado `.local/stage-fixtures-access.env`, ignorado pelo Git. Não publicar seu conteúdo. Contas de referência:

- Administrador: `admin@stage.rkmed.invalid`, em `/acesso-admin`.
- Parceiro: `parceiro.001@stage.rkmed.invalid`, em `/acesso-parceiro`.
- Associado: `cliente.001@stage.rkmed.invalid`. Para uma sessão de QA, o acesso existente por senha em `/acesso-admin` também reconhece o perfil do associado e o encaminha à sua área. Não testa o fluxo de OTP.

E-mails usam domínio `.invalid` e telefones usam DDD fictício `00`; não servem para testes de entrega de OTP. Não substituir por contatos reais em lote. Três associados iniciais têm uma imagem de fixture do repositório no Storage privado, apenas para testar cartão/conferência visual; os demais permitem verificar ausência de foto. Não foram criadas sessões Auth artificiais para as compras históricas.

## Reprodução e verificação

- `node scripts/stage/seed.mjs --prepare`: prepara o SQL e acessos privados em `.local/`.
- `node scripts/stage/seed.mjs --check-local`: valida a carga em uma transação no Docker local, com rollback, inclusive da configuração de ambiente.
- `node scripts/stage/seed.mjs --apply`: aplica ao stage. Recusa outro projeto/ambiente e não repete a carga quando o marcador já existe. Não redefine senhas nem sobrescreve dados existentes.
- `node scripts/stage/photos.mjs`: prepara as três imagens privadas de fixture, sem substituir fotos já cadastradas.
- `node scripts/stage/verify.mjs`: autentica as contas fictícias e percorre as RPCs paginadas, verificando filtros, duplicações, cursor, releitura de página e permissões. As sessões abertas pelo verificador são encerradas.
- `scripts/stage/verify.sql`: consulta somente contagens, estados, cálculos, CNPJ e elegibilidade para processamento automático; não retorna CPF, senha ou contatos.

O manifesto privado mantém senha/códigos para a mesma carga. Guarde-o: a senha não pode ser recuperada do hash no banco. A carga não integra `supabase/seed.sql` ou migrations e não deve ser usada no projeto publicado. Não há limpeza automática, pois compras, estornos, consents e auditorias são imutáveis.

Para testar paginação: compras gerais ocupam 149 páginas de 25; associados, dez; cobranças atrasadas, três; acessos internos/parceiros, cinco; suporte, 16. O histórico do associado 001 tem 150 compras (seis páginas) e o parceiro 001 tem 180 (oito páginas). Os demais parceiros possuem volume superior a uma página. Os totais referem-se ao lote inicial e podem mudar com novas operações feitas pelos testadores.

Verificado após aplicar: todos esses percursos por cursor completaram sem IDs repetidos, com releitura idêntica da segunda página. Filtros de cobrança/suporte, isolamento entre associado/parceiro/admin, CPF mascarado, acesso à imagem privada e leitura do QR pelo parceiro foram aprovados. O associado 001 possui 81 atendimentos em quatro páginas. CNPJs e cálculos monetários não apresentaram divergências; uma conta preexistente foi preservada. Reexecução da carga foi recusada como desnecessária, sem alterar senhas ou registros.

## Proteção contra efeitos externos

A carga mantém `customer_id` e `subscription_id` das assinaturas vazios, evitando conciliação automática com o Stripe. Notificações pendentes usam `next_attempt=infinity`; falhas estão esgotadas. Eventos fabricados estão processados ou com tentativas esgotadas. Repasses não usam estados `pending`/`sending`. Isso preserva as filas existentes e permite visualizar os cenários sem disparar ações do worker.

Ações manuais de suporte, cobrança ou assinatura continuam sujeitas às regras normais do sistema e às configurações do provedor; não interpretar resultados fabricados como transações executadas.
