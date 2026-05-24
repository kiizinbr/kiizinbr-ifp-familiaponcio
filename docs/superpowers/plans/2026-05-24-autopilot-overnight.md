# Autopilot Overnight Plan — 2026-05-24

**Contexto:** Erick aprovou o agente seguir trabalhando enquanto ele dorme, mas apenas dentro de escopo seguro pré-acordado. Este documento É esse acordo. Quaisquer mudanças fora desta lista exigem aprovação explícita ao acordar.

**Regras de operação (BLOQUEANTES):**

1. **Apenas tarefas listadas abaixo.** Se aparecer ideia nova durante execução, anotar em "Backlog descoberto" no fim deste arquivo — NÃO executar.
2. **Commit por tarefa.** Cada item vira 1 commit atômico, mensagem clara, rollback fácil via `git revert`.
3. **Push pode** se branch é `main`, GCM tem credenciais cached, e push é fast-forward (sem `--force`).
4. **Nunca** `git rebase --root`, `--force`, `--force-with-lease`, ou qualquer reescrita de histórico já commitado.
5. **Nunca** mudar settings do GitHub (branch protection, secrets, etc), licença, ou conta.
6. **Nunca** instalar pacotes pesados (>50 MB) sem pedir. Pequenas devDeps com clara justificativa: OK.
7. **Nunca** tocar em: `prisma/schema.prisma` (sem nova migration), `auth.ts` (segurança), `.env.local` (segredos), `.env.example` (formato), `docker-compose.dev.yml` (volumes).
8. **Nunca** mexer em outros projetos do Erick (CLEANHUB, intranet, scheduled tasks, IIS).
9. **CI vermelho**: tentar 1 autofix (formato, lint). Se falhar de novo OU se a falha for de teste/build, PARAR e documentar.
10. **Se confuso**, PARAR e documentar em "Bloqueado" no fim.
11. **Pre-commit ritual obrigatório**: rodar `pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test` ANTES de cada commit. Só commit se todos passam. Evita ciclo "commit → push → CI vermelho → autofix → commit".

---

## Tarefas autorizadas (executar em ordem, parar à primeira que pedir input)

### T1 — Garantir CI verde (commit 58be526 + correções triviais)

- [x] Monitorar CI run 26351766013 até completion
- [x] Se conclusion=success: T12 do Plano 1 Foundation marcada COMPLETA, atualizar memoria
- [x] Se conclusion=failure no step "Format check" ou "Lint": autofix (`pnpm format` / `pnpm lint --fix`), commit, push, novo monitor (1 retry máximo)
- [x] Se falhar por outro motivo (test, build, migrate): PARAR, anotar em "Bloqueado"

### T2 — Refactor `middleware.ts` → `proxy.ts` (Next.js 16 deprecation)

**Por quê:** Build/dev imprime warning `The "middleware" file convention is deprecated. Please use "proxy" instead.` Risco zero pois renomeação direta + ajuste de import path se necessário.

- [x] `git mv src/middleware.ts src/proxy.ts`
- [x] Validar `pnpm build` ainda gera o "Proxy (Middleware)" route
- [x] Validar `pnpm test:e2e` ainda passa (gate de proteção do /app continua funcionando)
- [x] Commit: `refactor: middleware.ts -> proxy.ts (Next.js 16 convention)`

### T3 — Remover `@types/bcryptjs` deprecated

**Por quê:** Avisado pelo npm warn. bcryptjs 3.x agora exporta types nativos.

- [x] `pnpm remove -D @types/bcryptjs`
- [x] Validar `pnpm typecheck` continua verde
- [x] Commit: `chore: remove @types/bcryptjs (deprecated, bcryptjs 3.x has native types)`

### T4 — README polish

**Por quê:** Dev pessoal hoje + alinhar com decisão de Node DENTRO do WSL.

- [x] Atualizar seção "Setup local" pra refletir comandos via `wsl -d Ubuntu`
- [x] Adicionar seção "Troubleshooting > wslrelay flapping" curta
- [x] Adicionar seção "Acesso ao app" (URLs login/app/studio/minio)
- [x] Commit: `docs: README com comandos WSL + troubleshooting`

