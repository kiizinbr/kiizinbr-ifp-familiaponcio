# 📍 ONDE PARAMOS — IFP Connect

> **Atualizado em 2026-06-23 (~20h30).** Este é o doc de estado VIVO — abra aqui ao retomar.
> Branch de trabalho/entrega: `claude/continue-projetoifp-section-10-RKC1n`.
> Detalhe do gap por tela: `docs/COMPARATIVO-100.md`. Esteiras autônomas: `docs/RFC-FECHAR-GAP-AUTONOMO.md`.

---

## ✅ ESTADO ATUAL (tudo verde, tudo no ar)

- **Repo:** branch em `b536b7d`, working tree limpo, **tudo empurrado** pro GitHub.
- **Produção (`ifp-final`):** rodando **`b536b7d`** — **20 unidades no ar** (9 da entrega da noite + Onda B 6 + Onda C 5), **8 migrations aditivas aplicadas**. Smoke HTTPS verde.
  - URL: **https://ifp-final.taile04c66.ts.net** · SSH: `ifp@100.118.69.57` · stack em `/opt/ifp-connect`.
- **Verificação:** `pnpm typecheck` do repo inteiro VERDE; **18 scripts `valida-*` verdes** (regressão backend por área).

### O que foi entregue nas esteiras desta sessão (23/06)
- **Onda B (`c90ed32`→`df4ac17`):** seletor de unidade pós-login · polimento esportivo/cap (4º estado "Atrasado", ocupação) · consentimento da família (imagem+dados LGPD) · agenda transversal das 4 unidades · relatórios institucionais selados em PDF · linha do tempo da criança.
- **Onda C (`ea08a82`→`b536b7d`):** edição inline da ficha (+ corrigiu bug: CPF era editável) · painel/catálogo esportivo rico · impacto longitudinal (séries temporais) · **Banco de Modelos** (sessões práticas + matching aluno↔modelo) · **auto-provisionamento** de acesso da família (senha provisória, sem SMTP).

---

## 🔧 COMO RETOMAR O DEV (ambiente local na workstation)

> O ambiente de dev vive na workstation `C:\Users\Erick\Documents\GitHub\kiizinbr-ifp-familiaponcio`.
> Containers Docker: Postgres dev `:5444`, Redis `:6380`, Minio `:9000`. API dist em `:3333`. Web dev `next dev` em `:3000`.

1. `git pull` na branch acima.
2. Subir o helper de CI (recriado a cada sessão — receita na memória `ifp-fechar-gap-programa`): `ifp-ci.ps1` com `health | restart | migrate -Name <x> | valida -Name <x> | seed | typecheck`.
   - ⚠ Helper já corrigido: mata a API `:3333` ANTES de `prisma generate` (EPERM do `query_engine-windows.dll`), e usa `$ErrorActionPreference="Continue"`.
3. `restart` (rebuilda + sobe API `:3333`) → `valida -Name usuarios` deve dar verde.
   - ⚠ Se `valida-usuarios` der 50/51 (busca "gestora encontra usuário"), é **resíduo de teste** acumulado → `prisma migrate reset --force` zera e volta a 51/51. Não é bug.
4. Senhas dev: admin `IfpDev2026!` · demais `MedicoDev!2026`.

## 🚀 COMO FAZER DEPLOY (agora é simples — fixes já no repo)
Em `ifp@100.118.69.57:/opt/ifp-connect` (detalhe e receita completa na memória `ifp-vm-cutover-decision`):
1. `pg_dump` backup → `~/ifp-backups/`.
2. `git pull --ff-only` (LIMPO — sem `git checkout schema.prisma`, sem reaplicar binaryTargets; tudo commitado).
3. `docker compose -f docker-compose.prod.yml -f docker-compose.tailscale.yml --env-file .env.production build api web migrate` (⚠ incluir `migrate`).
4. `--profile tools run --rm -T migrate` → roda `migrate deploy` (⚠ o **`-T`** evita o `run` engolir o stdin do script; ou rode `up -d` num passo SEPARADO).
5. `docker compose ... up -d` → smoke HTTPS.

---

## 📋 PENDÊNCIAS (em aberto, sem pressa)

1. **Segurança:** `.env.production` ainda tem **senhas dev** → rotacionar segredos. *(próximo passo natural)*
2. **Infra:** desativar a VM velha `ifp-app` (`100.104.192.49`) — exportar backup Amplimed (dado clínico) antes.
3. **Bug menor (script de teste):** `scripts/valida-presidencia.mjs` loga o admin com a senha do médico (`SENHA_DEV`) em vez de `SENHA_ADMIN` → 401. É bug do teste, não do app.
4. **Gap restante = decisão humana:** o "poço seguro" afinou. O que falta no `COMPARATIVO-100.md` é majoritariamente **IA** (resumo-ia, triagem-ia, histórias-ia, áudio), **site público** (design), e telas que dependem de **dados que não existem** (custo/beneficiário, CRM doadores, mapa territorial). Nada disso dá pra automatizar com segurança — exige você decidir escopo/design/dados.

## 📌 ATALHO
Quer só continuar de onde paramos? Diga **"vamos pro passo natural"** → a sugestão é a **rotação de segredos do `.env.production`** (pendência #1). Ou aponte uma frente do gap (com sua decisão de escopo) que eu desenho e construo.
