# Avaliação de Usabilidade — Capacitação vs. padrão de SaaS de gestão de cursos — 2026-06-16

Método: avaliação heurística (Nielsen × fluxo) **baseada no código** (sem tocar DB/PII), ancorada no padrão de facto de SaaS de gestão de cursos/capacitação/presença/certificados. Workflow `wf_b30f2df6-c24` (9 agentes: 7 avaliadores de fluxo + crítico de completude + sintetizador). 7/7 fluxos, 86 achados brutos → 16 itens consolidados.

## Veredito

**Misto, puxando pro bom.** O motor e a base visual estão no padrão (RBAC, FIFO/lock de vagas, idempotência, certificado imutável, Design Kit canônico). Fica **abaixo do padrão** em três frentes:

1. **Robustez de erro** — sem `error.tsx` na área (falha vira overlay técnico do Next em inglês); `criarTurmaAction` não trata código duplicado (P2002 estoura a boundary e perde o formulário).
2. **Feedback pós-ação** — criar curso e matricular **não confirmam nada**: a tela só pisca. O padrão do setor sempre diz "matriculado / entrou na lista de espera / curso criado".
3. **Wayfinding e papéis** — recepção pode matricular mas não tem atalho na navegação; home genérica; listas sem busca/filtro.

> Não é fraco de motor: **pisca sem explicar e não guia o leigo.**

## Backlog priorizado (intuitividade × esforço)

| ID | Item | Fluxo | Sev | Esf | Autônomo | Sprint |
|----|------|-------|-----|-----|----------|--------|
| C1 | Sem `error.tsx` em /capacitacao → falha vira overlay técnico em inglês | Robustez | high | S | ✅ | **S1** |
| C2 | Matrícula não confirma se entrou na turma ou na lista de espera | Matrícula | high | S | ✅ | **S1** |
| C3 | Criar curso não dá feedback de sucesso (só pisca) | Cursos | high | S | ✅ | **S1** |
| C4 | `criarTurmaAction` não trata código duplicado (P2002 perde o form) | Turmas | high | M | ✅ | **S1** |
| C7 | Combobox de cidadão sem teclado/ARIA/debounce | Matrícula | high | M | ✅ | **S1** |
| C8 | Copy/rótulos: StagingBanner diz "paciente"; botões mostram estado, não verbo; erros com jargão | Copy | medium | S | ✅ | **S1** |
| C9 | Listas sem busca/filtro; sem badge "Inativo"; linha de turma não clicável; vagas sem ênfase | Listas | medium | M | ✅ | **S1** |
| C10 | Sem `loading.tsx`; sem breadcrumb; nav "Cidadãos" sai do shell sem retorno | Wayfinding | medium | M | ✅ | **S1** |
| C11 | Estados vazios fracos: copy "ao lado" mente no mobile; fila vazia some; promover efêmero | Estados | medium | M | ✅ | S2 |
| C12 | Forms: datas sem validação cruzada; capacidade não herda padrão; certificado inelegível só por tooltip | Forms | medium | M | ✅ | S2 |
| C15 | Login da unidade não oferece "trocar de unidade" no erro | Entrada | low | S | ✅ | S2 |
| C5 | Adotar erro inline (AcaoInline do Médico) nas transições | Robustez | high | M | ⚠️ decisão | — |
| C6 | Recepção pode matricular mas não tem nav/CTA pra tarefa | Entrada | high | M | ⚠️ decisão | — |
| C13 | Concluir/Cancelar turma e Desativar curso sem confirmação | Turmas/Cursos | medium | S | ⚠️ decisão | — |
| C14 | Celebração do certificado é beco sem saída; home não se adapta a papéis | Certificado | medium | M | ⚠️ decisão | — |
| C16 | Mobile: chamada de presença é o último de 6 blocos; tema não persiste | Mobile | low | M | ⚠️ decisão | — |

## Sprint 1 (autônomo, em execução)

C1, C2, C3, C4, C7, C8, C9, C10 — cobrem as três frentes do veredito. Aditivos; lógica sagrada (regra 80%, FIFO/lock, idempotência, RBAC, imutabilidade, contrato `p_<id>` da presença) intocada; sem migration/schema.

## Itens que precisam de decisão do dono (pro Sprint 2)

- **C5 — Erro inline (AcaoInline):** adotar nas transições? Escopo: só transições ou também matricular/promover?
- **C6 — Atalho de matrícula da recepção:** lista de turmas com inscrições abertas, ou fluxo dedicado?
- **C13 — Impacto de desativar curso:** texto do efeito em turmas/matrículas existentes (regra de negócio).
- **C14 — Saída da celebração + home por papel:** destino após emitir certificado (turma/painel/ambos)? Primeiro card da home por papel?
- **C16 — Persistência do tema:** persistir a preferência de tema entre sessões?
- **Rota de cadastro de cidadão:** rota canônica de cadastrar cidadão a partir da busca sem resultado, com retorno à turma.
