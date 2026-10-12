#!/usr/bin/env bash
# Tells Claude and Codex to mark the parts of their answers that need you, so abode's chat
# can show them as cards and collect them on the board. Adds one marked block to
#   ~/.claude/CLAUDE.md   (or $CLAUDE_CONFIG_DIR/CLAUDE.md)
#   ~/.codex/AGENTS.md    (or $CODEX_HOME/AGENTS.md)
# Running it again changes nothing.
#
#   scripts/abode/chat/install-instructions.sh            add (or refresh) the block
#   scripts/abode/chat/install-instructions.sh --remove   take it out again
set -euo pipefail

BEGIN="<!-- abode:cards begin -->"
END="<!-- abode:cards end -->"
read -r -d '' BLOCK <<'MD' || true
<!-- abode:cards begin -->
## Cards (abode chat)

When an answer has something I need to see, mark it with a callout so my chat can show it as a card:

- `> [!QUESTION]` for a decision you need from me. Put the choices as a list inside it, first one recommended:
  `> [!QUESTION]` / `> Run the full benchmark now?` / `> - Go now` / `> - Tonight`
- `> [!WARNING]` for a risk, a failure or something that surprised you.
- `> [!TICKETS]` for open work, one `- ID title` per line (`- F-022 GPU precision`).
- `> [!DONE]` for what you finished. A short title may follow the marker: `> [!DONE] Tests green`.
- `> [!INFO]` for a fact worth keeping.

Use them only for those moments; ordinary explanation stays plain text. End with at most one question card.
<!-- abode:cards end -->
MD

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

targets=(
  "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/CLAUDE.md"
  "${CODEX_HOME:-$HOME/.codex}/AGENTS.md"
)

for file in "${targets[@]}"; do
  if [[ "${1:-}" == "--remove" ]]; then
    strip "$file"
    echo "removed abode cards from $file"
    continue
  fi
  mkdir -p "$(dirname "$file")"
  strip "$file"
  if [[ -s "$file" ]]; then printf '\n%s\n' "$BLOCK" >> "$file"; else printf '%s\n' "$BLOCK" > "$file"; fi
  echo "added abode cards to $file"
done
