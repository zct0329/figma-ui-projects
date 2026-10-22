#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
npm test
if ! git diff --quiet HEAD -- dist; then
  echo 'Commit dist changes before publishing.' >&2
  exit 1
fi
git fetch origin
pages_tree="$(git rev-parse HEAD:dist)"
if git show-ref --verify --quiet refs/remotes/origin/gh-pages; then
  pages_parent="$(git rev-parse refs/remotes/origin/gh-pages)"
  pages_commit="$(git commit-tree "$pages_tree" -p "$pages_parent" -m "Publish inventory simulator")"
else
  pages_commit="$(git commit-tree "$pages_tree" -m "Publish inventory simulator")"
fi
git push origin "$pages_commit:refs/heads/gh-pages"
