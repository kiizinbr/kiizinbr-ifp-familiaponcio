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

- [ ] Monitorar CI run 26351766013 até completion
- [ ] Se conclusion=success: T12 do Plano 1 Foundation marcada COMPLETA, atualizar memoria
- [ ] Se conclusion=failure no step "Format check" ou "Lint": autofix (`pnpm format` / `pnpm lint --fix`), commit, push, novo monitor (1 retry máximo)
- [ ] Se falhar por outro motivo (test, build, migrate): PARAR, anotar em "Bloqueado"

### T2 — Refactor `middleware.ts` → `proxy.ts` (Next.js 16 deprecation)

**Por quê:** Build/dev imprime warning `The "middleware" file convention is deprecated. Please use "proxy" instead.` Risco zero pois renomeação direta + ajuste de import path se necessário.

- [ ] `git mv src/middleware.ts src/proxy.ts`
- [ ] Validar `pnpm build` ainda gera o "Proxy (Middleware)" route
- [ ] Validar `pnpm test:e2e` ainda passa (gate de proteção do /app continua funcionando)
- [ ] Commit: `refactor: middleware.ts -> proxy.ts (Next.js 16 convention)`

### T3 — Remover `@types/bcryptjs` deprecated

**Por quê:** Avisado pelo npm warn. bcryptjs 3.x agora exporta types nativos.

- [ ] `pnpm remove -D @types/bcryptjs`
- [ ] Validar `pnpm typecheck` continua verde
- [ ] Commit: `chore: remove @types/bcryptjs (deprecated, bcryptjs 3.x has native types)`

### T4 — README polish

**Por quê:** Dev pessoal hoje + alinhar com decisão de Node DENTRO do WSL.

- [ ] Atualizar seção "Setup local" pra refletir comandos via `wsl -d Ubuntu`
- [ ] Adicionar seção "Troubleshooting > wslrelay flapping" curta
- [ ] Adicionar seção "Acesso ao app" (URLs login/app/studio/minio)
- [ ] Commit: `docs: README com comandos WSL + troubleshooting`

### T5 — Script `dev:up` no package.json

**Por quê:** Comando único conveniente pra preflight (sobe containers + warm relay).

- [ ] Adicionar `"dev:up": "docker compose -f docker-compose.dev.yml up -d && docker exec ifp_postgres_dev pg_isready -U ifp -d ifp_connect"`
- [ ] Validar `pnpm dev:up` (de dentro do WSL) retorna `accepting connections`
- [ ] Commit: `chore: pnpm dev:up para boot containers + warmup`

### T6 — Atualizar memorias do projeto + index

- [ ] Marcar Plano 1 Foundation 12/12 done em [[project-ifp-connect]]
- [ ] Atualizar [[reference-ifp-dev-commands]] com `dev:up`
- [ ] (Não atualizar MEMORY.md desnecessariamente — links existentes seguem corretos)

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

_(adicionar timestamp + commit hash + observação a cada tarefa concluída)_
