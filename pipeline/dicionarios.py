"""Tradução dos códigos da RAIS usados no GeoSJC."""

SUBSETOR = {
    1: "Extrativa mineral",
    2: "Produtos minerais não metálicos",
    3: "Indústria metalúrgica",
    4: "Indústria mecânica",
    5: "Material elétrico e de comunicações",
    6: "Material de transporte",
    7: "Madeira e mobiliário",
    8: "Papel, papelão, editorial e gráfica",
    9: "Borracha, fumo, couros e diversas",
    10: "Química, farmacêutica e perfumaria",
    11: "Têxtil e vestuário",
    12: "Calçados",
    13: "Alimentos e bebidas",
    14: "Serviços industriais de utilidade pública",
    15: "Construção civil",
    16: "Comércio varejista",
    17: "Comércio atacadista",
    18: "Instituições financeiras",
    19: "Imobiliárias, serviços técnicos e administrativos",
    20: "Transportes e comunicações",
    21: "Alojamento, alimentação e reparação",
    22: "Serviços de saúde",
    23: "Ensino",
    24: "Administração pública",
    25: "Agropecuária",
    99: "Não classificado",
}

GRANDES = ["Indústria", "Construção", "Comércio", "Serviços", "Adm. pública", "Agropecuária"]


def grande_setor(s: int) -> int:
    """0 Indústria, 1 Construção, 2 Comércio, 3 Serviços, 4 Adm. pública, 5 Agropecuária."""
    if s <= 14:
        return 0
    if s == 15:
        return 1
    if s in (16, 17):
        return 2
    if s == 24:
        return 4
    if s == 25:
        return 5
    return 3


# Tamanho Estabelecimento: faixa de vínculos ativos em 31/12
PORTE = {1: "0", 2: "1 a 4", 3: "5 a 9", 4: "10 a 19", 5: "20 a 49", 6: "50 a 99",
         7: "100 a 249", 8: "250 a 499", 9: "500 a 999", 10: "1.000 ou mais"}

NATUREZA = {
    "1031": "Órgão público do Poder Executivo municipal",
    "1104": "Autarquia federal", "1120": "Autarquia municipal",
    "1244": "Fundação pública (direito público) municipal",
    "2011": "Empresa pública", "2038": "Sociedade de economia mista",
    "2046": "S.A. aberta", "2054": "S.A. fechada",
    "2062": "Sociedade empresária limitada", "2135": "Empresário individual",
    "2143": "Cooperativa", "2151": "Consórcio de sociedades",
    "2216": "Empresa domiciliada no exterior",
    "2232": "Sociedade simples pura", "2240": "Sociedade simples limitada",
    "2305": "EIRELI (natureza empresária)", "2313": "EIRELI (natureza simples)",
    "2321": "Sociedade unipessoal de advocacia",
    "3069": "Fundação privada", "3085": "Condomínio edilício",
    "3204": "Estabelecimento no Brasil de fundação ou associação estrangeira",
    "3220": "Organização religiosa", "3301": "Organização social",
    "3999": "Associação privada",
    "4014": "Empresa individual imobiliária", "4081": "Contribuinte individual",
    "4090": "Candidato a cargo político eletivo",
    "4120": "Produtor rural (pessoa física)",
}
