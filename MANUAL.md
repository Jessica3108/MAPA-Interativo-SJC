# Manual do GeoSJC

Um guia para entender o projeto por inteiro, sem precisar ser programadora.

---

## 1. O que é o GeoSJC, em uma frase

É um **mapa interativo das empresas de São José dos Campos**, feito com os dados da **RAIS**,
parecido com o GeoSanja da prefeitura, só que mostrando a **economia da cidade**: onde estão
os estabelecimentos, de quais setores e quantos empregos geram.

Junto com o mapa vem uma **base pronta para o Power BI**, para montar o dashboard do trabalho.

---

## 2. Os dados: de onde vem tudo

### A RAIS
A **RAIS (Relação Anual de Informações Sociais)** é uma declaração que toda empresa do Brasil
entrega todo ano ao Ministério do Trabalho. Cada linha da base é **um estabelecimento**
(uma loja, uma fábrica, um escritório) e diz, entre outras coisas:

| informação | exemplo | o que significa |
|---|---|---|
| CEP do estabelecimento | 12216-580 | onde ele fica |
| CNAE (atividade) | 4781-4/00 | o que ele faz ("comércio de roupas") |
| Subsetor IBGE | 16 | um agrupamento maior ("comércio varejista") |
| Tamanho | 3 | faixa de número de empregados ("5 a 9") |
| Vínculos ativos | 7 | quantas pessoas estavam empregadas em 31/12 |
| Natureza jurídica | 2062 | tipo de empresa ("sociedade limitada") |

A base de São José dos Campos tem **47.339 estabelecimentos** e **206.717 empregos**.

### O que a RAIS pública **não** tem
- **Nome da empresa** e **endereço completo** (por sigilo). Por isso, no mapa, cada ponto é
  **um CEP**, com todos os estabelecimentos daquele CEP juntos.
- Nunca diga "a empresa X fica aqui": diga "neste CEP há N estabelecimentos de tal atividade".

### Como o CEP virou um ponto no mapa
A RAIS só tem o número do CEP. Para saber **onde** ele fica (latitude e longitude), usamos uma
base aberta da internet chamada **banco-ceps**, que diz para cada CEP a rua, o bairro e as
coordenadas. Ela achou **99,7%** dos CEPs. Os que faltaram (152) foram colocados no centro do
seu "setor postal" e aparecem marcados como **posição aproximada**.

> **Setor postal** = os 5 primeiros números do CEP (ex.: 12246). É uma área da cidade.

---

## 3. O projeto em 4 partes

Pense numa **cozinha de restaurante**:

```
  pipeline/          →      web/public/dados/      →      web/          e      powerbi/
  (a cozinha:              (os pratos prontos:            (o salão: o mapa     (outro salão:
   prepara os dados)        arquivos organizados)          que as pessoas usam)  o dashboard)

                              api/  (o garçom — opcional, para o futuro)
```

| pasta | o que é | linguagem | ela precisa mexer? |
|---|---|---|---|
| `pipeline/` | transforma a planilha da RAIS em arquivos prontos | Python | só quando chegar RAIS nova |
| `web/` | o site do mapa | TypeScript + React | quase nunca |
| `powerbi/` | tudo para o dashboard do Power BI | — | **sim, é a parte dela** |
| `api/` | um servidor opcional para o futuro | Python (FastAPI) | não |

---

## 4. Parte a parte

### 4.1 `pipeline/` — a cozinha (Python)

Aqui ficam os programas que **preparam os dados**. Você roda uma vez e eles geram os arquivos
que o mapa e o Power BI usam.

| arquivo | o que faz |
|---|---|
| `gerar_camadas.py` | lê a RAIS, descobre as coordenadas de cada CEP, traduz os códigos e desenha os contornos de bairros e setores. Gera os arquivos do mapa. |
| `gerar_powerbi.py` | pega o mesmo resultado e monta o Excel organizado para o Power BI. |
| `dicionarios.py` | a "tradução" dos códigos: 16 → "Comércio varejista", 2062 → "Sociedade limitada" etc. **Se um nome estiver errado ou faltando, é aqui que se corrige.** |
| `sjc_limite.json` | o contorno oficial do município (do IBGE). |

