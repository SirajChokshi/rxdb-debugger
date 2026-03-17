#!/usr/bin/env bash
# After: vercel login && vercel link --yes --scope <team-or-user> --project rxdb-debugger
# Clears Vercel "Root Directory" so the repo-root vercel.json drives the build.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .vercel/project.json ]]; then
  echo "Missing .vercel/project.json — run from repo root:"
  echo "  vercel link --yes --project rxdb-debugger --scope siraj"
  exit 1
fi

PROJECT_ID=$(node -p "require('./.vercel/project.json').projectId")
ORG_ID=$(node -p "require('./.vercel/project.json').orgId")

QUERY=""
if [[ "$ORG_ID" == team_* ]]; then
  QUERY="?teamId=${ORG_ID}"
fi

BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT
printf '%s' '{"rootDirectory":null}' >"$BODY"

npx vercel@latest api "/v9/projects/${PROJECT_ID}${QUERY}" -X PATCH --input "$BODY"
echo "OK: root directory is now the repository root (redeploy or push to refresh preview)."
