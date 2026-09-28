# GeoSJC — mapa econômico de São José dos Campos

Base para API do primeiro semestre de Logistica da Fatec SJC 2026, usando dados da RAIS.

```
pipeline/  (Python)   RAIS.csv + CEPs geolocalizados + limite  ──►  web/public/dados/*.json|geojson
web/       (React+TS) lê dados/camadas.json e monta o geoportal a partir dele
api/       (FastAPI)  opcional, fase 2: serve os mesmos arquivos + consultas
powerbi/   (Power BI) base em modelo estrela (.xlsx), medidas DAX, tema e mapas de bairro
```

Para o dashboard do Power BI, veja `powerbi/GUIA_POWER_BI.md`.
Para regerar o Excel: `python pipeline/gerar_powerbi.py --rais RAIS_SJC.csv` (depois do `gerar_camadas.py`).

## 1. Gerar os dados
```bash
cd pipeline
pip install pandas numpy scipy shapely
git clone --depth 1 https://github.com/gpfconfea/banco-ceps   # CEP -> rua, bairro, lat/lon (pasta cep/)
python gerar_camadas.py --rais caminho/RAIS_SJC.csv --ceps banco-ceps/cep
```
Saída em `web/public/dados/`:

| arquivo | conteúdo |
|---|---|
| `camadas.json` | **catálogo de camadas** — o frontend monta o painel a partir dele |
| `dicionarios.json` | subsetor IBGE, grande setor, porte, natureza jurídica, atividades (CNAE), bairros |
| `estabelecimentos.json` | 1 linha por estabelecimento, em índices: `[cep, atividade, subsetor, porte, vinculos, ativa_ano, simples, natureza]` |
| `ceps.json` | `[cep, lat, lon, rua, bairro, aprox]` |
| `limite.geojson`, `bairros.geojson`, `setores.geojson` | polígonos |

## 2. Rodar o frontend
```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # gera web/dist/, pronto para GitHub Pages, Vercel, Netlify…
```

## 3. (Opcional) API
```bash
cd api
pip install fastapi uvicorn
uvicorn main:app --reload --port 8000
```
Em `web/src/dados/fonte.ts`, troque `BASE_DADOS` para `'/api/'`. O Vite já repassa `/api` para a porta 8000.

## Como adicionar uma camada nova
1. Gere o GeoJSON no pipeline (ex.: `zoneamento.geojson`) e salve em `web/public/dados/`.
2. Acrescente uma entrada em `catalogo()` no `gerar_camadas.py`:
```python
{"id": "zoneamento", "grupo": "divisoes", "nome": "Zoneamento", "tipo": "poligono",
 "arquivo": "zoneamento.geojson", "rotulo": "zona", "identificavel": True,
 "visivel": False, "opacidade": 1, "estilo": {"cor": "#8a5", "espessura": 1, "preenchimento": "#8a5", "opacidadePreenchimento": 0.2}}
```
Pronto: ela aparece no painel de camadas sem mexer no React. Tipos aceitos: `tiles`, `vazio`, `poligono`,
`rais-pontos`, `rais-calor`, `rais-coropletico`.

## Estrutura do frontend
```
web/src/
  tipos.ts                 tipos compartilhados (espelham os arquivos do pipeline)
  dados/fonte.ts           ÚNICO ponto que busca dados (estático hoje, API amanhã)
  dados/filtros.ts         filtros e agregações (roda no navegador)
  mapa/MapView.tsx         mapa Leaflet; desenha cada camada pelo seu "tipo"
  components/Busca.tsx     busca por CEP, rua, bairro, atividade ou código CNAE
  components/PainelCamadas.tsx     liga/desliga e opacidade (lido do catálogo)
  components/PainelFiltros.tsx     atividade, setor, subsetor, porte, bairro
  components/PainelIndicadores.tsx números, rankings clicáveis
  components/PainelIdentificar.tsx o que existe no ponto/área clicada
  components/Legenda.tsx   legenda das camadas ligadas
```

## Limitações dos dados
- A RAIS pública não traz nome nem endereço: cada ponto é um **CEP** com todos os estabelecimentos dele.
- 152 dos 3.678 CEPs não tinham coordenada confiável e foram posicionados no centro do seu setor postal (marcados como aproximados).
- Bairros e setores postais são **aproximações** desenhadas a partir dos CEPs (Voronoi). Com o shapefile oficial de bairros, basta gerar `bairros.geojson` a partir dele.
