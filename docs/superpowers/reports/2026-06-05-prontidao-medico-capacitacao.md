# Prontidão para Uso Real — Médico & Capacitação

**Data:** 2026-06-05 (pós Sprint de Endurecimento)
**Método:** frota de 4 agentes (gap analysis Médico, Capacitação, Produção/dado-real + síntese), lendo o código atual.
**Pergunta:** o que falta para Médico e Capacitação operarem com **pessoas reais** (não seed)?

## Veredito

Os dois núcleos funcionais são fortes (Médico: agenda anti-overbooking + prontuário imutável/assinado + RBAC; Capacitação: catálogo + turma + matrícula transacional). **Mas nenhuma das duas pode operar com dado real hoje — e o bloqueio NÃO é código de vertical, é a camada cross-cutting de identidade/produção.**

**Prontidão:** Médico **5/10** · Capacitação **4/10**.

## 🔴 As 3 travas que matam as DUAS verticais

1. **Sem criar conta real pela UI** — `admin/users` é read-only ("edição em desenvolvimento"); única via é `seed.ts`/SQL com senha demo pública. Raquel/Luciana não têm conta própria.
2. **Reset de senha é stub** — `reset/page.tsx` só faz `setSent(true)` (sem server action, sem SMTP, sem `/reset/[token]`). Esqueceu a senha = trancado fora.
3. **Ambiente é STAGING** — `ops/vm/README`: "Ambiente de demonstração. Não usar com paciente real". Sem domínio/TLS próprio, sem healthcheck, banner staging ligado. Os commits do sprint nem valem em prod até o deploy rodar.

## Gaps de capacidade por vertical

### Médico (5/10) — pronto: agenda, fila, prontuário, encaminhamento, busca, cancelar

Falta pra substituir o Amplimed:

- **Prescrição de medicamento** [L] — card inerte "Chega no F1.B.3", zero model. Saída mais esperada da consulta.
- **Atestado/declaração (PDF)** [L] — idem, demanda diária. Reusa a infra de PDF da prescrição.
- _(nice-to-have: remarcar consulta, auto-refresh da fila, autocomplete CID-10, relatórios)_

### Capacitação (4/10) — pronto: catálogo, matrícula transacional, máquina de estados

Falta pra fechar uma turma de ponta a ponta:

- **Presença na aula** [M] — zero model/rota. É o dado-base do ciclo.
- **Certificado (80% → PDF QR)** [L] — a razão de ser da capacitação. Depende de presença.
- **Bugs que já quebram com dado real** [S] — turma trava em `planejada` p/ sempre (sem action de transição de status); `<select>` de candidatos com `take:300` (acima disso o cidadão não aparece).

## Caminho recomendado (3 fases) — regra de ouro: nenhum dado real antes da Fase 1 fechar

### Fase 1 — Destravar identidade + produção _(go-live gate, bloqueia as duas, ~1 sprint)_

- Provisionamento de conta na `admin/users` (criar user + atribuir role/unitScope, super_admin, zod+audit).
- Reset/primeiro-acesso real (token+expiração, SMTP/Resend, `/reset/[token]`, troca forçada no 1º login).
- Zerar/rotacionar senhas demo; separar dataset de prod do seed.
- Deploy de produção (domínio + TLS próprio, `AUTH_URL` de prod, remover banner staging).
- `/api/health` (app+db+minio) + healthcheck no container + captura de erro server-side (Sentry).
- Cifrar o dump do backup + **restore drill** real.
- Base legal LGPD: consentimento versionado por titular + ROPA inicial.

### Fase 2 — Capacidade mínima por vertical _(em paralelo, ~1-2 sprints)_

- Médico: Prescrição (model+action+PDF com CRM) → Atestado (reusa PDF).
- Capacitação: Presença (model+action lote+UI mobile) → Certificado (80%+PDF QR+verificação) → transição de status da turma → busca incremental de candidatos.

### Fase 3 — Polish + endurecimento _(pós go-live, não bloqueia)_

- Médico: remarcar, auto-refresh, CID-10 autocomplete, relatórios.
- Capacitação: editar curso/turma, trilha/histórico do aluno, material de aula.
- Cross: RLS no Postgres, CSP report-only→enforce+nonce, retenção de audit, sair do next-auth beta.

## Conexão com o sprint que acabou

O Sprint de Endurecimento blindou o **dado** (PHI/LGPD/race/rate-limit). Ele **não tocou** a camada de **identidade/produção** — que agora é o blocker #1. Faz sentido: dado seguro só vale com contas reais + deploy real + base legal. A Fase 1 fecha exatamente esse buraco.
