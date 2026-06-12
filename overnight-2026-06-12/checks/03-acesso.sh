#!/usr/bin/env bash
# Item 2 do port CASA — rota /acesso + login tematizado: verificação completa.
# v2: contrato data-unit (CLAUDE.md do projeto) + build tolerante SÓ à falha
# pré-existente de prerender do /_global-error (existe em origin/main — ver
# 91-revisor-build.sh) + smoke em next dev (next start é impossível sem BUILD_ID).
set -e
cd /mnt/c/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612

ARQUIVOS_ITEM=(
  "src/app/acesso/page.tsx"
  "src/app/(auth)/login/page.tsx"
  "src/app/(auth)/login/login-form.tsx"
  "src/app/layout.tsx"
  "src/styles/casa-tokens.css"
  "src/components/tema-unidade.tsx"
  "src/lib/tema-casa.ts"
  "tests/unit/tema-casa.test.ts"
)

echo "=== format (só os arquivos do item) ==="
pnpm prettier --write "${ARQUIVOS_ITEM[@]}"
pnpm prettier --check "${ARQUIVOS_ITEM[@]}"

echo "=== typecheck ==="
pnpm typecheck

echo "=== lint ==="
pnpm lint

echo "=== testes unitários puros (tema-casa) ==="
pnpm vitest run tests/unit/tema-casa.test.ts

echo "=== build (tolerante SÓ ao prerender pré-existente do /_global-error) ==="
set -a
source /mnt/c/Users/Administrador/ifp-connect/.env.local
set +a
BUILD_LOG=/tmp/ifp-acesso-build.log
if pnpm build >"$BUILD_LOG" 2>&1; then
  echo "build 100% verde"
else
  grep -q "Compiled successfully" "$BUILD_LOG" || {
    echo "BUILD_FALHOU: compilação quebrou (não é o prerender flaky pré-existente)"
    tail -40 "$BUILD_LOG"
    exit 1
  }
  # Race FLAKY pré-existente da main (provado por A/B: origin/main também falha,
  # página varia entre builds — _global-error, /inicio — sempre o mesmo
  # TypeError useContext null). Tolerar SÓ essa assinatura e NUNCA nas páginas
  # novas deste item (/acesso, /login).
  grep -q "Cannot read properties of null (reading 'useContext')" "$BUILD_LOG" || {
    echo "BUILD_FALHOU: prerender falhou com erro DIFERENTE do race pré-existente"
    tail -40 "$BUILD_LOG"
    exit 1
  }
  PAGINAS=$(grep -oE 'Error occurred prerendering page "[^"]+"' "$BUILD_LOG" | grep -oE '"[^"]+"' | tr -d '"' | sort -u)
  for pag in $PAGINAS; do
    case "$pag" in
    /acesso* | /login*)
      echo "BUILD_FALHOU: prerender quebrou em página NOVA do item: $pag"
      tail -40 "$BUILD_LOG"
      exit 1
      ;;
    esac
  done
  echo "build: Compiled successfully; falha só o prerender flaky pré-existente (useContext null) em: $PAGINAS"
fi

echo "=== smoke: next dev em porta livre → /acesso e /login ==="
PORT=""
for p in 3002 3003 3004 3005; do
  if ! curl -s -o /dev/null --max-time 1 "http://localhost:$p"; then
    PORT=$p
    break
  fi
done
[ -n "$PORT" ] || { echo "SMOKE_FALHOU: nenhuma porta livre entre 3002-3005"; exit 1; }
echo "porta escolhida: $PORT"

pnpm exec next dev -p "$PORT" >/tmp/ifp-acesso-smoke.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT

pronto=0
for i in $(seq 1 90); do
  if curl -sf -o /dev/null "http://localhost:$PORT/acesso"; then
    pronto=1
    break
  fi
  sleep 2
done
if [ "$pronto" != "1" ]; then
  echo "SMOKE_FALHOU: servidor não respondeu em 180s"
  tail -30 /tmp/ifp-acesso-smoke.log
  exit 1
fi

ACESSO=$(curl -sf "http://localhost:$PORT/acesso")
echo "$ACESSO" | grep -q 'data-unit="medico"' || { echo 'SMOKE_FALHOU: /acesso sem data-unit="medico"'; exit 1; }
echo "$ACESSO" | grep -q 'data-unit="poncio"' || { echo 'SMOKE_FALHOU: /acesso sem data-unit="poncio" (card transversal)'; exit 1; }
echo "$ACESSO" | grep -q '/login?unidade=capacitacao' || { echo 'SMOKE_FALHOU: /acesso sem link /login?unidade=capacitacao'; exit 1; }
echo "$ACESSO" | grep -qi 'jost' && { echo 'SMOKE_FALHOU: Jost vazou no HTML (regra: nunca tipografia)'; exit 1; }
echo "OK /acesso: 200 + data-unit por card + links pro login tematizado + sem Jost"

LOGIN_TEMA=$(curl -sf "http://localhost:$PORT/login?unidade=medico")
echo "$LOGIN_TEMA" | grep -q 'data-unit="medico"' || { echo 'SMOKE_FALHOU: /login?unidade=medico sem data-unit'; exit 1; }
echo "$LOGIN_TEMA" | grep -q 'Centro M' || { echo 'SMOKE_FALHOU: /login?unidade=medico sem o nome do salão'; exit 1; }
echo "OK /login?unidade=medico: 200 + data-unit + nome do salão"

LOGIN_NEUTRO=$(curl -sf "http://localhost:$PORT/login")
echo "$LOGIN_NEUTRO" | grep -q 'data-unit="medico"' && { echo 'SMOKE_FALHOU: /login neutro veio tematizado'; exit 1; }
echo "$LOGIN_NEUTRO" | grep -q 'bg-slate-50' || { echo 'SMOKE_FALHOU: /login neutro perdeu o fundo original bg-slate-50'; exit 1; }
LOGIN_INVALIDO=$(curl -sf "http://localhost:$PORT/login?unidade=naoexiste")
echo "$LOGIN_INVALIDO" | grep -q 'data-unit="naoexiste"' && { echo 'SMOKE_FALHOU: slug inválido vazou pro data-unit'; exit 1; }
echo "OK /login neutro + slug inválido: comportamento atual preservado"

kill $SRV 2>/dev/null || true
trap - EXIT
echo "ACESSO_OK"