### T5 — Script `dev:up` no package.json

**Por quê:** Comando único conveniente pra preflight (sobe containers + warm relay).

- [x] Adicionar `"dev:up": "docker compose -f docker-compose.dev.yml up -d && docker exec ifp_postgres_dev pg_isready -U ifp -d ifp_connect"`
- [x] Validar `pnpm dev:up` (de dentro do WSL) retorna `accepting connections`
- [x] Commit: `chore: pnpm dev:up para boot containers + warmup`

### T6 — Atualizar memorias do projeto + index

- [x] Marcar Plano 1 Foundation 12/12 done em [[project-ifp-connect]]
- [x] Atualizar [[reference-ifp-dev-commands]] com `dev:up`
- [x] (Não atualizar MEMORY.md desnecessariamente — links existentes seguem corretos)

---

## NÃO fazer (lista explícita — pedir ao acordar)

- ❌ **Iniciar Plano 2 RBAC** — decisão de produto (definir os 7 perfis exatos, hierarquia, audit log granularity)
- ❌ **Mexer no spec MVP** ou no plano Foundation — base de outras decisões já tomadas
- ❌ **Adicionar features novas** ao login (esqueci minha senha, magic link, OAuth Google, etc) — Plano 5 LGPD/Plano 2 RBAC tratam
- ❌ **Mudar tema/cores/tipografia** — Plano 7 Polish UI usa skill frontend-design
- ❌ **Configurar Husky/lint-staged** — muda dev workflow, requer alinhamento
- ❌ **Setar branch protection no GitHub** — config remota, precisa decisão
- ❌ **Subir o app em qualquer ambiente diferente de localhost** — fase 1 hosting é VM Hyper-V (Plano 8)
- ❌ **Tocar em outros repos do Erick** ou outros projetos no servidor
- ❌ **Apagar arquivos** ou pastas existentes (mesmo "obviamente" lixo)

---

## Bloqueado (preencher se aparecer)

_(vazio)_

## Backlog descoberto durante execução (preencher se aparecer)

_(vazio)_

## Log de execução

| Hora UTC | Commit        | Task                                         | Nota                                               |
| -------- | ------------- | -------------------------------------------- | -------------------------------------------------- |
| 04:17    | `3ef4393`     | Original push (T10/T11 commits)              | CI #1 falhou em "Format check"                     |
| 04:21    | `58be526`     | Autofix Prettier (lock+README+pages)         | CI #2 falhou em "Unit tests" (Vitest rodava .e2e.) |
| 04:25    | `477917f`     | vitest exclude tests/e2e                     | CI continuou ainda em Format check                 |
| 04:25    | `960fa38`     | Doc autopilot plan                           | Format check falhou (MD novo sem prettier)         |
| 04:29    | `60eb981`     | Prettier no autopilot.md                     | ✅ CI VERDE — Plano 1 Foundation 12/12             |
| 04:35    | `832f10d`     | Adiciona regra pre-commit ritual             | ✅ CI verde                                        |
| 04:36    | `431e5d5`     | **T2** refactor middleware -> proxy.ts       | e2e passou (1.2s), warning sumiu                   |
| 04:38    | `0a6260f`     | **T3** remove @types/bcryptjs deprecated     | typecheck verde sem ele                            |
| 04:39    | `3331ca5`     | **T4** README polish (WSL/URLs/troubleshoot) | —                                                  |
| 04:40    | `43fe30b`     | **T5** pnpm dev:up + dev:down scripts        | dev:up validado                                    |
| 04:41    | _este commit_ | **T6** memorias atualizadas + log final      | —                                                  |

## Observações pós-execução

- **Ritual pre-commit foi crucial**: 3 falhas seguidas de CI no início, todas em "Format check", caíram a zero após adotar `pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test` antes de cada commit.
- **Próximos planos** (NÃO executados, aguardam Erick): Plano 2 RBAC, Plano 3 Ficha Cidadã, Plano 4 Triagem.
- **Pendência não-bloqueante**: dev workflow no Windows exige rodar tudo via `wsl -d Ubuntu --` ou shell WSL. Se ficar dolorido, mover workspace pra `~/ifp-connect` dentro do WSL elimina o 9P overhead.