**Quando usar:** só quando chegar uma RAIS nova (de outro ano, por exemplo). Veja a seção 6.

### 4.2 `web/public/dados/` — os pratos prontos

São os arquivos que a cozinha produziu. **Não edite à mão**: se precisar mudar, mude o
pipeline e rode de novo.

| arquivo | conteúdo |
|---|---|
| `camadas.json` | o **cardápio** do mapa: a lista de camadas que aparecem no painel (nome, cor, se começa ligada…) |
| `estabelecimentos.json` | os 47 mil estabelecimentos, em formato compacto |
| `ceps.json` | cada CEP com rua, bairro e coordenadas |
| `dicionarios.json` | a tradução dos códigos |
| `limite.geojson` | contorno da cidade |
| `bairros.geojson` | contornos dos bairros (aproximados, desenhados a partir dos CEPs) |
| `setores.geojson` | contornos dos setores postais |

> **JSON** e **GeoJSON** são só formatos de texto organizado. GeoJSON é o formato padrão para
> guardar formas de mapa (pontos, linhas, áreas).

### 4.3 `web/` — o site do mapa (React + TypeScript)

É o **geoportal** propriamente dito. Ele abre no navegador e tem:

- **Busca** (no topo): digite um CEP, rua, bairro ou atividade.
- **Aba Camadas**: liga e desliga o que aparece no mapa e ajusta a transparência.
  - *Economia*: pontos por CEP, mapa de calor, concentração por bairro
  - *Divisões*: limite municipal, bairros, setores postais
  - *Mapa base*: ruas, satélite ou sem fundo
- **Aba Filtros**: mostra só uma atividade, setor, porte ou bairro.
- **Aba Indicadores**: números e rankings (clique num item para filtrar).
- **Estabelecimentos × Empregos** (canto superior direito): muda o que os tamanhos e as cores medem.
- **Clique no mapa**: abre um painel com o que existe naquele ponto ou bairro.

Como ler o mapa de pontos:
- **cor** = setor que mais aparece naquele CEP (azul Indústria, laranja Construção,
  vermelho Comércio, verde Serviços, roxo Adm. pública, oliva Agropecuária)
- **tamanho** = número de estabelecimentos (ou de empregos)
- **ponto mais apagado** = posição aproximada

O que tem dentro de `web/` (só para saber que existe):

| item | o que é |
|---|---|
| `src/` | o código do site. `components/` são as peças da tela (busca, painéis, legenda); `mapa/` é o mapa; `dados/` é quem lê os arquivos e faz as contas dos filtros |
| `public/` | arquivos que vão junto com o site (os dados) |
| `package.json` | a lista de "peças prontas" que o site usa (React, Leaflet para mapas…) |
| `node_modules/` | onde essas peças ficam instaladas. É criada pelo `npm install`, é enorme e **não vai para o GitHub** |
| `index.html`, `vite.config.ts`, `tsconfig.json` | configurações. Não precisa mexer |

### 4.4 `powerbi/` — o dashboard (a parte dela)

| arquivo | para quê |
|---|---|
| `GeoSJC_RAIS.xlsx` | a base pronta para o Power BI (veja abaixo) |
| `GUIA_POWER_BI.md` | **o passo a passo do dashboard**, página por página |
| `medidas_DAX.txt` | fórmulas prontas para colar no Power BI |
| `tema_GeoSJC.json` | as cores e fontes, iguais às do mapa |
| `sjc_bairros.topojson`, `sjc_setores_postais.topojson` | contornos para o visual "Mapa de forma" |

**O Excel em modelo estrela.** Em vez de uma planilha gigante, os dados estão separados em
abas que se ligam por um código, como uma agenda de contatos:

