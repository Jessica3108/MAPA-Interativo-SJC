"""
GeoSJC — pipeline de dados.

Lê a base RAIS tratada de São José dos Campos e gera, em web/public/dados/,
todos os arquivos que o frontend consome:

    camadas.json          catálogo de camadas (o frontend monta o painel a partir dele)
    dicionarios.json      tradução dos códigos (subsetor IBGE, porte, natureza, atividades, bairros)
    estabelecimentos.json uma linha por estabelecimento, em formato compacto
    ceps.json             CEP -> coordenada, logradouro, bairro
    limite.geojson        limite do município
    bairros.geojson       bairros (derivados dos CEPs)
    setores.geojson       setores postais (5 primeiros dígitos do CEP)

Uso:
    python gerar_camadas.py --rais RAIS_SJC.csv --ceps caminho/banco-ceps/cep \
                            --limite sjc_limite.json --saida ../web/public/dados

A pasta de CEPs vem de https://github.com/gpfconfea/banco-ceps (pasta cep/).
O limite municipal vem de https://github.com/tbrugz/geodata-br.
"""
import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import Voronoi
from shapely.geometry import Point, Polygon, mapping, shape
from shapely.ops import unary_union

from dicionarios import GRANDES, NATUREZA, PORTE, SUBSETOR, grande_setor


# ------------------------------------------------------------------ utilidades
def arred(obj, casas=5):
    if isinstance(obj, float):
        return round(obj, casas)
    if isinstance(obj, (list, tuple)):
        return [arred(x, casas) for x in obj]
    if isinstance(obj, dict):
        return {k: arred(v, casas) for k, v in obj.items()}
    return obj


def salvar(pasta: Path, nome: str, obj):
    caminho = pasta / nome
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {nome:<24} {caminho.stat().st_size / 1e3:8.0f} KB")


# ------------------------------------------------------------------ 1. RAIS
def ler_rais(caminho: str) -> pd.DataFrame:
    d = pd.read_csv(caminho, sep=";", encoding="latin1", dtype=str)
    d.columns = [c.strip() for c in d.columns]
    out = pd.DataFrame({
        "cep": d["CEP Estab"].str.strip().str.zfill(8),
        "subsetor": d["IBGE Subsetor"].astype(int),
        "porte": d["Tamanho Estabelecimento"].astype(int),
        "vinculos": d["Qtd Vínculos Ativos"].astype(int),
        "ativa_ano": d["Ind Atividade Ano"].astype(int),
        "simples": d["Ind Simples"].astype(int),
        "natureza": d["Natureza Jurídica"].str.strip(),
        "cnae": d["CNAE 2.0 Subclasse"].str.strip().str.zfill(7),
        "atividade": d["subclasse da empresa"].fillna("Não informada").str.strip(),
    })
    return out


# ------------------------------------------------------------------ 2. CEPs -> coordenadas
def geocodificar(ceps, pasta_ceps: str, limite) -> pd.DataFrame:
    area_valida = limite.buffer(0.02)
    reg = {}
    for c in ceps:
        p = os.path.join(pasta_ceps, c + ".json")
        if not os.path.exists(p):
            continue
        j = json.load(open(p, encoding="utf-8"))
        try:
            la, lo = float(j["latitude"]), float(j["longitude"])
        except (KeyError, TypeError, ValueError):
            la = lo = np.nan
        reg[c] = dict(rua=j.get("logradouro") or "", bairro=(j.get("bairro") or "").strip(), la=la, lo=lo)

    t = pd.DataFrame(index=pd.Index(sorted(ceps), name="cep")).join(pd.DataFrame.from_dict(reg, orient="index"))
    t["ok"] = [not np.isnan(la) and area_valida.contains(Point(lo, la)) if isinstance(la, float) else False
               for la, lo in zip(t.la, t.lo)]
    # muitos CEPs no mesmo ponto exato = coordenada genérica do geocodificador
    rep = t[t.ok].groupby(["la", "lo"]).size()
    genericos = set(rep[rep >= 8].index)
    t.loc[[(la, lo) in genericos for la, lo in zip(t.la, t.lo)], "ok"] = False

    # sem coordenada confiável: mediana dos CEPs do mesmo setor postal
    t["setor"] = t.index.str[:5]
    med = t[t.ok].groupby("setor")[["la", "lo"]].median()
    centro = t[t.ok][["la", "lo"]].median()
    for c in t.index[~t.ok]:
        la, lo = med.loc[t.at[c, "setor"]] if t.at[c, "setor"] in med.index else centro
        t.at[c, "la"], t.at[c, "lo"] = la, lo
    t["aprox"] = (~t.ok).astype(int)
    t["rua"] = t["rua"].fillna("")
    t["bairro"] = t["bairro"].fillna("").replace("", "Não identificado")
    return t


