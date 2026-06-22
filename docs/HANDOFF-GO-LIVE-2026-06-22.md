# Handoff — Go-Live do IFP Connect (varredura + o que falta)

> **Para a outra sessão/terminal que trabalha neste repo.**
> Resumo do que foi feito na **varredura de pré-lançamento (rodada 2)** e o que **ainda precisa melhorar antes do go-live**.
> Data: **2026-06-22** · Branch: `claude/continue-projetoifp-section-10-RKC1n` (CASA).
> Relatório completo (50 achados com arquivo:linha): `docs/AUDITORIA-PRELANCAMENTO-RODADA2-2026-06-22.md`.

---

## 1. O que foi feito

Retomei a varredura de go-live. A auditoria de 22/06 (rodada 1) tinha coberto o núcleo, mas **não tinha varrido a superfície nova**: módulo **Serviço Social** (triagem, elegibilidade, encaminhamentos cross-unidade, ponte), **prescrição/consentimento** e **prestação de contas**. Rodei uma auditoria estática multi-agente (8 dimensões + verificação adversarial) **+ re-check** dos P2/P3 antigos.

**Resultado:** 52 achados confirmados → **50 abertos (2 P1 · 21 P2 · 27 P3)**, 2 P2 já tinham caído com os fixes da rodada 1, 1 refutado (XSS — não existe). **Veredito: NÃO LANÇAR** até fechar 6 bloqueadores.

### Os 6 bloqueadores — **JÁ CORRIGIDOS, VERIFICADOS E COMMITADOS** (não empurrados)

| Commit | Sev | Fix |
|--------|-----|-----|
| `f72c41a` | **P1** | **Ponte:** origem da sinalização agora é *server-authoritative* (derivada do cadastro do Profissional logado); o `unidadeOrigemSlug` do corpo é ignorado. Fechava forja de origem na auditoria + sinalizar como outra unidade. |
| `f1da4a3` | **P1** | **Wizard Nova Ficha:** `router.push` movido para dentro do `try` (navega só no sucesso); no erro segura na tela com o alerta. Antes, falha ao salvar membros/renda passava como sucesso silencioso. |
| `4eca74b` | P2 | **Elegibilidade:** backend passa a **exigir `motivo`** ao REPROVAR/SUSPENDER/DESLIGAR (antes só validava no client) + grava no audit. |
| `dfbf945` | P2 | **Middleware:** `/presidencia/:path*` adicionado ao matcher (senha provisória agora é forçada lá também). |
| `d2194ae` | P2 | **Throttle login:** `@Throttle` de 10/min por IP no `/auth/login` (antes só o teto global de 120/min). |
| `a7a2a44` | P2 | **Open redirect:** `callbackUrl` do login validado — só aceita caminho interno. |

(+ `1f8a4b6` = doc do relatório.)

**Verificação:** typecheck + lint (api/web) verdes · regressões ao vivo **valida-ponte 12/12** (com caso anti-forja), **valida-fichas-cidadas 11/11** (motivo sem→400/com→200), **encaminhamentos 15/15**, **triagem 14/14**.

**Estado:** com os 6 fechados, o veredito sobe de **NÃO LANÇAR → QUASE-PRONTO**. Falta revalidar a **Camada 2 ao vivo** (navegador) das telas novas no servidor antes do 1º usuário real.

---

## 2. O que ainda precisa melhorar para o go-live

> Decisão consciente: os fixes acima fecharam os furos de segurança reais. O resto é **endurecimento**. Lista priorizada (a completa, com arquivo:linha e correção, está no relatório).

### 🟡 Recomendado ANTES do piloto controlado (baratos e relevantes)
1. **Idempotência da fila do Serviço Social** — `criar()` de triagem/encaminhamento/ponte não tem unique → **duplo-clique duplica a fila**. Adicionar índice único parcial (WHERE status PENDENTE) + tratar P2002 como 409 (espelhar `agenda.service`).
2. **Minimização na lista de triagem** — o `include` da LISTA devolve **telefone + dataNascimento de toda a fila**. Remover do payload da listagem (manter só no detalhe, com audit).
3. **Ponte — scoping por ficha** (follow-up do P1): além de derivar a unidade, idealmente limitar quais fichas o profissional pode sinalizar (família com vínculo na unidade dele). Deixei de fora para não arriscar travar sinalização legítima — avaliar com o modelo de dados em mãos.
4. **TOCTOU na barreira de alergia** — `atendimentos.service.ts:188`: o `findMany` de alergias está fora da transação do prescrever. Mover para dentro do lock.
5. **Swagger `/api/docs`** exposto sem guard em produção — proteger por `NODE_ENV`/auth.

### 🟡 Endurecimento (pós-piloto, mas faça logo)
- **Audit READ faltante** em leituras de PII: agenda do dia / fila da unidade (`agenda.service.ts`), diário do menor (`rotina.service.ts:220`), `/medico/indicadores`.
- **Minimização na prancha médica** — expõe elegibilidades cross-vertical da família (`agenda.service.ts:51-67`).
- **Races sem transação**: check-in/out da creche; graduação esportiva P2002 → 500.
- **Capacitação**: encerrar turma ignora matrícula TRANCADA (status órfão).

### 🟢 Pós go-live (P3 / qualidade)
- **Acessibilidade AA** das telas novas do Serviço Social (foco visível, contraste, labels de prescrição, parar de classificar erro por substring) + o contraste do `text-muted-foreground` no portal família.
- JWT 8h sem refresh/revogação; índices faltando em `Graduacao`/`Certificado`/`ConversaFamilia`; demais P3 de integridade.

---

## 3. ⚠️ Coordenação (importante)

A branch é compartilhada e está **quente**: durante esta sessão o **local avançou 4 commits sozinho** (esta ou outra sessão/loop na mesma working tree — KPIs/topbar/tela-403/docs). O **`origin` está parado em `c621ec2`**; o local está **11 commits à frente, NADA empurrado** (4 da outra sessão + os 7 meus).

- **SEMPRE `git fetch` / conferir o working tree antes de mexer** — duas sessões na mesma pasta pisam uma na outra.
- Antes de empurrar, alinhar quem empurra (o local diverge do origin).

---

## 4. Como verificar (regressão local)

Banco em `127.0.0.1:5444` (`ifp_connect`). Sequência rápida (o forward NAT decai por idle — rodar tudo em sequência):

```
pnpm db:seed                       # recria dados de teste
pnpm --filter @ifp/api build       # compila para dist/
# subir node apps/api/dist/main.js destacado (Start-Process) e esperar a :3333
SENHA_ADMIN=IfpDev2026! SENHA_DEV=MedicoDev!2026 node scripts/valida-ponte.mjs
SENHA_ADMIN=IfpDev2026! SENHA_DEV=MedicoDev!2026 node scripts/valida-fichas-cidadas.mjs
# + valida-encaminhamentos.mjs, valida-triagem.mjs
```
Validação estática (sempre verde): `cd apps/api && pnpm typecheck` · `cd apps/web && pnpm typecheck && pnpm lint`.

---

*Gerado na retomada da varredura de go-live (workflow `ifp-golive-retomada`, 8 dimensões × verificação adversarial).*
