#!/usr/bin/env bash
# Run on the NEW machine (macOS or Linux) to make it addable from One Window -> Add a machine.
#
#   bash add-machine.sh            install a login service running T3 over Tailscale, print the pairing link
#   bash add-machine.sh --dry-run  print what it would do, change nothing
#
# T3_VERSION must track apps/server/package.json (the host's server version); override with env.
# The service's stdout goes to /dev/null: `serve` prints an admin pairing URL there on every start.
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
if [[ "$OS" == "Darwin" ]]; then ERR_LOG="$HOME/Library/Logs/abode-t3.log"; else ERR_LOG="$HOME/.local/state/abode-t3.log"; fi

prepare_log() {
  if ((DRY_RUN)); then log "would create $ERR_LOG (mode 600, stderr only)"; return; fi
  mkdir -p "$(dirname "$ERR_LOG")"
  (umask 077; : >>"$ERR_LOG")
}

xml_escape() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

# systemd: double-quote, escape \ and ", and double % and $ so specifiers and variables stay literal.
sd_quote() { printf '"%s"' "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/%/%%/g' -e 's/\$/$$/g')"; }

# 3. Login service (idempotent: re-running restarts the existing one).
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
      for arg in "${SERVE[@]}"; do printf '<string>%s</string>\n' "$(xml_escape "$arg")"; done
      printf '</array>\n<key>EnvironmentVariables</key><dict><key>PATH</key><string>%s</string></dict>\n' "$(xml_escape "$PATH")"
      printf '<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><true/>\n'
      printf '<key>StandardOutPath</key><string>/dev/null</string>\n'
      printf '<key>StandardErrorPath</key><string>%s</string>\n' "$(xml_escape "$ERR_LOG")"
      printf '</dict></plist>\n'
    } >"$plist"
  fi
  if ((DRY_RUN)); then
    log "would run: launchctl kickstart -k gui/$UID/com.abode.t3 (or bootstrap if not loaded)"
  elif launchctl print "gui/$UID/com.abode.t3" >/dev/null 2>&1; then
    launchctl kickstart -k "gui/$UID/com.abode.t3"
  else
    launchctl bootstrap "gui/$UID" "$plist"
  fi
}

install_systemd() {
  local unit="$HOME/.config/systemd/user/abode-t3.service" exec_line="" arg
  for arg in "${SERVE[@]}"; do exec_line+="$(sd_quote "$arg") "; done
  log "installing systemd user unit $unit"
  if ((DRY_RUN)); then
    log "would write $unit running: ${SERVE[*]}"
  else
    mkdir -p "$(dirname "$unit")"
    printf '[Unit]\nDescription=T3 over Tailscale (abode machine)\nAfter=network-online.target\n\n' >"$unit"
    printf '[Service]\nEnvironment=%s\nExecStart=%s\n' "$(sd_quote "PATH=$PATH")" "${exec_line% }" >>"$unit"
    printf 'StandardOutput=null\nStandardError=append:%s\nRestart=always\nRestartSec=3\n\n' "$ERR_LOG" >>"$unit"
    printf '[Install]\nWantedBy=default.target\n' >>"$unit"
  fi
  run systemctl --user daemon-reload
  run systemctl --user enable abode-t3.service
  run systemctl --user restart abode-t3.service
  if [[ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || true)" != "yes" ]]; then
    log "Headless box? Run once so T3 keeps running after you log out: sudo loginctl enable-linger $USER"
  fi
}

prepare_log
if [[ "$OS" == "Darwin" ]]; then install_launchd; else install_systemd; fi

# 4. Wait for the server, then print the one-time pairing link.
if ((DRY_RUN)); then
  log "would wait up to 30s for the server, then run: ${PAIR[*]}"
  log "dry run done"
  exit 0
fi
log "waiting for T3 to start (up to 30s)"
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  # </dev/null: under `curl | bash` stdin is the script itself, which a child must not read.
  if "${PAIR[@]}" </dev/null; then
    log "Paste the link above in One Window -> Add a machine. It is single-use."
    exit 0
  fi
  sleep 2
done
die "T3 did not come up. Check the error log: $ERR_LOG"
