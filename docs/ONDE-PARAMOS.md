# 📍 ONDE PARAMOS — IFP Connect

> **Atualizado em 2026-06-25.** Doc de estado VIVO — abra aqui ao retomar.
> Branch de trabalho/entrega: `claude/continue-projetoifp-section-10-RKC1n`.
> Auditoria: `docs/AUDITORIA-2026-06-25.md` · Decisões de prod: `docs/DECISOES-PRODUCAO.md` · RFC do sweep: `docs/RFC-SWEEP-COMPLETO-2026-06-24.md`.

---

## ✅ PRODUÇÃO REAL NO AR (cutover 2026-06-25)

- **`ifp-final` em `229d72c`, base LIMPA** (zero fixture): 1 usuário (Super Admin), 4 unidades, 0 fichas, 25 migrations.
  - URL: **https://ifp-final.taile04c66.ts.net** · SSH `ifp@100.118.69.57` · stack `/opt/ifp-connect`.
  - Super Admin: `erickramos.ti@gmail.com` (senha provisória, `mustChangePassword=true` — troca no 1º login).
  - MinIO de prod no ar (storage funcionando: `/admin/storage/health` = ok). Backup pré-limpeza em `~/ifp-backups/`.
- **Pendências operacionais:** (1) logar e trocar a senha → depois `rm ~/admin-prov-pw.txt` na VM; (2) MINIO creds + segredos de 24/06 → **Vaultwarden**.

## 📦 O que foi entregue (24–25/06)
- **Ondas A/C/E (11 features):** A=fazer-já (saúde populacional, indicadores Capacitação, filtros, graduação na família, verificação pública, painel Admin config) · C=storage (StorageService+MinIO, upload na ficha, fotos do diário, notificação in-app) · E=site público portado do Designer pra rota React.
- **Auditoria completa** (`docs/AUDITORIA-2026-06-25.md`, 62 agentes): núcleo ~88% pronto; achados P0/P1/P2 verificados adversarialmente.
- **10 correções** (3 P0 + P1 seguros): seed fora de prod + `seed-admin`, MinIO no compose, auditoria não-silenciosa, IDOR esportivo, $queryRaw allowlist, upload rollback + magic bytes, throttle público, exception filter + logging, telas órfãs, RESEND removido.

---

## 🎯 PRÓXIMO CAPÍTULO — "tirar a cara de beta" (feedback do Erick, 25/06)

> Erick: *"toda vez que vejo ele pra terminar tenho sensação de um sistema beta."* Verdade — e dá pra atacar. O núcleo FUNCIONA; o que falta é **acabamento, conteúdo real e alma**. Frentes:

1. **Conteúdo real (mata o ar de demo):** site com **contato/endereço/telefone reais** + **KPIs reais** (+500 famílias / +8 anos são placeholder) + **fotos próprias** (hoje vêm do CDN Wix e às vezes nem carregam → baixar pra `/public/site`). Remover TODO "a confirmar"/"Em breve".
2. **O "wow" (Grupo B — IA):** resumo clínico, triagem assistida, resumo do dia da creche, histórias de impacto. É o que faz parecer **moderno/premium** em vez de CRUD. *(Gate: chave Anthropic + decisão LGPD do Erick.)*
3. **Envio real (Grupo C):** notificação/e-mail/WhatsApp à família (hoje só in-app). *(Gate: SMTP/WhatsApp.)*
4. **Polish de UX:** estados de loading/empty com personalidade, micro-interações, transições, vazios que orientam o usuário — o "lived-in feel".
5. **Hardening P2 da auditoria:** a11y (instituto público), observabilidade fina, índices de FK, índice de busca (pg_trgm).
6. **Dado real:** sistema vazio SEMPRE parece beta — parte da sensação some quando entram **beneficiários/atividade reais** (operacional, não código).

> **Atalho ao reabrir:** diga **"vamos tirar a cara de beta"** → começo pela frente 1 (conteúdo real do site, sem gate) + frente 4 (polish), que são as que mais mudam a PERCEPÇÃO sem depender de credencial sua. As frentes 2 e 3 destravam quando você passar as chaves.

## 🔧 Como retomar o DEV local
1. `git pull` na branch acima.
2. Helper de CI (recriado por sessão — receita na memória `ifp-fechar-gap-programa`): `ifp-ci.ps1` (`start-api`/`build-api`/`valida -Name X`/`typecheck`; carrega `.env`, seta `SENHA_DEV`). API dist `:3333`, Postgres `:5444`, MinIO `:9000`.
3. Senhas dev: admin `IfpDev2026!` · demais `MedicoDev!2026`. (Prod ≠ dev — prod tem só o admin real.)
