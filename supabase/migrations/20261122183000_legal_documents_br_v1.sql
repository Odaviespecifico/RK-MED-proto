-- Atualiza documentos jurídicos com base no ordenamento jurídico brasileiro
-- (CDC, Código Civil, LGPD e Marco Civil da Internet), removendo avisos de IA.
-- Mantém test_only = true até revisão final do advogado e preenchimento dos dados institucionais.

update private.documents
set active = false
where active
  and version not in (
    'terms-2026-11-22-v1',
    'privacy-2026-11-22-v1',
    'photo-2026-11-22-v1'
  );

insert into private.documents (version, kind, content, test_only, active)
values (
  'terms-2026-11-22-v1',
  'terms',
  $$# Termos de Uso — RKMED Linha Gold

Versão: terms-2026-11-22-v1 · Vigência: a partir de 22/11/2026.

Estes Termos de Uso regulam o acesso e a utilização do aplicativo e do clube de benefícios RKMED Linha Gold, disponibilizado por [RAZÃO SOCIAL DA RKMED], inscrita no CNPJ sob o nº [CNPJ], com sede em [ENDEREÇO COMERCIAL] ("RKMED"). Ao concluir o cadastro e assinalar o aceite eletrônico, o titular declara ter lido, compreendido e concordado integralmente com estas condições.

1. Natureza do serviço — Clube de benefícios (não é plano de saúde)
1.1. O RKMED Linha Gold é um clube de benefícios e descontos que concede a seus associados condições diferenciadas em estabelecimentos parceiros credenciados (como laboratórios, academias, lojas de suplementos e demais conveniados exibidos na rede do aplicativo).
1.2. O RKMED Linha Gold NÃO é plano de saúde, seguro-saúde, plano odontológico, convênio médico nem operadora regulada pela Agência Nacional de Saúde Suplementar (ANS — Lei nº 9.656/1998). A assinatura não garante cobertura assistencial, reembolso de despesas médicas, atendimento de urgência/emergência ou custeio de procedimentos.
1.3. Os produtos e serviços são contratados e pagos diretamente pelo associado ao estabelecimento parceiro. O RKMED apenas verifica a situação da assinatura e registra o valor bruto, o percentual de desconto aplicado e o valor final para controle de economia do associado. Cada estabelecimento parceiro é integral e exclusivamente responsável pela qualidade, segurança, disponibilidade, garantia, atendimento e emissão de nota fiscal dos serviços ou produtos fornecidos.

2. Elegibilidade, cadastro e conta
2.1. A adesão é individual, pessoal e intransferível, destinada exclusivamente a pessoas físicas com idade mínima de 18 (dezoito) anos e plena capacidade civil (art. 5º do Código Civil).
2.2. Para concluir o cadastro, o interessado deve informar dados verídicos e atualizados (nome completo, CPF válido e único, data de nascimento, e-mail e telefone celular), confirmar ambos os contatos por código temporário de verificação (OTP) na mesma conta, registrar fotografia do rosto conforme o Termo de Autorização de Uso de Imagem e aceitar as versões vigentes dos documentos legais.
2.3. A validação técnica da fotografia verifica apenas a presença de um rosto na imagem para evitar o envio de arquivos inválidos; não realiza reconhecimento facial automatizado nem comprovação biométrica de identidade.
2.4. O associado é responsável pela veracidade das informações prestadas e pela guarda do dispositivo em que mantém sua sessão ativa.

3. Assinatura, preço e cobrança recorrente
3.1. A mensalidade do RKMED Linha Gold é de R$ 69,90 (sessenta e nove reais e noventa centavos) por mês, cobrada de forma recorrente por meio do provedor de pagamentos Stripe, com renovação automática mensal até que haja cancelamento.
3.2. A ativação dos benefícios ocorre somente após a confirmação efetiva do pagamento pelo provedor de pagamentos. O simples preenchimento do cadastro ou o retorno da página de pagamento não ativa a assinatura.
3.3. Eventuais reajustes de mensalidade serão comunicados previamente ao associado com antecedência razoável, assegurada a possibilidade de cancelamento antes da entrada em vigor do novo valor.

4. Direito de arrependimento (art. 49 do CDC)
4.1. Por se tratar de contratação realizada à distância, o associado tem o direito de desistir da assinatura no prazo de 7 (sete) dias corridos, contados da data da contratação, mediante solicitação pelos canais de suporte indicados neste documento, com cancelamento da assinatura e restituição integral dos valores pagos.

5. Cancelamento voluntário, inadimplência e retentativas
5.1. O associado pode solicitar o cancelamento da renovação automática a qualquer momento, de forma facilitada, diretamente pelo portal de cobrança disponível na área do associado. No cancelamento voluntário, o acesso aos benefícios permanece ativo até o término do ciclo mensal já pago, sem novas cobranças após essa data.
5.2. Em caso de falha de pagamento ou inadimplência, o acesso aos benefícios é suspenso imediatamente, independentemente de eventual cópia local desatualizada exibida no dispositivo do associado.
5.3. Ocorrendo falha na cobrança, poderão ser realizadas tentativas automáticas de regularização em D+0, D+1 e D+3, além de disponibilização de link para atualização do meio de pagamento. Regularizada a pendência e confirmado o pagamento pelo provedor, os benefícios são restabelecidos, salvo existência de bloqueio administrativo independente.

6. Uso do cartão digital, validação presencial e modo offline
6.1. O cartão digital contém um código QR estático pessoal e intransferível, que deve ser apresentado exclusivamente pelo titular no estabelecimento parceiro. Na ausência do celular, o atendimento poderá ser realizado mediante busca pelo CPF exato do titular no balcão do parceiro, condicionada à conferência visual da fotografia cadastrada.
6.2. A verificação da elegibilidade da assinatura e o registro da compra exigem que o estabelecimento parceiro esteja conectado à internet. O desconto vigente de cada parceiro é calculado pelo servidor no momento do atendimento.
6.3. O aplicativo permite consulta offline de cópia local do cartão digital, rede de parceiros, histórico e economia acumulada, exibindo a data da última sincronização. Informações exibidas em modo offline têm caráter apenas informativo e não garantem elegibilidade atual nem autorizam benefícios. Ações que dependam de servidor (pagamentos, alterações de assinatura, envio de suporte e validação de compras) exigem conexão. O navegador ou sistema operacional do aparelho pode remover dados locais armazenados.

7. Estornos de registro, uso indevido e bloqueio
7.1. Registros de compras com desconto lançados incorretamente podem ser estornados pela equipe autorizada do RKMED mediante justificativa auditada, ajustando o histórico e a economia acumulada. O estorno de um registro de desconto no RKMED não gera reembolso financeiro no Stripe; eventuais cancelamentos ou devoluções de produtos/serviços pagos ao parceiro devem ser tratados diretamente com o estabelecimento.
7.2. O empréstimo, compartilhamento ou uso do cartão por terceiros, bem como indícios de fraude ou violação destes Termos, sujeitam a conta a bloqueio administrativo imediato, sem prejuízo das medidas legais cabíveis.

8. Rede de parceiros
8.1. A rede de estabelecimentos parceiros e os respectivos percentuais de desconto podem sofrer inclusões, alterações ou descredenciamentos ao longo do tempo, mantendo-se atualizados para consulta no aplicativo.

9. Atendimento e suporte
9.1. Dúvidas, solicitações, contestações de registros e pedidos de arrependimento podem ser registrados diretamente na seção Suporte / Conta do aplicativo ou pelo e-mail [E-MAIL DE SUPORTE].

10. Atualizações e foro
10.1. O RKMED poderá atualizar estes Termos para refletir melhorias operacionais ou exigências legais, disponibilizando a nova versão identificada no aplicativo.
10.2. Estes Termos são regidos pelas leis da República Federativa do Brasil, especialmente pelo Código de Defesa do Consumidor (Lei nº 8.078/1990) e pelo Código Civil (Lei nº 10.406/2002), prevalecendo o foro do domicílio do consumidor (art. 101, I, do CDC) para dirimir eventuais controvérsias.$$,
  true,
  true
)
on conflict (version) do update
set content = excluded.content,
    test_only = excluded.test_only,
    active = excluded.active;

