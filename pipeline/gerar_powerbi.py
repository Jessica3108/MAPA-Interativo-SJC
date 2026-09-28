"""
GeoSJC — base para o Power BI.

Gera powerbi/GeoSJC_RAIS.xlsx em modelo estrela (1 fato + 6 dimensões), usando
os mesmos dados já tratados pelo gerar_camadas.py (coordenadas, bairros, dicionários).

Rode DEPOIS do gerar_camadas.py:
    python gerar_powerbi.py --rais caminho/RAIS_SJC.csv
"""
import argparse
import json
from pathlib import Path

import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

from dicionarios import GRANDES, NATUREZA, PORTE, SUBSETOR, grande_setor

RAIZ = Path(__file__).resolve().parent.parent
DADOS = RAIZ / "web" / "public" / "dados"

FAIXA_RESUMIDA = {1: "Sem vínculos", 2: "1 a 9", 3: "1 a 9", 4: "10 a 49", 5: "10 a 49",
                  6: "50 a 249", 7: "50 a 249", 8: "250 ou mais", 9: "250 ou mais", 10: "250 ou mais"}
# classificação por nº de empregados (critério SEBRAE para indústria)
PORTE_SEBRAE = {1: "Sem vínculos", 2: "Micro", 3: "Micro", 4: "Micro", 5: "Pequena", 6: "Pequena",
                7: "Média", 8: "Média", 9: "Grande", 10: "Grande"}