```
                     dim_atividade (o que faz)
                            │
 dim_cep (onde fica) ── fato_estabelecimentos ── dim_subsetor (setor)
                            │               └── dim_natureza (tipo de empresa)
                       dim_porte (tamanho)
```

- **fato_estabelecimentos**: uma linha por estabelecimento, só com códigos e números.
- **dim_…** ("dimensões"): as tabelas de tradução. Ex.: `dim_cep` diz que o CEP 12216580 fica
  na Av. Dep. Benedito Matarazzo, no Jardim Oswaldo Cruz, nas coordenadas tal.

Por que assim? O Power BI fica mais rápido, os filtros funcionam em todos os gráficos de uma vez
e é o formato que os professores esperam ver em BI.

**DAX** é a linguagem de fórmulas do Power BI (parecida com as fórmulas do Excel).
"Medida" é uma fórmula que recalcula conforme os filtros: `Empregos = SUM(vinculos_ativos)`.

### 4.5 `api/` — o garçom (opcional)

Um pequeno servidor em Python (**FastAPI**) que entrega os mesmos dados pela internet.
**Hoje não é necessário**: o site lê os arquivos direto. Serve para o futuro, se a base crescer
muito (vários anos da RAIS) ou se quiserem que outros sistemas consultem os dados.

### 4.6 Arquivos soltos na raiz

| arquivo | o que é |
|---|---|
| `README.md` | a "capa" do projeto no GitHub: resumo técnico e comandos |
| `MANUAL.md` | este manual |
| `.gitignore` | a lista do que **não** deve ir para o GitHub (pastas pesadas, temporários). O ponto na frente deixa o arquivo "oculto" |

---

## 5. Tarefas do dia a dia

### Abrir o mapa no computador
No terminal do VS Code (**Terminal → New Terminal**):
```bash
cd web
npm run dev
```
Abra **http://localhost:5173** no navegador. Para desligar: clique no terminal e aperte `Ctrl + C`.

> Na primeira vez em um computador novo, antes do `npm run dev`, rode `npm install`
> (instala as peças; demora um pouco).

### Salvar alterações no GitHub
Sempre que mudar algo e quiser guardar:
```bash
git add .
git commit -m "escreva aqui o que mudou"
git push
```
- `add` = separar o que vai ser salvo
- `commit` = tirar uma "foto" do projeto com uma legenda
- `push` = enviar a foto para o GitHub

### Pegar alterações que outra pessoa fez
```bash
git pull
```

### Trabalhar no Power BI
Abra o Power BI Desktop e siga o `powerbi/GUIA_POWER_BI.md`. Salve o arquivo do dashboard
(`.pbix`) dentro da pasta `powerbi/` e mande para o GitHub com os comandos acima.

---

## 6. Quando chegar uma RAIS nova

1. Deixe a planilha nova tratada (mesmas colunas da atual) em algum lugar do computador.
2. Na primeira vez, baixe a base de CEPs (é grande, ~5 GB):
   ```bash
   cd pipeline
   git clone --depth 1 https://github.com/gpfconfea/banco-ceps
   ```
3. Rode os dois programas:
   ```bash
   cd pipeline
   python gerar_camadas.py --rais "C:/caminho/da/nova_rais.csv" --ceps banco-ceps/cep
   python gerar_powerbi.py --rais "C:/caminho/da/nova_rais.csv"
   ```
4. O mapa já mostra os dados novos (atualize a página). No Power BI, clique em **Atualizar**.
5. Salve no GitHub (`git add .`, `git commit`, `git push`).

---

## 7. Quando algo dá errado

