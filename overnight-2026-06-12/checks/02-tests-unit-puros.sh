#!/usr/bin/env bash
# Roda SÓ os testes unitários puros/mock — exclui os 3 arquivos de integração
# que importam `db` real (@/lib/db) e ESCREVEM no Postgres dev persistente
# (porta 5433, banco do dono — trilho overnight proíbe):
#   - tests/unit/medico-agenda.test.ts
#   - tests/unit/painel-chamada.test.ts
#   - tests/unit/capacitacao-matricula-concorrencia.test.ts
# De propósito NÃO faz source do .env.local: sem DATABASE_URL, qualquer teste
# que tente tocar o banco falha em vez de gravar.
set -e
cd /mnt/c/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612
pnpm vitest run \
  --exclude "tests/unit/medico-agenda.test.ts" \
  --exclude "tests/unit/painel-chamada.test.ts" \
  --exclude "tests/unit/capacitacao-matricula-concorrencia.test.ts"
echo "TESTS_OK"
