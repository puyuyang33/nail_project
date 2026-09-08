#!/usr/bin/env sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

run() {
  echo "+ $*"
  "$@"
}

require_command node
require_command npm

if ! node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit((major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 24 ? 0 : 1)"; then
  echo "Use a Prisma 7-supported Node.js release: 20.19+, 22.12+, or 24+." >&2
  exit 1
fi

if [ ! -f .env ]; then
  umask 077
  DB_PASSWORD=$(node -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('base64url'))")
  AUTH_SECRET=$(node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))")
  CRON_SECRET=$(node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))")

  cat >.env <<EOF
# Generated for local development by scripts/setup.sh.
POSTGRES_DB=lunaria
POSTGRES_USER=lunaria
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_PORT=5432
DATABASE_URL=postgresql://lunaria:$DB_PASSWORD@localhost:5432/lunaria?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=$AUTH_SECRET
# AUTH_GOOGLE_ID=replace-with-google-oauth-client-id
# AUTH_GOOGLE_SECRET=replace-with-google-oauth-client-secret
# AUTH_GOOGLE_ADMIN_EMAILS=owner@example.com
AUTH_CREDENTIALS_ENABLED=false
AUTH_PASSWORD_REGISTRATION_ENABLED=false
# APPOINTMENT_NOTIFICATION_EMAILS=owner@example.com
CRON_SECRET=$CRON_SECRET
BUSINESS_TIMEZONE=America/Chicago
STORE_CURRENCY=USD
APPOINTMENT_DEPOSITS_ENABLED=false
EOF
  echo "Created a gitignored .env with random local secrets."
else
  echo "Using existing .env; it was not modified."
fi

if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  run npm ci
fi

if [ "${SKIP_DOCKER:-0}" != "1" ]; then
  require_command docker
  run docker compose up -d postgres

  attempt=0
  until docker compose exec -T postgres sh -c \
    'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
      echo "PostgreSQL did not become ready. Run: docker compose logs postgres" >&2
      exit 1
    fi
    sleep 1
  done
  echo "PostgreSQL is ready."
fi

run npm run db:generate

if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
  run npm run db:migrate:deploy
fi

if [ "${RUN_SEED:-0}" = "1" ]; then
  if [ -z "${SEED_ADMIN_EMAIL:-}" ] || [ -z "${SEED_ADMIN_PASSWORD:-}" ]; then
    echo "RUN_SEED=1 requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD." >&2
    exit 1
  fi
  run npm run db:seed
else
  echo "Seed skipped. Set RUN_SEED=1 plus SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to enable it."
fi

echo "Setup complete. Start the app with: npm run dev"
