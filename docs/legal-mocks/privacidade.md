# Política de Privacidade — RKMED Linha Gold

Versão: `privacy-2026-11-22-v1` · Vigência: a partir de 22/11/2026.

Esta Política de Privacidade explica como **[RAZÃO SOCIAL DA RKMED]**, inscrita no CNPJ sob o nº **[CNPJ]**, com sede em **[ENDEREÇO COMERCIAL]** ("RKMED"), na qualidade de **Controladora**, realiza o tratamento de dados pessoais no âmbito do aplicativo e clube de benefícios **RKMED Linha Gold**, em conformidade com a Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018) e o Marco Civil da Internet (Lei nº 12.965/2014).

**Canal do Encarregado pelo Tratamento de Dados Pessoais (DPO — art. 41 da LGPD):** [NOME DO ENCARREGADO OU SETOR] · E-mail: **[E-MAIL DE PRIVACIDADE / DPO]**.

## 1. Dados pessoais coletados

1.1. Para a prestação dos serviços do clube de benefícios, o RKMED trata os seguintes dados pessoais:
- **Identificação e cadastro:** nome completo, CPF e data de nascimento;
- **Contato e autenticação:** endereço de e-mail, número de telefone celular e registros de verificação por código temporário (OTP);
- **Imagem para conferência visual:** fotografia do rosto do titular (processada em formato JPEG 600×600 pixels, sem metadados);
- **Assinatura e faturamento:** situação da assinatura, datas de ciclo, faturas e identificadores de transação junto ao provedor de pagamentos (o RKMED **não armazena** número completo de cartão de crédito ou código de segurança);
- **Uso dos benefícios e suporte:** histórico de compras registradas nos parceiros (estabelecimento, data, valor bruto, desconto e valor final), registros de aceite documental (versão e data/hora), solicitações de suporte e registros de acesso/auditoria.

1.2. **Ausência de dados sensíveis de saúde e de biometria de identificação:** O RKMED **não coleta, não solicita e não armazena** prontuários médicos, diagnósticos, laudos, resultados ou categorias de exames. A fotografia cadastrada não é utilizada para reconhecimento facial automatizado nem para geração de template biométrico; o processamento técnico limita-se a verificar a presença de um rosto na imagem, sendo a conferência no balcão estritamente **visual e humana**.

## 2. Finalidades e bases legais do tratamento (arts. 7º e 11 da LGPD)

Tratamos dados pessoais apenas para finalidades legítimas, específicas e informadas:
- **Execução de contrato e procedimentos preliminares (art. 7º, V):** criação e manutenção da conta, autenticação em dois canais no cadastro (e-mail e SMS) e acesso posterior por código temporário (OTP), emissão do cartão digital, validação de elegibilidade nos parceiros, cobrança da mensalidade, cálculo de economia e atendimento de suporte;
- **Cumprimento de obrigação legal ou regulatória (art. 7º, II):** guarda de registros de acesso a aplicações de internet pelo prazo mínimo de 6 (seis) meses (art. 15 do Marco Civil da Internet), bem como cumprimento de obrigações fiscais, contábeis e regulatórias;
- **Exercício regular de direitos em processo judicial, administrativo ou arbitral (art. 7º, VI):** preservação de registros de aceite contratual, transações, estornos, cobranças e auditorias;
- **Prevenção à fraude, segurança e legítimo interesse (art. 7º, IX):** controle de tentativas de acesso, proteção das contas, prevenção ao uso por terceiros e integridade operacional;
- **Consentimento / autorização específica (art. 7º, I):** uso da fotografia do titular para exibição no cartão digital e conferência visual no balcão, nos termos do Termo de Autorização de Uso de Imagem.

## 3. Compartilhamento de dados e operadores

3.1. O RKMED não comercializa dados pessoais. O compartilhamento ocorre apenas na medida estritamente necessária para a operação:
- **Estabelecimentos parceiros credenciados:** exclusivamente durante atendimento autorizado online, com acesso restrito a nome, fotografia, CPF mascarado e situação de elegibilidade;
- **Operadores de tecnologia e infraestrutura:**
  - **Supabase:** banco de dados, autenticação, funções de servidor e armazenamento privado de fotos;
  - **Stripe:** processamento de pagamentos recorrentes, gestão de faturas e portal de cobrança;
  - **Resend:** envio de e-mails de verificação de acesso e comunicações transacionais/suporte;
  - **ClickSend:** envio de mensagens SMS com códigos de verificação;
  - **Vercel:** hospedagem da aplicação web/PWA.
