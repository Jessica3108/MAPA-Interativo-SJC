"""
GeoSJC — API (fase 2, opcional).

Serve os mesmos arquivos gerados pelo pipeline em /api/<arquivo> e adiciona
consultas que ficam pesadas demais para o navegador quando a base crescer
(vários anos da RAIS, outras cidades).

No frontend, basta trocar BASE_DADOS em web/src/dados/fonte.ts para '/api/'.

    pip install fastapi uvicorn
    uvicorn main:app --reload --port 8000
"""
import json
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

DADOS = Path(__file__).resolve().parent.parent / "web" / "public" / "dados"

app = FastAPI(title="GeoSJC API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


@lru_cache
def carregar(nome: str):
    return json.loads((DADOS / nome).read_text(encoding="utf-8"))


@app.get("/api/cep/{cep}")
def detalhe_cep(cep: str):
    """Estabelecimentos de um CEP, com as descrições já traduzidas."""
    cep = "".join(ch for ch in cep if ch.isdigit()).zfill(8)
    ceps = carregar("ceps.json")["linhas"]
    idx = next((i for i, c in enumerate(ceps) if c[0] == cep), None)
    if idx is None:
        raise HTTPException(404, "CEP sem estabelecimentos na base.")
    dic = carregar("dicionarios.json")
    linhas = [e for e in carregar("estabelecimentos.json")["linhas"] if e[0] == idx]
    c = ceps[idx]
    return {
        "cep": cep, "lat": c[1], "lon": c[2], "rua": c[3], "bairro": dic["bairros"][c[4]],
        "estabelecimentos": [
            {"atividade": dic["atividades"][e[1]]["nome"], "cnae": dic["atividades"][e[1]]["cnae"],
             "subsetor": dic["subsetores"][str(e[2])]["nome"], "porte": dic["portes"][str(e[3])], "vinculos": e[4]}
            for e in linhas
        ],
    }


@app.get("/api/{arquivo}")
def arquivo(arquivo: str):
    """camadas.json, estabelecimentos.json, bairros.geojson… (os mesmos do modo estático)."""
    caminho = (DADOS / arquivo).resolve()
    if caminho.parent != DADOS or not caminho.exists():
        raise HTTPException(404, "Arquivo não encontrado.")
    return FileResponse(caminho)
