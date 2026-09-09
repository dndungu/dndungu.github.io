#!/bin/bash
# Regenerate this machine's usage/<machine>.json and push it if it changed.
# Installed per machine via a LaunchAgent (see scripts/README.md).
set -euo pipefail

MACHINE="${1:?usage: claude_usage_sync.sh <machine-label>}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# GitHub Pages builds from main, not whatever happens to be checked out here.
# Never commit/push against another branch by accident.
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "main" ]; then
  echo "skipping: $REPO_DIR is on '$current_branch', not 'main'"
  exit 0
fi

python3 scripts/claude_usage_report.py --machine "$MACHINE"

if [ -z "$(git status --porcelain -- "usage/${MACHINE}.json")" ]; then
  exit 0
fi

git add "usage/${MACHINE}.json"
git commit -m "Update ${MACHINE} token usage" --quiet
git pull --rebase --quiet origin main
git push --quiet origin main