| mensagem ou sintoma | o que fazer |
|---|---|
| `npm não é reconhecido` / `node não é reconhecido` | feche e abra o VS Code; se continuar, reinstale o Node.js |
| `execução de scripts foi desabilitada` (PowerShell) | rode uma vez: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `python não foi encontrado` | desligue os "Aliases de execução" do Python nas Configurações do Windows, ou use `py` no lugar de `python` |
| O mapa fica em "Carregando dados…" | confira se `web/public/dados/` tem os 7 arquivos |
| "Ruas (OpenStreetMap)" riscado, "indisponível" | sem internet ou site bloqueado; o mapa funciona "sem fundo" normalmente |
| `git push` recusado (`rejected`) | rode `git pull` e depois `git push` de novo |
| No VS Code aparece "Restricted Mode" | clique em **Manage → Trust** |
| `LF will be replaced by CRLF` | só um aviso do Windows, pode ignorar |

---

## 8. Para a apresentação

**O que o projeto entrega**
- Um mapa interativo próprio, no estilo do GeoSanja, com a economia da cidade.
- Um dashboard em Power BI com indicadores por setor, porte, atividade e bairro.
- Um processo que se repete: chegou RAIS nova, roda o pipeline e tudo se atualiza.

**Achados que chamam atenção**
- **Material de transporte** tem só **82 estabelecimentos**, mas mais de **17 mil empregos**:
  poucas empresas muito grandes (o polo aeroespacial e automotivo da cidade).
- **68%** dos estabelecimentos não tinham nenhum empregado registrado em 31/12, mas os empregos
  se concentram nos poucos estabelecimentos grandes.
- A **Indústria** é só **6%** dos estabelecimentos, mas responde por **20%** dos empregos.
  **Serviços** (62% dos estabelecimentos, 51% dos empregos) e **Comércio** (25% e 22%) dominam em quantidade.

**Cuidados ao falar dos dados**
- Fale em **estabelecimentos**, não em "empresas com nome": a RAIS pública não identifica.
- **Empregos** = vínculos ativos em **31 de dezembro** do ano da base.
- A localização é **pelo CEP**, não pelo endereço exato.
- Os **bairros são aproximados** (vêm do cadastro dos Correios, não do mapa oficial da prefeitura).

---

## 9. Glossário rápido

| termo | significado |
|---|---|
| **API** | um "garçom" digital: um programa que entrega dados quando alguém pede |
| **Camada** | cada "folha transparente" do mapa (pontos, bairros, ruas…), que pode ser ligada ou desligada |
| **CNAE** | Classificação Nacional de Atividades Econômicas: o código do que a empresa faz |
| **Commit** | uma "foto" salva do projeto, com uma descrição |
| **Coroplético** | mapa em que as áreas são pintadas conforme um valor (mais escuro = mais) |
| **DAX** | linguagem de fórmulas do Power BI |
| **Dimensão / Fato** | no modelo estrela: tabelas de descrição (dimensão) e tabela de registros (fato) |
| **Frontend** | a parte que a pessoa vê e usa (o site) |
| **GeoJSON / TopoJSON** | formatos de arquivo para formas de mapa |
| **Git / GitHub** | Git guarda o histórico do projeto; GitHub é o site onde esse histórico fica online |
| **Latitude / Longitude** | as coordenadas de um ponto na Terra |
| **Leaflet** | a biblioteca que desenha o mapa no site |
| **node_modules** | pasta com as peças prontas que o site usa; é recriada com `npm install` |
| **npm** | o "instalador de peças" do mundo JavaScript |
| **Pipeline** | a sequência de passos que transforma dados brutos em dados prontos |
| **React** | a ferramenta usada para montar as telas do site |
| **RAIS** | a base do Ministério do Trabalho com todos os estabelecimentos formais |
| **Repositório (repo)** | a pasta do projeto guardada no Git/GitHub |
| **Setor postal** | os 5 primeiros dígitos do CEP; uma área da cidade |
| **Terminal** | a janela onde se digitam comandos (no VS Code: Terminal → New Terminal) |
| **TypeScript** | a linguagem em que o site foi escrito (JavaScript com mais verificações) |
| **Vínculo ativo** | um emprego formal que existia em 31/12 |
| **Voronoi** | técnica usada para desenhar os bairros aproximados: cada ponto "ganha" a área mais perto dele |
