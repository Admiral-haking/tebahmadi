#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-62.3.41.87}"
DEPLOY_USER="${DEPLOY_USER:-ali}"
DEPLOY_PATH="${DEPLOY_PATH:-/home/ali/tebahmadi}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "DEPLOY_PATH='${DEPLOY_PATH}' DEPLOY_BRANCH='${DEPLOY_BRANCH}' bash -s" <<'REMOTE'
set -Eeuo pipefail
cd "$DEPLOY_PATH"
git fetch origin "$DEPLOY_BRANCH"
git checkout --force "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm build
if [ ! -f .env.server ]; then
  echo "Missing $DEPLOY_PATH/.env.server; refusing to restart production" >&2
  exit 12
fi
set -a
. ./.env.server
set +a
pm2 restart tebahmadi --update-env
pm2 save
curl --fail --silent --show-error http://127.0.0.1:3210/api/health
printf '\nDeployment completed at %s\n' "$(date -Is)"
REMOTE
