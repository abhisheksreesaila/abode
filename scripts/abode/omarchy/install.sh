#!/usr/bin/env bash
# Installs the abode Omarchy theme hook and publishes the current Omarchy theme once.
set -euo pipefail
command -v omarchy-theme-set-t3code >/dev/null || { echo "Omarchy not found; nothing to install."; exit 0; }
hooks="$HOME/.config/omarchy/hooks/theme-set.d"
mkdir -p "$hooks"
cp "$(dirname "$0")/theme-set-abode.sh" "$hooks/abode"
bash "$hooks/abode"
echo "Installed $hooks/abode. abode now follows Omarchy themes (pick \"Omarchy\" in Settings › Appearance)."