# ------------------------------------------------------------------ 3. polígonos a partir dos CEPs
def poligonos_por_grupo(xy: np.ndarray, grupos: np.ndarray, limite, frag_min=0.15):
    """Voronoi dos pontos, recortado pelo município e dissolvido por grupo.
    Fragmentos pequenos e isolados de um grupo vão para o vizinho com maior fronteira."""
    x0, y0 = xy.min(axis=0) - 2
    x1, y1 = xy.max(axis=0) + 2
    vor = Voronoi(np.vstack([xy, [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]]))
    celulas = {}
    for i, g in enumerate(grupos):
        reg = vor.regions[vor.point_region[i]]
        if not reg or -1 in reg:
            continue
        p = Polygon(vor.vertices[reg]).intersection(limite)
        if not p.is_empty:
            celulas.setdefault(g, []).append(p)

    partes = []
    for g, ps in celulas.items():
        u = unary_union(ps)
        partes += [(g, p) for p in (u.geoms if hasattr(u, "geoms") else [u]) if p.area > 0]
    maior = {}
    for g, p in partes:
        maior[g] = max(maior.get(g, 0), p.area)
    final = {g: [] for g in maior}
    soltos = []
    for g, p in partes:
        if p.area >= frag_min * maior[g]:
            final[g].append(p)
        else:
            soltos.append((g, p))
    for g, p in soltos:
        destino, fronteira = g, 0.0
        for h, ps in final.items():
            if h == g:
                continue
            for q in ps:
                if p.intersects(q):
                    l = p.buffer(1e-7).intersection(q).length
                    if l > fronteira:
                        destino, fronteira = h, l
        final[destino].append(p)

    saida = {}
    for g, ps in final.items():
        if ps:
            saida[g] = unary_union([p.buffer(1e-6) for p in ps]).buffer(-1e-6).simplify(0.0007, preserve_topology=True)
    return saida


def feature_collection(feats):
    return {"type": "FeatureCollection", "features": feats}


# ------------------------------------------------------------------ 4. catálogo de camadas
def catalogo():
    return {
        "titulo": "GeoSJC",
        "fonte": "RAIS – Estabelecimentos (Ministério do Trabalho), base tratada para São José dos Campos",
        "centro": [-23.205, -45.885],
        "zoom": 12,
        "grupos": [
            {"id": "economia", "nome": "Economia (RAIS)"},
            {"id": "divisoes", "nome": "Divisões territoriais"},
            {"id": "base", "nome": "Mapa base"},
        ],
        "camadas": [
            {"id": "rais-pontos", "grupo": "economia", "nome": "Estabelecimentos por CEP", "tipo": "rais-pontos",
             "visivel": True, "opacidade": 0.8,
             "descricao": "Círculo por CEP. Cor = setor predominante; tamanho = estabelecimentos ou empregos."},
            {"id": "rais-calor", "grupo": "economia", "nome": "Mapa de calor", "tipo": "rais-calor",
             "visivel": False, "opacidade": 0.75,
             "descricao": "Densidade de estabelecimentos ou empregos, conforme a métrica escolhida."},
            {"id": "rais-bairros", "grupo": "economia", "nome": "Concentração por bairro", "tipo": "rais-coropletico",
             "arquivo": "bairros.geojson", "chave": "id", "agregarPor": "bairro",
             "visivel": False, "opacidade": 0.8, "identificavel": True,
             "descricao": "Bairros coloridos pelo total filtrado (5 faixas por quantis)."},
            {"id": "limite", "grupo": "divisoes", "nome": "Limite municipal", "tipo": "poligono",
             "arquivo": "limite.geojson", "visivel": True, "opacidade": 1,
             "estilo": {"cor": "--mun-line", "espessura": 1.8, "preenchimento": "--mun-fill", "opacidadePreenchimento": 0.35}},
            {"id": "bairros", "grupo": "divisoes", "nome": "Bairros", "tipo": "poligono",
             "arquivo": "bairros.geojson", "rotulo": "nome", "identificavel": True, "visivel": False, "opacidade": 1,
             "estilo": {"cor": "--div-line", "espessura": 1, "preenchimento": None},
             "descricao": "Aproximação: áreas derivadas dos CEPs e do bairro informado pelos Correios."},
            {"id": "setores", "grupo": "divisoes", "nome": "Setores postais (CEP 5 dígitos)", "tipo": "poligono",
             "arquivo": "setores.geojson", "rotulo": "setor", "identificavel": True, "visivel": False, "opacidade": 1,
             "estilo": {"cor": "--div-line", "espessura": 1, "tracejado": "3 4", "preenchimento": None}},
            {"id": "osm", "grupo": "base", "nome": "Ruas (OpenStreetMap)", "tipo": "tiles", "exclusivo": "base",
             "url": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", "atribuicao": "© OpenStreetMap",
             "visivel": True, "opacidade": 0.6},
            {"id": "satelite", "grupo": "base", "nome": "Satélite (Esri)", "tipo": "tiles", "exclusivo": "base",
             "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
             "atribuicao": "© Esri", "visivel": False, "opacidade": 0.9},
            {"id": "sem-fundo", "grupo": "base", "nome": "Sem fundo", "tipo": "vazio", "exclusivo": "base",
             "visivel": False, "opacidade": 1},
        ],
    }


