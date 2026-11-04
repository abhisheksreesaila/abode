#!/usr/bin/env bash
# Run on the NEW machine (macOS or Linux) to make it addable from One Window -> Add a machine.
#
#   bash add-machine.sh            install a login service running T3 over Tailscale, print the pairing link
#   bash add-machine.sh --dry-run  print what it would do, change nothing
#
# T3_VERSION pins the server to the host's version (apps/server/package.json); override with env.
set -euo pipefail

T3_VERSION="${T3_VERSION:-0.1.5}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

log() { printf '[add-machine] %s\n' "$*"; }
die() { log "$*"; exit 1; }
run() {
  if ((DRY_RUN)); then log "would run: $*"; else "$@"; fi
}
# A missing prerequisite stops a real run; a dry run keeps going so it prints every action.
need() { log "$*"; ((DRY_RUN)) || exit 1; }

OS="$(uname -s)"
[[ "$OS" == "Darwin" || "$OS" == "Linux" ]] || die "Unsupported system: $OS"

# 1. Tailscale installed and signed in.
if ! command -v tailscale >/dev/null 2>&1; then
  if [[ "$OS" == "Darwin" ]]; then
    need "Tailscale is not installed. Install it from the App Store or: brew install --cask tailscale"
  else
    need "Tailscale is not installed. See https://tailscale.com/download"
  fi
elif ! tailscale status >/dev/null 2>&1; then
  need "Tailscale is installed but not signed in. Run: tailscale up (same account as your other machines)"
fi

# 2. Node 22 or newer.
if ! command -v node >/dev/null 2>&1; then
  need "Node is not installed. Install it with: brew install node (macOS) or mise use -g node@22"
else
  major="$(node -v | sed 's/^v//; s/\..*//')"
  if ((major < 22)); then
    need "Node $(node -v) is too old; T3 needs 22 or newer. Upgrade with: brew upgrade node, or mise use -g node@22"
  fi
fi

NPX="$(command -v npx || echo npx)"
SERVE=("$NPX" -y "t3@$T3_VERSION" serve --tailscale-serve --no-browser)
PAIR=("$NPX" -y "t3@$T3_VERSION" pair --tailscale)

# 3. Login service (idempotent: reinstalling replaces the old one).
install_launchd() {
  local plist="$HOME/Library/LaunchAgents/com.abode.t3.plist" arg
  log "installing launchd agent $plist"
  if ((DRY_RUN)); then
    log "would write $plist running: ${SERVE[*]}"
  else
    mkdir -p "$(dirname "$plist")"
    {
      printf '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict>\n'
      printf '<key>Label</key><string>com.abode.t3</string>\n<key>ProgramArguments</key><array>\n'
      for arg in "${SERVE[@]}"; do printf '<string>%s</string>\n' "$arg"; done
      printf '</array>\n<key>EnvironmentVariables</key><dict><key>PATH</key><string>%s</string></dict>\n' "$PATH"
      printf '<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><true/>\n'
      printf '<key>StandardOutPath</key><string>%s/Library/Logs/abode-t3.log</string>\n' "$HOME"
      printf '<key>StandardErrorPath</key><string>%s/Library/Logs/abode-t3.log</string>\n' "$HOME"
      printf '</dict></plist>\n'
    } >"$plist"
  fi
  run launchctl bootout "gui/$UID/com.abode.t3" 2>/dev/null || true
  run launchctl bootstrap "gui/$UID" "$plist"
}

install_systemd() {
  local unit="$HOME/.config/systemd/user/abode-t3.service"
  log "installing systemd user unit $unit"
  if ((DRY_RUN)); then
    log "would write $unit running: ${SERVE[*]}"
  else
    mkdir -p "$(dirname "$unit")"
    printf '[Unit]\nDescription=T3 over Tailscale (abode machine)\nAfter=network-online.target\n\n' >"$unit"
    printf '[Service]\nEnvironment=PATH=%s\nExecStart=%s\nRestart=always\nRestartSec=3\n\n' "$PATH" "${SERVE[*]}" >>"$unit"
    printf '[Install]\nWantedBy=default.target\n' >>"$unit"
  fi
  run systemctl --user daemon-reload
  run systemctl --user enable abode-t3.service
  run systemctl --user restart abode-t3.service
}

if [[ "$OS" == "Darwin" ]]; then install_launchd; else install_systemd; fi

# 4. Wait for the server, then print the one-time pairing link.
if ((DRY_RUN)); then
  log "would wait up to 30s for the server, then run: ${PAIR[*]}"
  log "dry run done"
  exit 0
fi
log "waiting for T3 to start (up to 30s)"
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if "${PAIR[@]}"; then
    log "Paste the link above in One Window -> Add a machine. It is single-use."
    exit 0
  fi
  sleep 2
done
die "T3 did not come up. Check the service log (macOS: ~/Library/Logs/abode-t3.log, Linux: journalctl --user -u abode-t3)."
