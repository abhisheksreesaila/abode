#!/usr/bin/env bash
# Merges an upstream T3 Code nightly into the current abode branch.
#
#   scripts/abode/sync-upstream.sh           newest *-nightly.* tag
#   scripts/abode/sync-upstream.sh <tag>     a specific tag or commit
set -euo pipefail

log() { printf '[abode-sync] %s\n' "$*"; }

if [[ -n "$(git status --porcelain)" ]]; then
  log "working tree is not clean; commit or stash first"; exit 1
fi

git fetch upstream --tags --prune --quiet
# for-each-ref --count avoids `| head -1`, which dies of SIGPIPE under pipefail once there are many tags.
target="${1:-$(git for-each-ref --count=1 --sort=-creatordate --format='%(refname:short)' 'refs/tags/*-nightly.*')}"
current="$(git describe --tags --match '*-nightly.*' --abbrev=0 HEAD)"
log "current base: $current"
log "target:       $target"
if git merge-base --is-ancestor "$target" HEAD; then log "already contains $target"; exit 0; fi

protocol() { git show "$1:packages/contracts/src/environment.ts" | sed -n 's/.*ORCHESTRATION_PROTOCOL_VERSION = \([0-9]*\).*/\1/p'; }
old_p="$(protocol HEAD)"; new_p="$(protocol "$target")"
if [[ "$old_p" != "$new_p" ]]; then
  log "WARNING: orchestration protocol changes $old_p -> $new_p. The phone app must be on protocol $new_p too."
fi

log "upstream commits coming in: $(git rev-list --count HEAD.."$target")"
if ! git merge --no-ff --no-edit -m "Merge upstream $target into abode" "$target"; then
  log "conflicts (should only be abode hook lines; see docs/upstream-sync.md):"
  git diff --name-only --diff-filter=U | sed 's/^/  /'
  log "resolve, then: git commit && scripts/abode/hook-report.sh"
  exit 1
fi

scripts/abode/hook-report.sh || true
log "merged. Next: vp i, then cd apps/web && vp test run src/abode, typecheck, check the app, then update the host."
