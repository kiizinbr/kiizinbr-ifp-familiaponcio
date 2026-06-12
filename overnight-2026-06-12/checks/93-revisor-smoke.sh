#!/usr/bin/env bash
# REVISOR — smoke runtime: next dev em porta efêmera 3007, curl /, kill garantido.
# (next start é impossível: o build aborta no prerender pré-existente, sem BUILD_ID.)
set -e
cd /mnt/c/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612
set -a
source /mnt/c/Users/Administrador/ifp-connect/.env.local
set +a

# next start já provado impossível (500 por prerender-manifest.json ausente —
# build aborta no prerender pré-existente). Smoke em modo dev.
pnpm exec next dev -p 3007 > /tmp/revisor-smoke-server.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; sleep 1; pkill -f "next dev" 2>/dev/null; true' EXIT

ok=""
for i in $(seq 1 60); do
  if curl -s -o /tmp/revisor-smoke.html -w "%{http_code}" -L http://localhost:3007/ | grep -qE "^(200|3..)$"; then
    ok=1
    break
  fi
  sleep 2
done
[ -n "$ok" ] || { echo "SMOKE_FALHOU: servidor não respondeu"; tail -20 /tmp/revisor-smoke-server.log; exit 1; }

echo "=== HTML (atributos do <html> + presença das camadas) ==="
grep -o '<html[^>]*>' /tmp/revisor-smoke.html | head -1
grep -c 'font-jost\|__variable' /tmp/revisor-smoke.html || true
echo "=== curl /login?u=medico (tema CASA num subtree, se a rota existir) ==="
curl -s -o /tmp/revisor-smoke-login.html -w "HTTP=%{http_code}\n" -L "http://localhost:3007/login" || true
grep -o 'data-theme="[a-z]*"' /tmp/revisor-smoke-login.html | sort | uniq -c || true
echo "REVISOR_SMOKE_OK"
