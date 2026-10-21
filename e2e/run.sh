#!/usr/bin/env bash
# Runs the end-to-end specs against a local build of the app. See e2e/README.md.
#   e2e/run.sh                 all specs
#   e2e/run.sh legal zones     only these specs (names of files in e2e/specs/, without .cjs)
#   E2E_SKIP_BUILD=1 e2e/run.sh legal    reuse the existing .next build
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
# shellcheck source=lib/env.sh
source e2e/lib/env.sh
mkdir -p "$E2E_OUT"

SPECS=("$@")
[ ${#SPECS[@]} -eq 0 ] && SPECS=(legal analytics zones)

cleanup() {
  for f in "$E2E_OUT"/next.pid "$E2E_OUT"/mock.pid; do
    [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; rm -f "$f"
  done
}
trap cleanup EXIT

bash e2e/lib/setup-db.sh || exit 1

if [ "${E2E_SKIP_BUILD:-0}" != "1" ]; then
  echo "== build =="
  rm -rf .next
  npm run build > "$E2E_OUT/build.log" 2>&1 || { tail -30 "$E2E_OUT/build.log"; echo "build en échec"; exit 1; }
fi

echo "== services locaux =="
node e2e/lib/mock-services.cjs > "$E2E_OUT/mock.log" 2>&1 &
echo $! > "$E2E_OUT/mock.pid"
NODE_OPTIONS="--require $ROOT/e2e/lib/stub-providers.cjs" npx next start -p "$E2E_PORT" > "$E2E_OUT/server.log" 2>&1 &
echo $! > "$E2E_OUT/next.pid"
for _ in $(seq 1 40); do
  curl -s -o /dev/null "http://localhost:$E2E_PORT/robots.txt" && break
  sleep 1
done
curl -s -o /dev/null "http://localhost:$E2E_PORT/" || { echo "le serveur ne répond pas (voir $E2E_OUT/server.log)"; exit 1; }

RC=0
for spec in "${SPECS[@]}"; do
  echo; echo "== spec : $spec =="
  node "e2e/specs/$spec.cjs" || RC=1
done

echo; [ $RC -eq 0 ] && echo "TOUS LES SPECS PASSENT" || echo "AU MOINS UN SPEC EN ÉCHEC"
exit $RC
