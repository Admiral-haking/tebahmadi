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
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Server has tracked changes; deployment stopped" >&2
  exit 11
fi
git checkout "$DEPLOY_BRANCH"
git merge --ff-only "origin/$DEPLOY_BRANCH"
pnpm install --frozen-lockfile
pnpm db:backup:local
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
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1:3210/api/health; then
    break
  fi
  if [ "$attempt" = "30" ]; then
    echo "Application did not become healthy within 30 seconds" >&2
    pm2 logs tebahmadi --lines 40 --nostream >&2 || true
    exit 13
  fi
  sleep 1
done
printf '\nDeployment completed at %s\n' "$(date -Is)"
REMOTE
