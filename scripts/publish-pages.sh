#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
npm test
if ! git diff --quiet HEAD -- dist; then
  echo 'Commit dist changes before publishing.' >&2
  exit 1
fi
pages_remote="$(git ls-remote --heads origin refs/heads/gh-pages)"
if [[ -n "$pages_remote" ]]; then
  git fetch origin refs/heads/gh-pages:refs/remotes/origin/gh-pages
fi
pages_tree="$(git rev-parse HEAD:dist)"
if git show-ref --verify --quiet refs/remotes/origin/gh-pages; then
  pages_parent="$(git rev-parse refs/remotes/origin/gh-pages)"
  if [[ "$(git rev-parse "$pages_parent^{tree}")" == "$pages_tree" ]]; then
    echo "GitHub Pages branch already matches dist."
    exit 0
  fi
  pages_commit="$(git commit-tree "$pages_tree" -p "$pages_parent" -m "Publish inventory simulator")"
else
  pages_commit="$(git commit-tree "$pages_tree" -m "Publish inventory simulator")"
fi
git push origin "$pages_commit:refs/heads/gh-pages"