insert into private.documents (version, kind, content, test_only, active)
values (
  'privacy-2026-11-22-v1',
  'privacy',
  $$# Política de Privacidade — RKMED Linha Gold

Versão: privacy-2026-11-22-v1 · Vigência: a partir de 22/11/2026.

Esta Política de Privacidade explica como [RAZÃO SOCIAL DA RKMED], inscrita no CNPJ sob o nº [CNPJ], com sede em [ENDEREÇO COMERCIAL] ("RKMED"), na qualidade de Controladora, realiza o tratamento de dados pessoais no âmbito do aplicativo e clube de benefícios RKMED Linha Gold, em conformidade com a Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018) e o Marco Civil da Internet (Lei nº 12.965/2014).

Canal do Encarregado pelo Tratamento de Dados Pessoais (DPO — art. 41 da LGPD): [NOME DO ENCARREGADO OU SETOR] · E-mail: [E-MAIL DE PRIVACIDADE / DPO].

1. Dados pessoais coletados
1.1. Para a prestação dos serviços do clube de benefícios, o RKMED trata os seguintes dados pessoais:
- Identificação e cadastro: nome completo, CPF e data de nascimento;
- Contato e autenticação: endereço de e-mail, número de telefone celular e registros de verificação por código temporário (OTP);
- Imagem para conferência visual: fotografia do rosto do titular (processada em formato JPEG 600×600 pixels, sem metadados);
- Assinatura e faturamento: situação da assinatura, datas de ciclo, faturas e identificadores de transação junto ao provedor de pagamentos (o RKMED não armazena número completo de cartão de crédito ou código de segurança);
- Uso dos benefícios e suporte: histórico de compras registradas nos parceiros (estabelecimento, data, valor bruto, desconto e valor final), registros de aceite documental (versão e data/hora), solicitações de suporte e registros de acesso/auditoria.
1.2. Ausência de dados sensíveis de saúde e de biometria de identificação: O RKMED não coleta, não solicita e não armazena prontuários médicos, diagnósticos, laudos, resultados ou categorias de exames. A fotografia cadastrada não é utilizada para reconhecimento facial automatizado nem para geração de template biométrico; o processamento técnico limita-se a verificar a presença de um rosto na imagem, sendo a conferência no balcão estritamente visual e humana.

