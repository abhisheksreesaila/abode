#!/bin/bash
# abode: Omarchy theme-set hook. Omarchy publishes its palette to the stock T3 Code install
# (~/.t3) only; this publishes the same file to abode's server, where it shows up as the
# "Omarchy" theme in Settings › Appearance and follows every `omarchy-theme-set`.
#
# Install: scripts/abode/omarchy/install.sh (copies this into ~/.config/omarchy/hooks/theme-set.d/).
# omarchy-theme-set-t3code skips silently when abode's state dir doesn't exist.
T3CODE_HOME="${ABODE_ROOT:-$HOME/.abode}/home" omarchy-theme-set-t3code