def grupo_natureza(cod: str) -> str:
    c = cod[:1]
    return {"1": "Administração pública", "2": "Entidade empresarial", "3": "Entidade sem fins lucrativos",
            "4": "Pessoa física", "5": "Organização internacional"}.get(c, "Não informado")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rais", required=True)
    ap.add_argument("--saida", default=str(RAIZ / "powerbi" / "GeoSJC_RAIS.xlsx"))
    a = ap.parse_args()

    d = pd.read_csv(a.rais, sep=";", encoding="latin1", dtype=str)
    d.columns = [c.strip() for c in d.columns]
    ceps = json.loads((DADOS / "ceps.json").read_text(encoding="utf-8"))["linhas"]
    dic = json.loads((DADOS / "dicionarios.json").read_text(encoding="utf-8"))

    # ---------------- fato
    fato = pd.DataFrame({
        "id_estab": range(1, len(d) + 1),
        "cep": d["CEP Estab"].str.strip().str.zfill(8),
        "cnae_subclasse": d["CNAE 2.0 Subclasse"].str.strip().str.zfill(7),
        "subsetor_cod": d["IBGE Subsetor"].astype(int),
        "porte_cod": d["Tamanho Estabelecimento"].astype(int),
        "natureza_cod": d["Natureza Jurídica"].str.strip(),
        "vinculos_ativos": d["Qtd Vínculos Ativos"].astype(int),
        "vinculos_clt": d["Qtd Vínculos CLT"].astype(int),
        "vinculos_estatutarios": d["Qtd Vínculos Estatutários"].astype(int),
        "ativo_no_ano": d["Ind Atividade Ano"].astype(int),
        "optante_simples": d["Ind Simples"].astype(int),
        "tipo_estab": d["Tipo Estab.1"].str.strip(),
    })
    fato["com_empregados"] = (fato["vinculos_ativos"] > 0).astype(int)

    # ---------------- dimensões
    bairros = dic["bairros"]
    dim_cep = pd.DataFrame([{
        "cep": c[0], "cep_formatado": f"{c[0][:5]}-{c[0][5:]}", "logradouro": c[3] or "Não identificado",
        "bairro": bairros[c[4]], "setor_postal": c[0][:5], "latitude": c[1], "longitude": c[2],
        "localizacao_aproximada": "Sim" if c[5] else "Não",
    } for c in ceps])

    ativ = pd.DataFrame({
        "cnae_subclasse": d["CNAE 2.0 Subclasse"].str.strip().str.zfill(7),
        "atividade": d["subclasse da empresa"].fillna("Não informada").str.strip(),
        "cnae_classe": d["CNAE 2.0 Classe"].str.strip().str.zfill(5),
        "classe": d["Classe da empresa"].fillna("Não informada").str.strip(),
    }).drop_duplicates("cnae_subclasse").sort_values("cnae_subclasse")
    ativ["divisao_cnae"] = ativ["cnae_subclasse"].str[:2]

    dim_subsetor = pd.DataFrame([{"subsetor_cod": k, "subsetor": v, "grande_setor": GRANDES[grande_setor(k)],
                                  "ordem_grande_setor": grande_setor(k) + 1} for k, v in SUBSETOR.items()])
    dim_porte = pd.DataFrame([{"porte_cod": k, "faixa_rais": v + (" vínculo" if v == "0" else " vínculos"),
                               "faixa_resumida": FAIXA_RESUMIDA[k], "porte_sebrae": PORTE_SEBRAE[k], "ordem": k}
                              for k, v in PORTE.items()])
    nats = sorted(fato["natureza_cod"].unique())
    dim_natureza = pd.DataFrame([{"natureza_cod": n, "natureza": NATUREZA.get(n, f"Natureza {n}"),
                                  "grupo_natureza": grupo_natureza(n)} for n in nats])

    # integridade: toda chave do fato existe na dimensão
    for col, dim in [("cep", dim_cep), ("cnae_subclasse", ativ), ("subsetor_cod", dim_subsetor),
                     ("porte_cod", dim_porte), ("natureza_cod", dim_natureza)]:
        faltam = set(fato[col]) - set(dim[col])
        assert not faltam, f"{col}: chaves sem dimensão {list(faltam)[:5]}"

    leia = pd.DataFrame({"Item": [
        "Fonte", "Recorte", "Modelo", "Relacionamentos", "Localização", "Bairros", "Porte",
        "Empregos", "Gerado por"], "Descrição": [
        "RAIS – Estabelecimentos (Ministério do Trabalho), base tratada pela equipe.",
        "Município de São José dos Campos (código RAIS 354990). Uma linha por estabelecimento.",
        "Estrela: tabela fato_estabelecimentos + 5 dimensões (dim_cep, dim_atividade, dim_subsetor, dim_porte, dim_natureza).",
        "fato[cep]→dim_cep[cep]; fato[cnae_subclasse]→dim_atividade[cnae_subclasse]; fato[subsetor_cod]→dim_subsetor[subsetor_cod]; "
        "fato[porte_cod]→dim_porte[porte_cod]; fato[natureza_cod]→dim_natureza[natureza_cod]. Todos muitos-para-um, filtro único.",
        "A RAIS pública não traz endereço: latitude/longitude são do CEP (base aberta gpfconfea/banco-ceps). "
        "Onde localizacao_aproximada = Sim, o ponto foi estimado pelo setor postal.",
        "Bairro informado pelos Correios para o CEP.",
        "faixa_rais é o 'Tamanho Estabelecimento' original; porte_sebrae usa o nº de empregados (critério SEBRAE para indústria).",
        "vinculos_ativos = vínculos ativos em 31/12 do ano-base.",
        "pipeline/gerar_powerbi.py (projeto GeoSJC).",
    ]})

    saida = Path(a.saida)
    saida.parent.mkdir(parents=True, exist_ok=True)
    abas = {"LEIA-ME": leia, "fato_estabelecimentos": fato, "dim_cep": dim_cep, "dim_atividade": ativ,
            "dim_subsetor": dim_subsetor, "dim_porte": dim_porte, "dim_natureza": dim_natureza}
    with pd.ExcelWriter(saida, engine="openpyxl") as w:
        for nome, df in abas.items():
            df.to_excel(w, sheet_name=nome, index=False)

    # formatação + cada aba vira uma Tabela do Excel (o Power BI reconhece pelo nome)
    wb = load_workbook(saida)
    cab = PatternFill("solid", start_color="0E5A6E")
    for nome, df in abas.items():
        ws = wb[nome]
        for cell in ws[1]:
            cell.font = Font(name="Arial", bold=True, color="FFFFFF")
            cell.fill = cab
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.font = Font(name="Arial")
        for i, col in enumerate(df.columns, 1):
            largura = max(len(str(col)), *(len(str(x)) for x in df[col].head(300))) + 2
            ws.column_dimensions[get_column_letter(i)].width = min(largura, 90 if nome == "LEIA-ME" else 60)
        ws.freeze_panes = "A2"
        if nome == "LEIA-ME":
            for c in ws["B"]:
                c.alignment = Alignment(wrap_text=True, vertical="top")
            continue
        ref = f"A1:{get_column_letter(len(df.columns))}{len(df) + 1}"
        t = Table(displayName=nome, ref=ref)
        t.tableStyleInfo = TableStyleInfo(name="TableStyleLight9", showRowStripes=True)
        ws.add_table(t)
    wb.save(saida)
    for nome, df in abas.items():
        print(f"  {nome:<24} {len(df):>7} linhas")
    print("Gerado:", saida)


if __name__ == "__main__":
    main()