2. Finalidades e bases legais do tratamento (arts. 7º e 11 da LGPD)
- Execução de contrato e procedimentos preliminares (art. 7º, V): criação e manutenção da conta, autenticação em dois canais no cadastro (e-mail e SMS) e acesso posterior por código temporário (OTP), emissão do cartão digital, validação de elegibilidade nos parceiros, cobrança da mensalidade, cálculo de economia e atendimento de suporte;
- Cumprimento de obrigação legal ou regulatória (art. 7º, II): guarda de registros de acesso a aplicações de internet pelo prazo mínimo de 6 (seis) meses (art. 15 do Marco Civil da Internet), bem como cumprimento de obrigações fiscais, contábeis e regulatórias;
- Exercício regular de direitos em processo judicial, administrativo ou arbitral (art. 7º, VI): preservação de registros de aceite contratual, transações, estornos, cobranças e auditorias;
- Prevenção à fraude, segurança e legítimo interesse (art. 7º, IX): controle de tentativas de acesso, proteção das contas, prevenção ao uso por terceiros e integridade operacional;
- Consentimento / autorização específica (art. 7º, I): uso da fotografia do titular para exibição no cartão digital e conferência visual no balcão, nos termos do Termo de Autorização de Uso de Imagem.

3. Compartilhamento de dados e operadores
3.1. O RKMED não comercializa dados pessoais. O compartilhamento ocorre apenas na medida estritamente necessária para a operação:
- Estabelecimentos parceiros credenciados: exclusivamente durante atendimento autorizado online, com acesso restrito a nome, fotografia, CPF mascarado e situação de elegibilidade;
- Operadores de tecnologia e infraestrutura: Supabase (banco de dados, autenticação, funções de servidor e armazenamento privado de fotos), Stripe (pagamentos recorrentes e portal de cobrança), Resend (e-mails de verificação e transacionais), ClickSend (SMS de verificação) e Vercel (hospedagem da aplicação web/PWA);
- Autoridades públicas ou judiciais: quando exigido por lei, regulamento ou ordem judicial.
3.2. Transferência internacional de dados (arts. 33 a 36 da LGPD): Alguns operadores tecnológicos podem processar ou armazenar dados em servidores localizados fora do Brasil. Nesses casos, o RKMED adota salvaguardas contratuais e técnicas compatíveis com a LGPD para assegurar nível adequado de proteção.

4. Segurança da informação, controle de acesso e modo offline
4.1. Adotamos medidas técnicas e administrativas de segurança (art. 46 da LGPD), incluindo mascaramento de CPF em telas de parceiros, operadores, diretoria e exportações (***.***.***-12), armazenamento privado de fotos sem metadados (EXIF/localização) com acesso por links temporários de curta duração, segregação de perfis e registros de auditoria imutáveis.
4.2. Armazenamento local offline: Para viabilizar a visualização do cartão digital e do histórico sem internet, o aplicativo mantém uma cópia local dos dados aprovados do próprio associado (com CPF mascarado) no armazenamento do navegador (IndexedDB). Essa cópia é removida automaticamente ao sair da conta ou trocar de usuário e pode ser apagada pelo próprio navegador. Recomenda-se manter o dispositivo protegido por senha ou biometria.

5. Prazos de retenção e eliminação (arts. 15 e 16 da LGPD)
5.1. Os dados pessoais são mantidos enquanto perdurar a relação contratual com o associado.
5.2. Encerrado o vínculo, os dados serão eliminados ou anonimizados, ressalvada a conservação pelo prazo estritamente necessário para cumprimento de obrigação legal ou regulatória (mínimo de 6 meses para registros de acesso — art. 15 do Marco Civil da Internet — e prazos fiscais/contábeis) e exercício regular de direitos nos prazos prescricionais do Código Civil e do CDC.
5.3. A fotografia cadastral é eliminada após o encerramento definitivo da conta, salvo necessidade de conservação amparada pelo art. 16 da LGPD.

