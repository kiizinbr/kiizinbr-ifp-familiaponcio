# 📍 ONDE PARAMOS — IFP Connect

> **Atualizado em 2026-06-24.** Este é o doc de estado VIVO — abra aqui ao retomar.
> Branch de trabalho/entrega: `claude/continue-projetoifp-section-10-RKC1n`.
> Detalhe do gap por tela: `docs/COMPARATIVO-100.md`. Esteiras autônomas: `docs/RFC-FECHAR-GAP-AUTONOMO.md`.

---

## ✅ ESTADO ATUAL

- **Repo + Produção (`ifp-final`):** ambos em **`2eebf94`**, working tree limpo, tudo empurrado. Smoke HTTPS verde (web/health 200).
  - URL: **https://ifp-final.taile04c66.ts.net** · SSH: `ifp@100.118.69.57` · stack em `/opt/ifp-connect`.
- **No ar (24/06):** Onda D (5 unidades, zero-migration) + **rotação de segredos de produção** (4 estruturais + 8 contas `@ifp.local`; segredos em `ifp-deploy\secrets-prod-20260624.txt` → mover pro Vaultwarden) + **3 features do Grupo A**.
- **Infra:** a VM velha **`ifp-app` foi DESATIVADA** (`Export-VM` completo → `C:\VM-Backups\ifp-app-20260624` + `Stop-VM`; produção é só a `ifp-final`). Ver memória `ifp-vm-cutover-decision`.
- **⚠ Pegadinha de deploy (rotação):** mudar só valores do `.env` NÃO recria api/web/redis (`up -d`) — precisa `--force-recreate`; e o `/health` não detecta (smoke com login). Deploy de CÓDIGO (imagem nova) recria normalmente.
- **Gap atualizado:** `docs/GAP-ATUAL-2026-06-24.md` — mapeamento real por área (núcleo interno **~88%**; o `COMPARATIVO-100.md` está defasado). Gap agrupado por desbloqueio: **A** fazer-já · **B** IA · **C** storage/envio · **D** dados novos · **E** site público.

### O que foi entregue nas esteiras (23–24/06)
- **Grupo A do gap (24/06, esportivo — `568efeb`→`2eebf94`, no ar):** diploma de graduação em **PDF** (QR + verificação pública), **ficha de frequência por atleta** (sinal de evasão por faltas seguidas) e **edição dos dados da turma** (horário/local/faixa/vagas, anti-overbooking). `valida-esportivo` 99/99.
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

1. **Continuar o Grupo A do gap** (ver `docs/GAP-ATUAL-2026-06-24.md`) — itens "fazer-já" sem dependência externa: indicadores longitudinais da Capacitação, painel de config do Admin, saúde populacional na Presidência, filtros/busca, etc. *(passo natural — eu construo)*
2. **Guardar segredos:** mover `C:\Users\Erick\ifp-deploy\secrets-prod-20260624.txt` pro Vaultwarden e apagar o arquivo.
3. **Remover a VM `ifp-app` de vez (opcional):** está DESLIGADA com backup completo; falta só `Remove-VM` definitivo (e travar auto-start) quando quiser.
4. **Gap que exige decisão sua:** **B** camada de IA (resumo/triagem/histórias/áudio) · **C** storage+envio (uploads/fotos/notificações — já tem MinIO) · **E** site público · **D** dados novos (custo/doadores). Cada um precisa do seu escopo/design.

> ✅ Resolvida (24/06): **VM velha `ifp-app` DESATIVADA** (Export-VM completo + Stop-VM; backup em `C:\VM-Backups\ifp-app-20260624`).
> ✅ Resolvida (24/06): **Onda D deployada** na `ifp-final` (zero-migration) — 5 unidades no ar.
> ✅ Resolvida (24/06): **rotação de segredos de produção** — 4 estruturais (POSTGRES/REDIS/JWT/NEXTAUTH) + as 8 senhas de conta `@ifp.local` trocadas por fortes (login com senha dev antiga agora dá 401). Segredos em `C:\Users\Erick\ifp-deploy\secrets-prod-20260624.txt` → **mover pro Vaultwarden e apagar**. ⚠ **Pegadinha:** `up -d` NÃO recria api/web/redis quando só o `.env` muda (valor interpolado em `DATABASE_URL`/`REDIS_URL` etc.) — precisa **`--force-recreate`**; e o **`/health` não detecta** (não toca banco/redis) → smoke sempre com **login**. Postgres rotaciona por `ALTER USER` (volume persiste); redis precisa recreate (senha vive no `command`). *(Dev local segue com senhas dev — não confundir com produção.)*
> ✅ Resolvida (24/06): o bug do `valida-presidencia.mjs` (logava admin com `SENHA_DEV`) foi corrigido em `d98fcc8` — suíte agora passa 54/54.

## 📌 ATALHO
Quer continuar de onde paramos? Diga **"vamos pro passo natural"** → a sugestão é **seguir o Grupo A** (mais itens "fazer-já" do `GAP-ATUAL`). Ou aponte uma frente do gap (B IA · C storage/envio · E site público) com sua decisão de escopo que eu desenho e construo.
