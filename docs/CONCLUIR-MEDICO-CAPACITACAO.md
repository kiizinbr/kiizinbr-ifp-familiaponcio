# Plano — Concluir Centro Médico e Capacitação

> Decisão (16/06/2026): focar em **concluir Médico + Capacitação** antes de expandir creche/esportivo.
> Fonte: mapeamento de lacunas (leitura de `src/app/{medico,capacitacao}`, `src/lib/*`, testes, e os
> planos/relatórios em `docs/superpowers/`). Método: fatiar em mini-features com **TDD + ritual verde**.

## Foto atual

- **Capacitação ~4,5/5** — mais perto de "pronto". Núcleo (matrícula/lista de espera, presença, certificado+PDF+verificação pública, RBAC) completo e testado. Lacunas pequenas.
- **Médico ~70%** — tudo funciona (15 telas, prontuário SOAP/CID-10/PDF/assinatura imutável, agenda anti-overbooking, RBAC 37 testes), mas **faltam E2E do core clínico** e alguns fluxos de recepção.

---

## Itens de PLATAFORMA (gate de produção pros DOIS — não são de uma vertical só)

- [ ] Admin/users **real** (provisionar usuários, reset de senha / primeiro acesso).
- [ ] Base legal **LGPD** (consentimento versionado) — antes de dados reais.
- [ ] Deploy de produção — a VM já existe, mas **é o "staging" = produção real** (ver LEDGER): tratar com cuidado.

---

## Capacitação — Tier 1 (pra "concluído"). Estimado ~1 dia

- [ ] **Evasão: renderizar o alerta** no detalhe da turma. O cálculo `avaliarRiscoEvasao` JÁ existe e é testado, mas **nenhuma tela mostra o badge "EM RISCO"**. (~30min) → `src/app/capacitacao/turmas/[id]/page.tsx`
- [ ] **Edição de turma** — `atualizarTurmaAction` + form (data/local/capacidade; só se status planejada/inscrições). Hoje é read-only → corrigir turma exige SQL na mão. (~1-2h)
- [ ] **E2E de fluxo real** — hoje só 3 smokes. Adicionar: matricular até lotar → lista de espera → promoção; transições de matrícula; registrar presença; emitir certificado (≥80%) + PDF; RBAC negado (recepção não cria curso). (~3-4h)

**Tier 2 (pós-launch):** edição de curso, timeline de transições, relatórios por curso.
**Limitação conhecida (aceita):** import de alunas legadas = parsing pronto (dry-run), ativação fica pra fase LGPD.

---

## Médico — Tier 1 (pra "concluído"). Estimado ~4 dias

- [ ] **E2E do prontuário fim-a-fim** — o core clínico **não tem E2E**: abrir consulta → vitais → nota SOAP → CID-10 → assinar (imutável) → receita/atestado PDF → addendo. (~8h)
- [ ] **E2E das transições** — agendada → confirmada → check-in → em atendimento → realizada. (~6h)
- [ ] **Fix busca de cidadão** no wizard — o `LIKE` quebra (comentário no próprio código); usar full-text/índice. (~4h)
- [ ] **Criar cidadão no wizard** — hoje, se o paciente não existe, é erro travado; falta o modal "novo paciente". (~6h)
- [ ] **Mobile do prontuário** — a tela 3-colunas quebra no celular; precisa de tabs/colapso. (~8h)

**Tier 2:** autocomplete CID-10, validação de vitais em tempo real, modal de confirmação ao assinar, feriados nacionais nos slots, dashboard com tendências/SLA.
**Segurança a endereçar antes de prod:** rate limiting; carimbo/hash (TSA) na assinatura de receita/atestado (exigência de conselho/RFB).
**Lógica pronta sem UI:** agendamento ad-hoc (walk-in) — `reservarSlotAdHoc` existe, falta tela.

---

## Ordem recomendada

1. **Capacitação primeiro** (Tier 1 é curto, ~1 dia → uma vertical "concluída" rápido, momentum).
2. **Médico** (Tier 1 ~4 dias, sobretudo E2E + UX da recepção).
3. **Itens de plataforma** (admin/users, LGPD, deploy) — em paralelo/ao final, pois gating de produção real.

Cada item = uma fatia com TDD + ritual verde (`format/typecheck/lint/test`) + commit, igual fizemos na creche.
