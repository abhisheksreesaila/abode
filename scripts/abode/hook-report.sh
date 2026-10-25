#!/usr/bin/env bash
# Lists every upstream file abode changed since the upstream nightly it is based on,
# and fails if the total changed lines go over the hook budget (docs/upstream-sync.md).
#
#   scripts/abode/hook-report.sh            report against the newest nightly tag merged into HEAD
#   scripts/abode/hook-report.sh <base>     report against an explicit base
set -euo pipefail

BUDGET="${ABODE_HOOK_BUDGET:-400}"
base="${1:-$(git describe --tags --match '*-nightly.*' --abbrev=0 HEAD)}"

# abode-owned paths: changes here are not hooks.
own=(
  ':!apps/web/src/abode' ':!apps/server/src/abode' ':!packages/contracts/src/abode*'
  ':!scripts/abode' ':!apps/web/scripts/abode' ':!apps/server/scripts/abode' ':!docs/brief.md' ':!docs/briefs' ':!docs/plan.md' ':!docs/lessons.md'
  ':!docs/design' ':!design' ':!docs/research' ':!docs/upstream-sync.md' ':!CONTEXT.md' ':!pnpm-lock.yaml'
)

echo "abode hooks vs $base"
stats="$(git diff --numstat "$base" HEAD -- . "${own[@]}")"
if [[ -z "$stats" ]]; then echo "  no upstream files changed"; exit 0; fi
total=0
while read -r add del file; do
  [[ "$add" == "-" ]] && add=0 && del=0
  n=$((add + del)); total=$((total + n))
  printf '  %5d  %s\n' "$n" "$file"
done <<<"$stats"
echo "  total $total / budget $BUDGET"
if ((total > BUDGET)); then
  echo "over budget: move code into apps/web/src/abode/ and keep upstream edits to small marked hooks" >&2
  exit 1
fi
