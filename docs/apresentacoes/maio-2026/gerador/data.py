# -*- coding: utf-8 -*-
"""Dados EXATOS extraídos do arquivo original (não alterar valores)."""

# ---- Totais Maio 2026 ----
VENDA_IN = 786
VENDA_OUT = 224
A_FATURAR = 152            # venda IN a faturar próximo mês
VENDA_TOTAL = 1162         # 786 + 224 + 152
PRODUCAO = 1444

# ---- Por produto — MAIO 2026 (chart4/5/6) ----
# (nome_exibicao, venda_in, venda_out, producao)
PRODUTOS_MAIO = [
    ("El Poncio Gudang Garam Red",          580, 120, 1279),
    ("El Poncio Gudang Garam Green",         63,  30,  102),
    ("El Poncio Cretec Menta",               90,  74,   57),
    ("El Poncio Cretec Cereja",              41,   0,    6),
    ("El Poncio Gudang Garam Twin Ten Red",  12,   0,    0),
    ("El Poncio Ignite Kretec Mint",          0,   0,    0),
    ("Cretec CE TT",                          0,   0,    0),
    ("Cretec Menthol TT",                     0,   0,    0),
    ("Clean Click",                           0,   0,    0),
]

# ---- Estoque final Maio 2026 (slide 8) ----
# (marca, matriz, filial, total)
ESTOQUE = [
    ("El Poncio Gudang Red",        1494, 107, 1601),
    ("El Poncio Gudang Green",         2,   7,    9),
    ("Cretec Menthol",                 0,   0,    0),
    ("Cretec Cereja",                  0,   5,    5),
    ("Clean Click",                    0,  11,   11),
    ("El Poncio Ignite Mint",        105,   0,  105),
    ("El Poncio Cretec Cereja",        2,   0,    2),
    ("El Poncio Cretec Menta",        18,  20,   38),
    ("El Poncio Gudang Twin Ten",     69,   0,   69),
]
ESTOQUE_TOTAL = (1690, 150, 1840)

# ---- Tabelas mensais Jan–Mai 2026 ----
# Cada linha: (codigo, produto, [jan, fev, mar, abr, mai], total_caixa, total_carteira)
# None = célula em branco no original (produto ainda não lançado)
MESES = ["JAN", "FEV", "MAR", "ABR", "MAI"]

VENDAS_IN = [
    ("4386 / 4387", "El Poncio Gudang Garam Red",          [701, 570, 778, 1137, 580], 3766.0, 1807680.0),
    ("4586 / 4587", "El Poncio Gudang Garam Green",        [89, 89, 63, 160, 63],       464.0,  222720.0),
    ("4399 / 4400", "El Poncio Ignite Kretec Mint",        [None, 0, 0, 0, 0],            0.0,       0.0),
    ("1980 / 1966", "Cretec CE TT",                        [28, 14, 4, 24, 0],           70.0,   35000.0),
    ("2780 / 2779", "Cretec Menthol TT",                   [119, 8, 81, 4, 0],          212.0,  106000.0),
    ("4938 / 4939", "El Poncio Gudang Garam Twin Ten Red", [None, 0, 3, 11, 12],         26.0,   13000.0),
    ("4940 / 4941", "El Poncio Cretec Cereja",             [None, 0, 8, 10, 41],         59.0,   29500.0),
    ("4942 / 4943", "El Poncio Cretec Menta",              [None, 0, 121, 62, 90],      273.0,  136500.0),
    ("4113 / 4114", "Clean Click",                         [58, 60, 0, 30, 0],          148.0,   71040.0),
]
VENDAS_IN_TOTAL = ([995, 741, 1058, 1438, 786], 5018.0, 2421440.0)

VENDAS_OUT = [
    ("4386 / 4387", "El Poncio Gudang Garam Red",          [100, 170, 188, 60, 120],    638.0,  306240.0),
    ("4586 / 4587", "El Poncio Gudang Garam Green",        [20, 1, 34, 40, 30],         125.0,   60000.0),
    ("4399 / 4400", "El Poncio Ignite Kretec Mint",        [None, 0, 0, 0, 0],            0.0,       0.0),
    ("1980 / 1966", "Cretec CE TT",                        [0, 1, 0, 0, 0],               1.0,     500.0),
    ("2780 / 2779", "Cretec Menthol TT",                   [0, 5, 0, 0, 0],               5.0,    2500.0),
    ("4938 / 4939", "El Poncio Gudang Garam Twin Ten Red", [None, 0, 0, 0, 0],            0.0,       0.0),
    ("4940 / 4941", "El Poncio Cretec Cereja",             [None, 0, 0, 0, 0],            0.0,       0.0),
    ("4942 / 4943", "El Poncio Cretec Menta",              [None, 0, 1, 0, 74],          75.0,   37500.0),
    ("4113 / 4114", "Clean Click",                         [0, 40, 0, 0, 0],             40.0,   19200.0),
]
VENDAS_OUT_TOTAL = ([120, 217, 223, 100, 224], 884.0, 425940.0)

PRODUCAO_TAB = [
    ("4386 / 4387", "El Poncio Gudang Garam Red",          [812, 365, 501, 1550, 1279], 4507.0, 2163360.0),
    ("4586 / 4587", "El Poncio Gudang Garam Green",        [101, 100, 146, 121, 102],    570.0,  273600.0),
    ("4399 / 4400", "El Poncio Ignite Kretec Mint",        [0, 0, 0, 0, 0],                0.0,       0.0),
    ("1980 / 1966", "Cretec CE TT",                        [34, 0, 0, 0, 0],              34.0,   17000.0),
    ("2780 / 2779", "Cretec Menthol TT",                   [117, 0, 0, 0, 0],            117.0,   58500.0),
    ("4938 / 4939", "El Poncio Gudang Garam Twin Ten Red", [0, 0, 95, 0, 0],              95.0,   47500.0),
    ("4940 / 4941", "El Poncio Cretec Cereja",             [0, 0, 28, 32, 6],             66.0,   33000.0),
    ("4942 / 4943", "El Poncio Cretec Menta",              [0, 99, 105, 131, 57],        392.0,  196000.0),
    ("4113 / 4114", "Clean Click",                         [81, 0, 0, 0, 0],              81.0,   38880.0),
]
PRODUCAO_TOTAL = ([1145, 564, 875, 1834, 1444], 5862.0, 2827840.0)


# ---- Formatação numérica pt-BR ----
def br_int(n):
    return f"{n:,}".replace(",", ".")


def br_dec(n, casas=2):
    s = f"{n:,.{casas}f}"
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return s


def br_cell(v):
    if v is None:
        return "–"
    return br_int(v)
