#!/usr/bin/env bash
# After: vercel login && vercel link --yes --project rxdb-debugger
# Syncs Vercel project to monorepo-root build (matches root vercel.json).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .vercel/project.json ]]; then
  echo "Missing .vercel/project.json — run: vercel link --yes --project rxdb-debugger"
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
cat >"$BODY" <<'PATCH'
{
  "rootDirectory": null,
  "framework": null,
  "installCommand": "bun install",
  "buildCommand": "bun run build:libs && bun run --cwd examples/react build",
  "outputDirectory": "examples/react/dist"
}
PATCH

npx vercel@latest api "/v9/projects/${PROJECT_ID}${QUERY}" -X PATCH --input "$BODY"
echo "OK: Vercel project synced (repo root, bun, build:libs + Vite example)."