# ------------------------------------------------------------------ principal
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rais", required=True)
    ap.add_argument("--ceps", required=True)
    ap.add_argument("--limite", default=str(Path(__file__).with_name("sjc_limite.json")))
    ap.add_argument("--saida", default=str(Path(__file__).parent.parent / "web" / "public" / "dados"))
    a = ap.parse_args()
    saida = Path(a.saida)
    saida.mkdir(parents=True, exist_ok=True)

    print("Lendo RAIS…")
    r = ler_rais(a.rais)
    lim_gj = json.load(open(a.limite, encoding="utf-8"))
    limite = shape(lim_gj["geometry"] if "geometry" in lim_gj else lim_gj)

    print("Geocodificando CEPs…")
    g = geocodificar(r["cep"].unique(), a.ceps, limite)
    print(f"  {len(g)} CEPs, {int(g.ok.sum())} com coordenada própria, {int((~g.ok).sum())} aproximados")

    # índices
    bairros = sorted(g["bairro"].unique())
    bid = {b: i for i, b in enumerate(bairros)}
    ceps = list(g.index)
    cid = {c: i for i, c in enumerate(ceps)}
    atividades = (r.groupby("atividade")["cnae"].agg(lambda s: s.mode().iat[0]).reset_index()
                  .sort_values("atividade").values.tolist())
    aid = {a_: i for i, (a_, _) in enumerate(atividades)}
    naturezas = sorted(r["natureza"].unique())
    nid = {n: i for i, n in enumerate(naturezas)}

    print("Gerando polígonos…")
    boas = g[g.ok].drop_duplicates(["lo", "la"])
    xy = boas[["lo", "la"]].to_numpy(dtype=float)
    setores = poligonos_por_grupo(xy, boas["setor"].to_numpy(), limite)
    com_bairro = boas[boas.bairro != "Não identificado"]
    bpolys = poligonos_por_grupo(com_bairro[["lo", "la"]].to_numpy(dtype=float),
                                 com_bairro["bairro"].map(bid).to_numpy(), limite, frag_min=0.25)

    print("Gravando arquivos em", saida)
    salvar(saida, "camadas.json", catalogo())
    salvar(saida, "dicionarios.json", {
        "subsetores": {str(k): {"nome": v, "grande": grande_setor(k)} for k, v in SUBSETOR.items()},
        "grandes": GRANDES,
        "portes": {str(k): v for k, v in PORTE.items()},
        "naturezas": [{"codigo": n, "nome": NATUREZA.get(n, f"Natureza {n}")} for n in naturezas],
        "atividades": [{"nome": a_, "cnae": c} for a_, c in atividades],
        "bairros": bairros,
    })
    salvar(saida, "ceps.json", {
        "colunas": ["cep", "lat", "lon", "rua", "bairro", "aprox"],
        "linhas": [[c, round(float(x.la), 5), round(float(x.lo), 5), x.rua, bid[x.bairro], int(x.aprox)]
                   for c, x in g.iterrows()],
    })
    salvar(saida, "estabelecimentos.json", {
        "colunas": ["cep", "atividade", "subsetor", "porte", "vinculos", "ativa_ano", "simples", "natureza"],
        "linhas": [[cid[x.cep], aid[x.atividade], int(x.subsetor), int(x.porte), int(x.vinculos),
                    int(x.ativa_ano), int(x.simples), nid[x.natureza]] for x in r.itertuples()],
    })
    salvar(saida, "limite.geojson", feature_collection([
        {"type": "Feature", "properties": {"nome": "São José dos Campos"},
         "geometry": arred(mapping(limite.simplify(0.0007)))}]))
    salvar(saida, "setores.geojson", feature_collection([
        {"type": "Feature", "properties": {"setor": s}, "geometry": arred(mapping(p))}
        for s, p in sorted(setores.items())]))
    salvar(saida, "bairros.geojson", feature_collection([
        {"type": "Feature", "properties": {"id": int(i), "nome": bairros[i]}, "geometry": arred(mapping(p))}
        for i, p in sorted(bpolys.items())]))
    print("Pronto.")


if __name__ == "__main__":
    main()
