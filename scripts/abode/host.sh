#!/usr/bin/env bash
# abode host: runs a pinned build of abode as a systemd user service.
#
#   scripts/abode/host.sh install          seed ~/.abode, build origin/main, install and start the service
#   scripts/abode/host.sh update [ref]     build <ref> (default origin/main), switch, health-check, roll back on failure
#   scripts/abode/host.sh status           show the running release and service state
#   scripts/abode/host.sh rollback         switch back to the previous release
#
# `update` and `rollback` restart the server that agents run under, so they re-launch
# themselves as a transient systemd unit and survive the restart. Follow progress with
# `journalctl --user -u abode-update -f`.
set -euo pipefail

ROOT="${ABODE_ROOT:-$HOME/.abode}"
REPO="${ABODE_REPO:-$(cd "$(dirname "$0")/../.." && pwd)}"
PORT="${ABODE_PORT:-3773}"
NODE="${ABODE_NODE:-$HOME/.local/share/vite-plus/js_runtime/node/24.21.0/bin/node}"
VP_ENV="$HOME/.config/vite-plus/env"
UNIT=abode.service
KEEP=3

log() { printf '[abode] %s\n' "$*"; }

vp_run() { (cd "$1" && shift && . "$VP_ENV" && "$@"); }

build_release() {
  local ref="$1" sha rel
  git -C "$REPO" fetch -q origin
  sha="$(git -C "$REPO" rev-parse --short=10 "$ref^{commit}")"
  rel="$ROOT/releases/$sha"
  if [[ -f "$rel/.abode-built" ]]; then
    log "release $sha already built" >&2
  else
    if [[ -d "$rel" ]]; then git -C "$REPO" worktree remove --force "$rel"; fi
    log "building $sha into $rel" >&2
    git -C "$REPO" worktree add -q --detach "$rel" "$sha"
    vp_run "$rel" vp i >&2
    vp_run "$rel" vp run --filter @t3tools/web build >&2
    vp_run "$rel" vp run --filter t3 build:bundle >&2
    touch "$rel/.abode-built"
  fi
  printf '%s\n' "$rel"
}

switch_to() {
  ln -sfn "$1" "$ROOT/current.next"
  mv -T "$ROOT/current.next" "$ROOT/current"
}

healthy() {
  local code
  for _ in $(seq 1 90); do
    if systemctl --user is-failed --quiet "$UNIT"; then return 1; fi
    code="$(curl -s --connect-timeout 2 --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" || true)"
    if [[ "$code" == 200 ]]; then return 0; fi
    sleep 1
  done
  return 1
}

prune() {
  local current previous
  current="$(readlink -f "$ROOT/current" || true)"
  previous="$(readlink -f "$ROOT/previous" || true)"
  ls -1dt "$ROOT"/releases/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r dir; do
    dir="${dir%/}"
    if [[ "$dir" != "$current" && "$dir" != "$previous" ]]; then
      log "pruning $dir"
      git -C "$REPO" worktree remove --force "$dir" || true
    fi
  done
}

write_unit() {
  mkdir -p "$HOME/.config/systemd/user"
  cat >"$HOME/.config/systemd/user/$UNIT" <<EOF
[Unit]
Description=abode (personal T3 Code fork) server
After=network-online.target

[Service]
Type=simple
WorkingDirectory=%h
Environment=PATH=$(dirname "$NODE"):$HOME/.local/bin:$HOME/.local/share/mise/shims:/usr/local/bin:/usr/bin:/bin
ExecStart=$NODE $ROOT/current/apps/server/dist/bin.mjs serve --base-dir $ROOT/home --port $PORT
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
}

seed_home() {
  local src="$HOME/.t3/userdata" dst="$ROOT/home/userdata"
  if [[ -f "$dst/state.sqlite" ]]; then log "home already seeded"; return; fi
  mkdir -p "$dst"
  if [[ -f "$src/state.sqlite" ]]; then
    log "snapshotting ~/.t3/userdata/state.sqlite (VACUUM INTO, read-only)"
    "$NODE" -e '
      const { DatabaseSync } = require("node:sqlite");
      const db = new DatabaseSync(process.argv[1], { readOnly: true });
      db.exec(`VACUUM INTO ${JSON.stringify(process.argv[2]).replace(/"/g, "\x27")}`);
    ' "$src/state.sqlite" "$dst/state.sqlite"
    for item in secrets keybindings.json themes attachments environment-id; do
      if [[ -e "$src/$item" ]]; then cp -a "$src/$item" "$dst/"; fi
    done
  fi
}

cmd_install() {
  mkdir -p "$ROOT/releases"
  seed_home
  local rel; rel="$(build_release "${1:-origin/main}")"
  switch_to "$rel"
  write_unit
  systemctl --user enable --now "$UNIT"
  if healthy; then log "abode is up on http://127.0.0.1:$PORT ($(basename "$rel"))"; else log "abode failed to start; see journalctl --user -u abode"; exit 1; fi
}

cmd_update_inner() {
  local rel prev
  rel="$(build_release "${1:-origin/main}")"
  prev="$(readlink -f "$ROOT/current" || true)"
  if [[ "$rel" == "$prev" ]]; then log "already running $(basename "$rel")"; return; fi
  if [[ -n "$prev" ]]; then ln -sfn "$prev" "$ROOT/previous"; fi
  switch_to "$rel"
  systemctl --user restart "$UNIT"
  if healthy; then
    log "updated to $(basename "$rel")"
    prune
    return
  fi
  log "$(basename "$rel") failed its health check; rolling back to $(basename "$prev")"
  switch_to "$prev"
  systemctl --user restart "$UNIT"
  healthy && log "rolled back" || log "rollback also unhealthy; check journalctl --user -u abode"
  exit 1
}

cmd_rollback_inner() {
  local prev; prev="$(readlink -f "$ROOT/previous" || true)"
  [[ -n "$prev" && -d "$prev" ]] || { log "no previous release"; exit 1; }
  ln -sfn "$(readlink -f "$ROOT/current")" "$ROOT/previous"
  switch_to "$prev"
  systemctl --user restart "$UNIT"
  healthy && log "rolled back to $(basename "$prev")"
}

detach() {
  # Run outside the abode service's cgroup so restarting abode doesn't kill this script.
  systemctl --user reset-failed abode-update.service 2>/dev/null || true
  systemd-run --user --collect --unit=abode-update --setenv=ABODE_REPO="$REPO" \
    "$(readlink -f "$0")" "$@"
  log "started in the background; follow with: journalctl --user -u abode-update -f"
}

case "${1:-}" in
  install) shift; cmd_install "$@" ;;
  update) shift; detach __update "$@" ;;
  rollback) detach __rollback ;;
  __update) shift; cmd_update_inner "$@" ;;
  __rollback) cmd_rollback_inner ;;
  status)
    log "current: $(basename "$(readlink -f "$ROOT/current" 2>/dev/null)" 2>/dev/null || echo none)"
    log "previous: $(basename "$(readlink -f "$ROOT/previous" 2>/dev/null)" 2>/dev/null || echo none)"
    systemctl --user --no-pager status "$UNIT" | head -5 || true ;;
  *) sed -n '2,12p' "$0"; exit 2 ;;
esac
