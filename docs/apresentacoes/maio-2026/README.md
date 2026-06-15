# Apresentação — Maio 2026

Relatório mensal de **Vendas & Produção** (El Pôncio · Família Pôncio).

- **`Apresentacao_Maio_2026.pptx`** — apresentação final (11 slides, gráficos e tabelas nativos/editáveis no PowerPoint).
- **`gerador/`** — scripts Python que geram o `.pptx` a partir dos dados.

## Conteúdo (11 slides)

1. Capa
2. Venda IN × Venda OUT — Maio 2026
3. Venda IN · Venda OUT · A Faturar
4. Venda Total × Produção
5. Venda IN por produto
6. Venda OUT por produto
7. Produção por produto
8. Estoque final — Matriz e Filial
9. Vendas IN — 2026 (Jan a Mai)
10. Vendas OUT — 2026 (Jan a Mai)
11. Produção — 2026 (Jan a Mai)

## Redesign

Versão derivada do arquivo original mantendo **exatamente os mesmos dados**
(somatórios validados célula a célula). O que mudou foi apenas o visual e a
visão de dados:

- Pizzas 3D → roscas 2D limpas com KPIs e total no centro.
- Gráfico de barras quebrado (legenda sobre as barras) → barras horizontais
  únicas, ordenadas por valor, com rótulos e painel de destaques.
- Tabelas coladas como imagem do Excel → tabelas nativas editáveis, com
  formatação pt-BR, coluna MAI destacada e linha de total.
- Sistema visual consistente: paleta semântica (verde = IN, âmbar = OUT,
  azul = produção, dourado = a faturar), cabeçalho/rodapé padronizados,
  tipografia Segoe UI + Consolas (números).

## Como regerar

Requer `python-pptx` (`pip install python-pptx`).

```bash
cd gerador
python3 build.py   # salva Apresentacao_Maio_2026.pptx
```

Para os próximos meses, basta atualizar os números em `gerador/data.py`
(os valores são os dados exatos extraídos do relatório) e rodar de novo.
