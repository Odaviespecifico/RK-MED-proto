# Documentos Jurídicos — RKMED Linha Gold

Versão vigente em revisão jurídica: `2026-11-22-v1` (`terms-2026-11-22-v1`, `privacy-2026-11-22-v1` e `photo-2026-11-22-v1`).

Os arquivos desta pasta reúnem os textos estruturados conforme o ordenamento jurídico brasileiro (CDC — Lei nº 8.078/1990, Código Civil — Lei nº 10.406/2002, LGPD — Lei nº 13.709/2018 e Marco Civil da Internet — Lei nº 12.965/2014) para revisão e validação por advogado antes da liberação comercial.

## Campos a preencher na revisão jurídica

Antes de ativar os documentos para o ambiente de produção (`test_only = false` em `private.documents`), preencher os dados institucionais marcados entre colchetes:

- `[RAZÃO SOCIAL DA RKMED]`
- `[CNPJ]`
- `[ENDEREÇO COMERCIAL]`
- `[NOME DO ENCARREGADO OU SETOR]` e `[E-MAIL DE PRIVACIDADE / DPO]`
- `[E-MAIL DE SUPORTE]`

## Controle de versão no banco

Na tabela `private.documents`, as versões `*-2026-11-22-v1` permanecem com `test_only = true` até a aprovação final do advogado, preservando a trava que impede adesões comerciais sem documentos formalmente aprovados. Após a revisão jurídica, basta publicar uma nova migration com os dados institucionais preenchidos e `test_only = false`.
