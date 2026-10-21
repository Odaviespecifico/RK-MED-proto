# Paginação e desempenho local — 21/10/2026

Associados, cobranças por associado, compras internas, balcão e histórico do associado agora usam páginas de 25 registros. A busca por nome e o filtro de inadimplência são aplicados no banco, antes do limite. As telas de associados/compras não baixam a lista completa nem calculam economia somando apenas a página visível.

## Contratos e navegação

| RPC | Acesso | Conteúdo |
| --- | --- | --- |
| `rk_members_page` | Admin, suporte e diretoria | Página de associados, CPF mascarado e economia completa por associado; diretoria sem contatos ou fatura |
| `rk_purchases_page` | Associado, parceiro e equipe autorizada | Página limitada ao próprio associado/estabelecimento ou à equipe; parâmetro `p_savings=true` retorna saldo completo somente para o próprio associado |

`p_limit` aceita 1–100, com padrão 25. `p_at` e `p_id` formam um cursor completo, baseado em data e UUID em ordem decrescente. Não há offset crescente. A ordenação resolve empates de data e evita que uma compra mais recente desloque a página seguinte já iniciada. Novos registros anteriores ao cursor aparecem ao atualizar/reiniciar a navegação. A paginação consulta o estado atual; não é um relatório congelado durante alterações de filtros ou estornos.

Trocar filtro ou atualizar reinicia na primeira página. Respostas atrasadas de pesquisas anteriores são ignoradas. Índices atendem ordenação por associado/parceiro, busca por nome e filtro de inadimplência. Curingas `%`, `_` e barra na pesquisa são tratados como texto literal.

Economia acumulada vem do banco com centavos exatos como texto, excluindo compras estornadas. O saldo não depende da quantidade de páginas abertas. Relatórios e CSV continuam com seu contrato e autorização próprios. Os RPCs antigos `rk_purchases`/`rk_admin_members` permanecem apenas por compatibilidade, limitados a 100 itens; não são exportações completas e não são usados pelo frontend conectado.

A demonstração segue isolada. No modo conectado, parceiros/equipe dependem de conexão; consultas não são enfileiradas para execução posterior.

## Histórico offline

As páginas do associado já consultadas são incorporadas ao snapshot da própria conta, sem apagar registros baixados antes. Dados novos substituem a versão local do mesmo registro, inclusive estornos. O saldo completo é salvo separadamente. Ao abrir offline, a interface pagina os dados salvos e informa que o histórico pode estar incompleto/desatualizado. Logout e troca de conta continuam removendo os dados anteriores.

Snapshots anteriores são aceitos; os campos novos são opcionais. Não foi adicionada expiração de conteúdo. O armazenamento pode crescer conforme o uso e ser removido pelo navegador; testar capacidade e comportamento em celulares físicos continua necessário.

## Medição executada

Resultados completos e configuração da máquina: [performance-local.json](performance-local.json).

- Supabase Docker local por HTTP loopback, em Linux, Intel i7-13620H, 16 CPUs lógicas.
- 2.000 associados e 10.060 compras sintéticas antes da fase de gravação.
- Oito consultas de aquecimento; 200 consultas paginadas com dez requisições concorrentes.
- Cinquenta consultas de associado, cinquenta cotações e **50 compras distintas enviadas simultaneamente**, distribuídas entre duas sessões de parceiro. Recibos, desconto, autoria e economia acumulada foram conferidos no backend real.

| Operação | Amostras | p50 | p95 | Máximo |
| --- | ---: | ---: | ---: | ---: |
| Páginas/busca/cobranças/saldo | 200 | 29,67 ms | 117,15 ms | 335,63 ms |
| Consulta de associado | 50 | 90,96 ms | 127,82 ms | 131,32 ms |
| Cotação | 50 | 68,15 ms | 90,58 ms | 92,74 ms |
| Registro da compra | 50 | 104,77 ms | 173,25 ms | 178,93 ms |

As metas locais de API p95 ≤500 ms e consulta p95 ≤2 s foram atendidas nessa execução. Consulta HTTP não mede a jornada completa de câmera, foto e interação humana. Estes números não comprovam SLA hospedado, rede móvel, cold start, disponibilidade prolongada ou desempenho dos provedores externos.

## Repetir

Com Docker/Supabase local ativo e dependências instaladas:

```bash
npm run test:performance
```

O comando recusa destino fora do Docker local, cria identidades/estabelecimentos/dados sintéticos exclusivos da execução e os remove ao terminar normalmente. Atualiza `docs/performance-local.json`. Não cobra, envia mensagens ou reseta dados de seed/usuário. A limpeza de transações sintéticas usa uma conexão administrativa local com gatilhos temporariamente desabilitados **apenas nessa conexão**, dentro de transação e com filtros dos UUIDs gerados; não copiar esse mecanismo para operações de produção. Se o processo for interrompido à força, conferir eventuais fixtures restantes antes de nova medição; não executar reset indiscriminado para limpá-las.

Para o teste móvel e offline, iniciar o build compilado em 4174:

```bash
npm run build:sandbox
npm run preview -- --outDir dist-sandbox --port 4174 --mode sandbox --strictPort
```

Em outro terminal:

```bash
npm run test:connected:pagination
```

O teste usa fixtures próprias menores, navega entre páginas, verifica filtro no servidor e resposta atrasada, consulta três páginas de histórico e reabre a PWA offline. Backend Auth/RPC/Storage são reais locais. A foto e as identidades sintéticas são removidas ao final.

Referências técnicas: [PostgreSQL: ordem e custo de LIMIT/OFFSET](https://www.postgresql.org/docs/current/queries-limit.html), [índices de busca pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html).
