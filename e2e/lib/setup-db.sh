#!/usr/bin/env bash
# Creates a fresh, empty LOCAL database (akani_e2e) for the e2e runs. The app
# creates its own tables and sample products on first start.
# Needs a local PostgreSQL. As root it uses the "postgres" system user; otherwise
# set E2E_ADMIN_URL to an admin connection (e.g. postgres://postgres@localhost/postgres).
set -euo pipefail

if ! pg_isready -q 2>/dev/null; then
  (pg_lsclusters 2>/dev/null | awk 'NR==2{print $1, $2}' | xargs -r -n2 pg_ctlcluster start) || service postgresql start || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do pg_isready -q && break; sleep 1; done
fi
pg_isready -q || { echo "PostgreSQL ne répond pas (voir e2e/README.md)"; exit 1; }

SQL=$(cat <<'SQLEND'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'akani_e2e' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS akani_e2e;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'akani') THEN
    CREATE ROLE akani LOGIN PASSWORD 'local';
  END IF;
END $$;
CREATE DATABASE akani_e2e OWNER akani;
SQLEND
)

if [ -n "${E2E_ADMIN_URL:-}" ]; then
  echo "$SQL" | psql "$E2E_ADMIN_URL" -q -v ON_ERROR_STOP=1 >/dev/null
elif [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  echo "$SQL" | su postgres -c "psql -q -v ON_ERROR_STOP=1" >/dev/null
else
  echo "$SQL" | psql -q -v ON_ERROR_STOP=1 postgres >/dev/null
fi
echo "base de test locale prête (akani_e2e)"