6. Direitos do titular (art. 18 da LGPD)
6.1. O titular pode exercer, a qualquer momento pelo canal [E-MAIL DE PRIVACIDADE / DPO], os direitos previstos no art. 18 da LGPD: confirmação da existência de tratamento, acesso, correção de dados incompletos/inexatos/desatualizados, anonimização/bloqueio/eliminação de dados desnecessários ou excessivos, portabilidade, eliminação de dados tratados com consentimento, informação sobre compartilhamento, informação sobre a possibilidade de não fornecer consentimento, revogação do consentimento e peticionamento perante a ANPD.
6.2. Para segurança do titular, poderemos solicitar confirmação de identidade antes de atender às requisições.

7. Incidentes de segurança (art. 48 da LGPD)
7.1. Na ocorrência de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, o RKMED comunicará o fato à ANPD e aos titulares afetados em prazo razoável, informando as medidas técnicas e de segurança adotadas.

8. Atualizações desta Política
8.1. Esta Política poderá ser atualizada para refletir alterações operacionais ou legais, mantendo-se o histórico de versões e a versão vigente disponível no aplicativo.$$,
  true,
  true
)
on conflict (version) do update
set content = excluded.content,
    test_only = excluded.test_only,
    active = excluded.active;

insert into private.documents (version, kind, content, test_only, active)
values (
  'photo-2026-11-22-v1',
  'photo',
  $$# Termo de Autorização de Uso de Imagem (Foto) — RKMED Linha Gold

Versão: photo-2026-11-22-v1 · Vigência: a partir de 22/11/2026.

Em conformidade com o art. 5º, inciso X, da Constituição Federal, o art. 20 do Código Civil (Lei nº 10.406/2002) e a Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018), o titular autoriza [RAZÃO SOCIAL DA RKMED], inscrita no CNPJ sob o nº [CNPJ] ("RKMED"), a coletar, armazenar e exibir sua fotografia nas condições abaixo:

1. Finalidade exclusiva
1.1. A fotografia capturada no cadastro será utilizada exclusivamente para:
- exibição no cartão digital do próprio titular no aplicativo RKMED Linha Gold; e
- conferência visual humana realizada por funcionários autorizados dos estabelecimentos parceiros credenciados e pela equipe de administração/suporte do RKMED, a fim de confirmar que o portador do cartão ou CPF é o titular da assinatura e prevenir uso indevido por terceiros.
1.2. É expressamente vedado o uso da fotografia para fins publicitários, promocionais, comerciais ou de divulgação pública em qualquer meio.

2. Processamento técnico (sem reconhecimento facial biométrico)
2.1. No momento da captura, a imagem passa por verificação automatizada que identifica apenas a presença de um único rosto nítido para evitar fotos inválidas, seguida de redimensionamento para 600×600 pixels (JPEG) e remoção automática de metadados (como data, modelo do aparelho e geolocalização).
2.2. O RKMED não realiza reconhecimento facial automatizado, não extrai nem armazena templates biométricos e não executa prova de vida. A identificação no balcão é realizada exclusivamente por conferência visual humana.

3. Armazenamento, acesso e cópia offline
3.1. A fotografia é armazenada em repositório privado de acesso restrito, exibida apenas ao próprio titular, aos operadores internos autorizados (administração e suporte) e, pontualmente durante uma validação online ativa, ao estabelecimento parceiro por meio de link temporário de curta duração.
3.2. Uma cópia local da imagem pode permanecer armazenada no próprio dispositivo do titular para exibição offline do cartão digital, sendo removida ao encerrar a sessão ou trocar de conta no aplicativo.

4. Gratuidade, revogação e eliminação
4.1. A presente autorização é concedida de forma gratuita e vigora enquanto mantida a conta do titular no RKMED Linha Gold.
4.2. O titular poderá revogar esta autorização ou solicitar a atualização/eliminação da fotografia a qualquer tempo pelo canal [E-MAIL DE PRIVACIDADE / DPO], ciente de que a manutenção de fotografia válida é condição operacional necessária para a conferência visual e usufruto presencial dos benefícios nos parceiros.
4.3. Encerrado o vínculo contratual, a fotografia será eliminada, ressalvadas as hipóteses legais de conservação previstas no art. 16 da LGPD.$$,
  true,
  true
)
on conflict (version) do update
set content = excluded.content,
    test_only = excluded.test_only,
    active = excluded.active;
