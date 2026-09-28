# Dashboard GeoSJC no Power BI — passo a passo

Arquivos desta pasta:

| arquivo | para quê |
|---|---|
| `GeoSJC_RAIS.xlsx` | a base pronta: 1 tabela fato + 5 dimensões (leia a aba LEIA-ME) |
| `medidas_DAX.txt` | medidas prontas para colar (Estabelecimentos, Empregos, %…) |
| `tema_GeoSJC.json` | cores e fontes do dashboard, iguais às do mapa web |
| `sjc_bairros.topojson` | contorno dos bairros para o visual **Mapa de forma** |
| `sjc_setores_postais.topojson` | idem, por setor postal (CEP de 5 dígitos) |

> **Onde rodar:** o Power BI Desktop só existe para **Windows** (use o computador da Fatec,
> um Windows em máquina virtual, ou o notebook de alguém do grupo). No Linux dá para
> montar relatórios mais simples no navegador em app.powerbi.com, subindo o `.xlsx`,
> mas sem o Mapa de forma e com menos opções.

---

## 1. Carregar os dados

1. Power BI Desktop → **Obter dados → Pasta de trabalho do Excel** → `GeoSJC_RAIS.xlsx`.
2. Marque as **6 tabelas** (ícone de tabela, não o de planilha): `fato_estabelecimentos`,
   `dim_cep`, `dim_atividade`, `dim_subsetor`, `dim_porte`, `dim_natureza`. Não precisa da LEIA-ME.
3. Clique em **Transformar dados** (não em Carregar) e confira os tipos:
   - `cep`, `cep_formatado`, `setor_postal`, `cnae_subclasse`, `cnae_classe`, `natureza_cod` → **Texto**
     (se o Power BI transformar em número, os zeros à esquerda somem e os relacionamentos quebram;
     troque pelo ícone "ABC" no cabeçalho da coluna, nas duas tabelas de cada relacionamento).
   - `latitude`, `longitude` → **Número decimal**.
4. **Fechar e aplicar**.

## 2. Montar o modelo (relacionamentos)

Vá em **Exibição de modelo** (terceiro ícone à esquerda). O Power BI costuma criar sozinho;
confira se ficaram exatamente estes cinco, todos **muitos-para-um (*:1)** com direção **única**:

| de (fato_estabelecimentos) | para |
|---|---|
| `cep` | `dim_cep[cep]` |
| `cnae_subclasse` | `dim_atividade[cnae_subclasse]` |
| `subsetor_cod` | `dim_subsetor[subsetor_cod]` |
| `porte_cod` | `dim_porte[porte_cod]` |
| `natureza_cod` | `dim_natureza[natureza_cod]` |

Se faltar algum, arraste a coluna do fato até a coluna da dimensão.

Ajustes que evitam dor de cabeça depois:
- `dim_cep[latitude]` → Ferramentas de coluna → **Categoria de dados: Latitude**; `longitude` → **Longitude**;
  `bairro` → **Categoria: Local**. Em todas as três, **Resumir por: Não resumir**.
- `dim_porte[faixa_rais]` → **Classificar por coluna → ordem** (senão "1.000 ou mais" vem antes de "10 a 19").
- `dim_subsetor[grande_setor]` → **Classificar por coluna → ordem_grande_setor**.
- Oculte do modo relatório (botão direito → Ocultar) as colunas de código que ninguém precisa ver:
  `id_estab`, `subsetor_cod`, `porte_cod`, `natureza_cod`, as colunas `ordem`.

## 3. Criar as medidas

1. **Página Inicial → Inserir dados** → deixe vazio, nome `_Medidas` → Carregar.
2. Clique na tabela `_Medidas` → **Nova medida** → cole uma medida do `medidas_DAX.txt` → Enter. Repita.
3. Formate: `Estabelecimentos` e `Empregos` → número inteiro com separador de milhar;
   as que começam com `%` → **Porcentagem**, 1 casa decimal.

## 4. Aplicar o tema

**Exibição → Temas → Procurar temas** → `tema_GeoSJC.json`.

---

## 5. Páginas do dashboard

Sugestão de 5 páginas, cobrindo as histórias do backlog (números entre colchetes).
Em todas: segmentações de **grande setor**, **porte** e **bairro** no topo.
Para elas valerem em todas as páginas: **Exibição → Sincronizar segmentações**.

### Página 1 — Visão geral  [8, 9, 19]
- 4 **Cartões**: `Estabelecimentos`, `Empregos`, `% com empregados`, `Empregos por estab. (com empregados)`.
- **Gráfico de rosca**: legenda `dim_subsetor[grande_setor]`, valores `Empregos`.
- **Gráfico de barras clusterizado**: eixo `dim_porte[faixa_resumida]`, valores `Estabelecimentos`.
- **Cartão** com a medida `Fonte` no rodapé  [21].

### Página 2 — Atividades econômicas  [3, 10, 12, 13]
- **Segmentação** `dim_atividade[atividade]` no estilo **Suspenso** com pesquisa ligada (… → Pesquisar).
- **Barras horizontais** "Top 15 atividades": eixo `dim_atividade[atividade]`, valores `Estabelecimentos`.
  No painel Filtros do visual: `atividade` → **Tipo de filtro: N superior** → 15 → por `Estabelecimentos`.
