# 📍 ONDE PARAMOS — IFP Connect

> **Atualizado em 2026-06-24.** Este é o doc de estado VIVO — abra aqui ao retomar.
> Branch de trabalho/entrega: `claude/continue-projetoifp-section-10-RKC1n`.
> Detalhe do gap por tela: `docs/COMPARATIVO-100.md`. Esteiras autônomas: `docs/RFC-FECHAR-GAP-AUTONOMO.md`.

---

## ✅ ESTADO ATUAL

- **Repo:** branch em `1b33af1`, working tree limpo, **tudo empurrado** pro GitHub.
- **Produção (`ifp-final`):** rodando **`b536b7d`** — 20 unidades, 8 migrations. Smoke HTTPS verde.
  - ⚠️ **A Onda D (`6f3f95f`→`1b33af1`, 6 commits) está no repo e verificada localmente, mas AINDA NÃO foi deployada** — produção está atrás. Como a Onda D é **zero-migration**, o deploy é trivial (build + up, **sem** rodar `migrate`).
  - URL: **https://ifp-final.taile04c66.ts.net** · SSH: `ifp@100.118.69.57` · stack em `/opt/ifp-connect`.
- **Verificação da Onda D (2026-06-24, ambiente local):** `pnpm typecheck` do repo inteiro VERDE; `valida-*` das áreas tocadas **todos verdes** — notificacoes **31/31** · ponte **15/15** · encaminhamentos **21/21** · social-ficha **32/32** · presidencia **54/54**.

### O que foi entregue nas esteiras (23–24/06)
- **Onda D (`6f3f95f`→`1b33af1`) — esteira ralphinho, zero-migration, verificada 24/06:** D1 Serviço Social a ~100% (timeline de encaminhamentos na ficha + `motivo` obrigatório no backend ao reprovar/suspender/desligar) · D2 ponte cross-vertical (ação "Sinalizar ao Social" reutilizável nas verticais médico/educacional → `POST /servico-social/ponte`) · D3 Central de Avisos real (`GET /notificacoes` agregando sinais por perfil, RBAC/tenant, + sino na topbar) · D4 panorama territorial por bairro (`GET /presidencia/territorio`, dado real de `fichaCidada.bairro`, sem geo falso) · D5 polimento de credibilidade (painel médico + chamada da capacitação).
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

## 📋 PENDÊNCIAS (em aberto)

1. **Deploy da Onda D em produção (`ifp-final`):** repo está em `1b33af1`, produção em `b536b7d`. É **zero-migration** → seguir a receita de deploy acima **pulando o passo 4 (migrate)**: `pg_dump` backup → `git pull --ff-only` → `build api web` → `up -d` → smoke HTTPS. *(passo natural agora)*
2. **Segurança:** `.env.production` ainda tem **senhas dev** → rotacionar segredos.
3. **Infra:** desativar a VM velha `ifp-app` (`100.104.192.49`) — exportar backup Amplimed (dado clínico) antes.
4. **Gap restante = decisão humana:** o "poço seguro" afinou. O que falta no `COMPARATIVO-100.md` é majoritariamente **IA** (resumo-ia, triagem-ia, histórias-ia, áudio), **site público** (design), e telas que dependem de **dados que não existem** (custo/beneficiário, CRM doadores). Nada disso dá pra automatizar com segurança — exige você decidir escopo/design/dados.

> ✅ Resolvida (24/06): o bug do `valida-presidencia.mjs` (logava admin com `SENHA_DEV`) foi corrigido em `d98fcc8` — suíte agora passa 54/54.

## 📌 ATALHO
Quer só continuar de onde paramos? Diga **"vamos pro passo natural"** → a sugestão é o **deploy da Onda D na `ifp-final`** (pendência #1, deploy trivial sem migration). Ou aponte uma frente do gap (com sua decisão de escopo) que eu desenho e construo.
