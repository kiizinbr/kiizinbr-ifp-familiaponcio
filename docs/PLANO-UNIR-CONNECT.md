# Plano: Unir IFP Connect (design CASA) + IFP Sistema (este repo)

> Decisão de 2026-06-09 (Erick + Claude). Este documento é a memória oficial da estratégia.
> Protótipo visual: `C:\Users\Erick\Desktop\IFP-Connect-Novo-Design` (HTML/CSS/JS puro, modularizado
> em `styles.css` + `app.js`, backup em `_backup-pre-modularizacao\`).

## Contexto e veredito

| | IFP Connect (protótipo) | IFP Sistema (este repo) |
|---|---|---|
| O que é | **Rosto sem corpo** — design "CASA" lindo, 4 salões, tudo mock | **Corpo sem rosto** — NestJS + Postgres + Prisma + RBAC prontos, UI placeholder |
| Backend | ❌ zero | ✅ produção-ready (auth JWT, 7 perfis, Ficha Cidadã completa) |
| Visual | ✅ alta fidelidade (prancha médica) | ⚪ shadcn cru |

**Veredito: UNIR.** O design do Connect vira o front deste sistema. Não separar (duplicaria
auth/RBAC/banco), não substituir (jogaria fora backend maduro). Reaproveita os dois trabalhos.

**Princípio: vertical antes de horizontal.** Uma unidade funcionando ponta a ponta
(usuário real completa uma tarefa real) vale mais que 4 telas bonitas que não salvam nada.
Critério de "entregável": **dado real + 1 fluxo completo por um usuário sozinho.**

## Decisões tomadas
1. **Estender o `apps/web`** (Next.js) existente — NÃO criar app novo (auth, React Query e
   cliente da API já fiados ali).
2. **Primeira unidade: Centro Médico** (peça mais madura do Connect: prancha de atendimento).
3. Connect é HTML puro → o trabalho é **portar o design pra componentes React**, usando o
   `styles.css` extraído como base visual (tokens).

## Fases

### Fase 0 — Fundação da união (zero feature nova)
- [ ] Subir o sistema local: `docker compose up` + migrations + seed; validar login + Ficha Cidadã
- [ ] Portar paleta/tokens CASA do `styles.css` do Connect para o Tailwind do `apps/web`
- [ ] Definir layout-base (sidebar/salões → navegação do app)

### Fase 1 — Vertical do Centro Médico (o entregável "1 de 1")
**Backend (NestJS + Prisma):**
- [ ] Schema: agendamento, atendimento/prontuário (SOAP), triagem/sinais vitais — ligado à Ficha Cidadã
- [ ] Migration + controllers/services do módulo `medico` (reusar guards, RBAC, `@CurrentUser`, `PrismaService`)
**Frontend (React, design CASA):**
- [ ] Portar a prancha de atendimento do Connect pra componentes React
- [ ] Telas: agenda do dia → atendimento (SOAP, vitais, alergias/crônicos) → salvar prontuário via API
- [ ] Login real com perfil Profissional/Médico (já existe no RBAC)

✅ **Resultado:** uma médica loga, vê a agenda, atende e salva prontuário real.

### Fase 2 — Polir e entregar
- [ ] Testes E2E do fluxo médico (Playwright)
- [ ] Acessibilidade (alt/title em SVGs, contraste) — fecha P0 do Connect
- [ ] Deploy on-prem (docker compose prod + Caddy) no servidor

### Fase 3 — Replicar o molde
- [ ] Capacitação e Esporte: mesma receita (schema → controllers → telas CASA)
- [ ] Vitrine pública institucional (trilho paralelo opcional — vitória rápida)

## Referências
- Relatório do protótipo Connect: stack HTML/CSS/JS, monolito modularizado em 2026-06-09
- Backend deste repo: `apps/api` (REST `/api/v1`, Swagger em `/api/docs`)
- Padrões: `apps/api/src/fichas-cidadas/` (endpoints), `apps/web/app/servico-social/` (consumo)
