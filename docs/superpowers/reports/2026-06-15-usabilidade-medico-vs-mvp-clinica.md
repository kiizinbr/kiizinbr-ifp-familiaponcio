# Centro Médico (IFP Connect) — Usabilidade vs. padrão MVP de clínica

**Data:** 2026-06-15 · **Foco:** usabilidade FUNCIONAL/interação (não design visual)
**Método:** avaliação heurística (Nielsen 10) de 5 fluxos, baseada no código real das telas,
comparada às convenções da categoria (Doctolib, Amplimed, iClinic, Feegow, Tebra, Elation,
Docplanner/Clinicorp). 44 achados → backlog priorizado por *intuitividade × esforço*.

## Veredito

**MISTO, puxando claramente pro lado bom.** O Centro Médico está **no padrão** dos MVP de
clínica nos fundamentos que mais importam (anti-overbooking com reserva atômica, sala de
espera com cronômetro, ações inline gated por papel, erros em português, empty states que
ensinam) e **acima da média** em alguns pontos (encaixe/walk-in de 1ª classe, aviso antes de
assinar nota não salva, CID com saída em texto livre). O que faz **parecer "fraco/confuso"
não é falta de recurso — é arrumação e feedback:** o trabalho operacional está espalhado em
3 telas de agenda parecidas sem hierarquia, a tela "Fila do dia" não deixa operar a fila,
faltam confirmações visíveis após as ações, e o caminho de volta é fraco. **São problemas de
organização, não de motor — por isso a maioria dos ganhos sai de ajustes pequenos.**

## Onde você JÁ bate (ou supera) o padrão

- **Anti-overbooking de verdade:** reserva atômica; 2 recepcionistas no mesmo horário → o 2º vê
  "Esse horário acabou de ser reservado, escolha outro" (igual Doctolib/iClinic).
- **Sala de espera viva** (board "Agenda do dia"): cronômetro de espera, atrasados-sem-check-in no
  topo, Chegou/Confirmar/Iniciar/Chamar no próprio cartão, auto-refresh 30s.
- **Botões contextuais + gated por papel** (só aparece o que faz sentido) — previne erro.
- **Encaixe/walk-in de 1ª classe** ("Atender agora" em 1 clique; "Encaixar HH:MM" na fila).
- **Empty states que ENSINAM** o próximo passo; **erros em PT, inline e acionáveis**.
- **Prontuário com contexto sempre à vista** (alergias, idade, condições) + aviso antes de assinar
  nota com diagnóstico não salvo.

## Backlog priorizado (intuitividade × esforço)

| # | Item | Fluxo | Sev | Esf |
|---|------|-------|-----|-----|
| 1 | Confirmar visivelmente toda ação (chamar/check-in/salvar/marcar) + "Rechamar" | Transversal | alta | P |
| 2 | Sidebar agrupada + logo clicável + "Voltar" nas telas de detalhe | Navegação | alta | M |
| 3 | Autosave do prontuário + "salvo às HH:MM" + aviso ao sair | Prontuário | alta | M |
| 4 | Marcar consulta clicando num horário VAZIO da agenda | Agenda | alta | M |
| 5 | Confirmação+motivo ao cancelar encaminhamento; desfazer check-in | Recepção | alta | M |
| 6 | Ações inline na home "Fila do dia" (ou abrir direto o board) | Agenda | alta | M |
| 7 | "Copiar da última consulta" + modelos por especialidade | Prontuário | alta | M |
| 8 | Linha do "agora" na grade + rolar pro horário atual | Agenda | média | P |
| 9 | Recepção auto-refresh (30s) reusando o do board | Recepção | média | P |
| 10 | Erro de ação não derruba a tela inteira da fila (erro inline) | Agenda/Recepção | média | M |
| 11 | Filtro por profissional no board; priorizar quem já chegou | Agenda/Recepção | média | M |
| 12 | Encadear: "Iniciar" abre o prontuário; "Próximo paciente" após assinar | Prontuário | média | M |
| 13 | Pré-preencher horário do encaixe (bloquear passado); herdar CID no atestado | Marcar/Prontuário | média | P |
| 14 | "Faltou" e "Reagendar" inline na fila | Agenda | baixa | P |
| 15 | Padronizar empty states + nome social entre telas | Transversal | baixa | P |
| 16 | Busca de paciente incremental (sem clicar "Buscar") + foco automático | Recepção/Marcar | média | M |
| 17 | Consolidar as 3 agendas numa só (abas Hoje/Semana/Por profissional) | Agenda | alta | G |
| 18 | Estruturar a nota em SOAP (Subjetivo/Objetivo/Avaliação/Plano) | Prontuário | média | G |

Sev = quanto trava o usuário · Esf = P(equeno)/M(édio)/G(rande).

## Quick-wins (sprint imediato — alto impacto, baixo esforço)

1. **Confirmações visíveis** após cada ação + "Rechamar" (rank 1) — mata a chamada-em-dobro.
2. **Logo clicável + "Voltar"** nas telas de detalhe (parte do rank 2) — a saída de emergência do "me perdi".
3. **Linha do "agora"** + scroll automático (rank 8).
4. **Recepção auto-refresh** (rank 9).
5. **Desfazer check-in** (ação já existe, só ligar) + confirmação ao cancelar encaminhamento (rank 5).