- **Autoridades públicas ou judiciais:** quando exigido por lei, regulamento ou ordem judicial.

3.2. **Transferência internacional de dados (arts. 33 a 36 da LGPD):** Alguns operadores tecnológicos podem processar ou armazenar dados em servidores localizados fora do Brasil. Nesses casos, o RKMED adota salvaguardas contratuais e técnicas compatíveis com a LGPD para assegurar nível adequado de proteção.

## 4. Segurança da informação, controle de acesso e modo offline

4.1. Adotamos medidas técnicas e administrativas de segurança (art. 46 da LGPD), incluindo:
- **Minimização de CPF:** o CPF completo nunca é exibido em telas de parceiros, operadores, diretoria ou arquivos exportados (utilizando-se mascaramento no formato `***.***.***-12`);
- **Fotos privadas:** armazenamento em repositório privado com remoção de metadados (EXIF/localização) e acesso somente por links temporários de curta duração a perfis autorizados;
- **Segregação de perfis e auditoria:** permissões distintas para administração, suporte, diretoria (somente leitura agregada, sem contatos ou fotos) e parceiros, com registros de auditoria imutáveis.

4.2. **Armazenamento local offline:** Para viabilizar a visualização do cartão digital e do histórico sem internet, o aplicativo mantém uma cópia local dos dados aprovados do próprio associado (com CPF mascarado) no armazenamento do navegador (IndexedDB). Essa cópia é removida automaticamente ao sair da conta ou trocar de usuário e pode ser apagada pelo próprio navegador. O armazenamento local não substitui o bloqueio de tela do aparelho; recomendamos manter seu dispositivo protegido por senha ou biometria.

## 5. Prazos de retenção e eliminação (arts. 15 e 16 da LGPD)

5.1. Os dados pessoais são mantidos enquanto perdurar a relação contratual com o associado.

5.2. Encerrado o vínculo, os dados serão eliminados ou anonimizados, ressalvada a conservação pelo prazo estritamente necessário para:
- cumprimento de obrigação legal ou regulatória (incluindo guarda de registros de acesso por no mínimo 6 meses, nos termos do art. 15 do Marco Civil da Internet, e prazos fiscais/contábeis aplicáveis);
- exercício regular de direitos e defesa em eventuais processos administrativos ou judiciais, observados os prazos prescricionais previstos no Código Civil e no Código de Defesa do Consumidor.

5.3. A fotografia cadastral é eliminada após o encerramento definitivo da conta, salvo necessidade de conservação amparada pelo art. 16 da LGPD.

## 6. Direitos do titular (art. 18 da LGPD)

6.1. O titular pode exercer, a qualquer momento e mediante requisição ao canal **[E-MAIL DE PRIVACIDADE / DPO]**, os direitos previstos no art. 18 da LGPD:
- confirmação da existência de tratamento e acesso aos dados pessoais;
- correção de dados incompletos, inexatos ou desatualizados;
- anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;
- portabilidade dos dados a outro fornecedor, observada a regulamentação da ANPD;
- eliminação dos dados pessoais tratados com base no consentimento, ressalvadas as exceções do art. 16 da LGPD;
- informação sobre as entidades públicas e privadas com as quais houve compartilhamento;
- informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa, bem como a revogação do consentimento a qualquer tempo;
- peticionamento perante a Autoridade Nacional de Proteção de Dados (ANPD).

6.2. Para segurança do titular, poderemos solicitar confirmação de identidade antes de atender às requisições.

## 7. Incidentes de segurança (art. 48 da LGPD)

7.1. Na ocorrência de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, o RKMED comunicará o fato à ANPD e aos titulares afetados em prazo razoável, informando as medidas técnicas e de segurança adotadas.

## 8. Atualizações desta Política

8.1. Esta Política poderá ser atualizada para refletir alterações operacionais ou legais, mantendo-se o histórico de versões e a versão vigente disponível no aplicativo.
