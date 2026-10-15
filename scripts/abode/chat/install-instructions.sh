#!/usr/bin/env bash
# Adds abode's instructions for agents as marked blocks in their global instruction files.
# Running it again changes nothing.
#
#   cards    Claude and Codex mark the parts of their answers that need you, so abode's chat
#            shows them as cards. Goes in ~/.claude/CLAUDE.md and ~/.codex/AGENTS.md.
#   browser  Claude shows pages (artifacts, previews) in T3 Code's browser next to the chat
#            instead of the system browser. Goes in ~/.claude/CLAUDE.md only: Codex already
#            gets T3 Code's browser instructions from upstream.
#
#   scripts/abode/chat/install-instructions.sh <cards|browser>            add (or refresh)
#   scripts/abode/chat/install-instructions.sh <cards|browser> --remove   take it out again
set -euo pipefail

CLAUDE_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/CLAUDE.md"
CODEX_FILE="${CODEX_HOME:-$HOME/.codex}/AGENTS.md"

case "${1:-}" in
  cards)
    targets=("$CLAUDE_FILE" "$CODEX_FILE")
    read -r -d '' BODY <<'MD' || true
## Cards (abode chat)

When an answer has something I need to see, mark it with a callout so my chat can show it as a card:

- `> [!QUESTION]` for a decision you need from me. Put the choices as a list inside it, first one recommended:
  `> [!QUESTION]` / `> Run the full benchmark now?` / `> - Go now` / `> - Tonight`
- `> [!WARNING]` for a risk, a failure or something that surprised you.
- `> [!TICKETS]` for open work, one `- ID title` per line (`- F-022 GPU precision`).
- `> [!DONE]` for what you finished. A short title may follow the marker: `> [!DONE] Tests green`.
- `> [!INFO]` for a fact worth keeping.

Use them only for those moments; ordinary explanation stays plain text. End with at most one question card.
MD
    ;;
  browser)
    targets=("$CLAUDE_FILE")
    read -r -d '' BODY <<'MD' || true
## Showing me pages (abode / T3 Code)

When you run inside T3 Code (the `t3-code` MCP server offers `preview_open`), open any page you want me to look at, such as a published claude.ai artifact or a local dev server, with `preview_open` and its `url`, so it shows in the browser next to our chat. Do not open it with the system browser (`xdg-open`, the Artifact tool's `open` action), which lands in another desktop workspace. Still give me the link in your reply. Outside T3 Code, open pages as usual.
MD
    ;;
  *)
    echo "usage: $0 <cards|browser> [--remove]" >&2
    exit 2
    ;;
esac

BEGIN="<!-- abode:$1 begin -->"
END="<!-- abode:$1 end -->"
BLOCK="$BEGIN"$'\n'"$BODY"$'\n'"$END"

# Removes the block and the blank lines just before it, leaving the rest of the file as it was.
strip() {
  [[ -f "$1" ]] || return 0
  awk -v b="$BEGIN" -v e="$END" '
    $0 == b { skip = 1; blanks = 0; next }
    skip { if ($0 == e) skip = 0; next }
    $0 == "" { blanks++; next }
    { while (blanks > 0) { print ""; blanks-- } print }
  ' "$1" > "$1.abode-tmp"
  mv "$1.abode-tmp" "$1"
}

for file in "${targets[@]}"; do
  if [[ "${2:-}" == "--remove" ]]; then
    strip "$file"
    echo "removed abode $1 from $file"
    continue
  fi
  mkdir -p "$(dirname "$file")"
  strip "$file"
  if [[ -s "$file" ]]; then printf '\n%s\n' "$BLOCK" >> "$file"; else printf '%s\n' "$BLOCK" > "$file"; fi
  echo "added abode $1 to $file"
done