- **Mapa de árvore (Treemap)**: categoria `dim_subsetor[grande_setor]`, detalhes `dim_subsetor[subsetor]`, valores `Estabelecimentos`  [4].
- **Tabela**: `atividade`, `cnae_subclasse`, `Estabelecimentos`, `Empregos`, `% dos empregos`.

### Página 3 — Subsetores e empregos  [4, 6, 7, 11]
- **Gráfico de colunas e linhas**: eixo `dim_subsetor[subsetor]`; colunas `Estabelecimentos`; linha `Empregos`.
  Mostra quem tem muitos estabelecimentos × quem emprega muito: material de transporte tem só 82 estabelecimentos e mais de 17 mil empregos.
- **Barras empilhadas 100%**: eixo `dim_subsetor[grande_setor]`, legenda `dim_porte[faixa_resumida]`, valores `Empregos`.
- **Matriz**: linhas `grande_setor` → `subsetor` (expandir), valores `Estabelecimentos`, `Empregos`, `% dos empregos`.

### Página 4 — Porte dos estabelecimentos  [14, 15]
- **Colunas**: eixo `dim_porte[faixa_rais]`, valores `Estabelecimentos` — mostra a predominância de micro.
- **Colunas**: mesmo eixo, valores `Empregos` — mostra que poucos grandes concentram muitos empregos.
  Coloque os dois lado a lado; é a leitura mais interessante do trabalho.
- **Rosca**: `dim_porte[porte_sebrae]` × `Empregos`.
- **Barras**: `dim_natureza[grupo_natureza]` × `Estabelecimentos`  [17].

### Página 5 — Mapa  [5]
Duas opções (faça a A; a B é o plano reserva se o Azure Maps estiver bloqueado na conta da Fatec):

**A. Mapa do Azure (bolhas por CEP)**
- Visual **Mapa do Azure** → Latitude `dim_cep[latitude]`, Longitude `dim_cep[longitude]`,
  Tamanho `Empregos`, Legenda `dim_subsetor[grande_setor]`, Dicas de ferramenta `dim_cep[bairro]`, `dim_cep[logradouro]`.
- Formatar → Camada de bolhas → Tamanho mínimo pequeno; ligue **Mapa de calor** se quiser a mancha de densidade.

**B. Mapa de forma (bairros coloridos)**
1. Arquivo → Opções → **Recursos de visualização** → marque **Visual Mapa de forma** → reinicie o Power BI.
2. Visual **Mapa de forma** → Local `dim_cep[bairro]`, Saturação de cor `Empregos`.
3. Formatar → **Configurações de mapa → Tipo de mapa: Mapa personalizado → Adicionar mapa** → `sjc_bairros.topojson`.
4. Formatar → Cores padrão → Divergente/gradiente do claro ao `#0E5A6E`.
   (Com `sjc_setores_postais.topojson` e Local = `dim_cep[setor_postal]` você tem a versão por setor postal.)

Ao lado do mapa: **Tabela** "Principais bairros": `bairro`, `Estabelecimentos`, `Empregos`, `Ranking bairro (empregos)`.

**Link para o mapa web:** insira um **Botão → Em branco** com o texto "Abrir mapa detalhado (GeoSJC)" →
Ação: **URL web** → endereço onde o GeoSJC estiver publicado.

### (Opcional) Página 6 — Dicionário  [16, 17, 21]
Tabelas simples com `dim_subsetor`, `dim_porte` e `dim_natureza` — funciona como legenda dos códigos.

---

## 6. Deixar interativo de verdade
- **Interações entre visuais**: selecione um visual → Formatar → **Editar interações** → escolha
  *Filtrar* nos gráficos de barras e *Realçar* nas roscas.
- **Detalhamento (drill-through)**: crie uma página "Detalhe do bairro", arraste `dim_cep[bairro]` para
  **Detalhamento** no painel de campos. Nas outras páginas, clique direito num bairro → Detalhar.
- **Dica de ferramenta de página**: página pequena (tamanho Dica de ferramenta) com o Top 5 atividades;
  aponte a dica do mapa para ela.
- **Indicadores (bookmarks)** + botões para alternar "Estabelecimentos × Empregos" nos gráficos.

## 7. Atualizar com uma RAIS nova
```bash
cd pipeline
python gerar_camadas.py  --rais NOVA_RAIS.csv --ceps banco-ceps/cep   # atualiza o mapa web
python gerar_powerbi.py  --rais NOVA_RAIS.csv                          # atualiza o Excel
```
No Power BI: substitua o `GeoSJC_RAIS.xlsx` pelo novo (mesmo nome e lugar) → **Página Inicial → Atualizar**.

## Cuidados na apresentação
- A RAIS pública **não identifica a empresa**: fale em "estabelecimentos", nunca cite nomes.
- **Empregos = vínculos ativos em 31/12**, não o total de pessoas que passaram pela empresa no ano.
- A localização é **pelo CEP**; 152 CEPs têm posição aproximada (coluna `localizacao_aproximada`).
- Os bairros vêm do cadastro dos Correios e os contornos são aproximados, não são o abairramento oficial da prefeitura.
