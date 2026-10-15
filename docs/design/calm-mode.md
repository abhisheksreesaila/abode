# Calm card: design handoff

- **Canvas:** https://claude.ai/artifact/46J6LrSG43hKVgbXLr6Mv6 (options A ledger rows, B one line, C tiles; "A in every state + sidebar").
- **Chosen:** A, ledger rows (assumed until Abhishek picks; B or C changes only the card's layout).

## Tokens (theme variables, never hex in code)

- Card: `--card`/raised surface, `--border`, radius 10px, padding 14px 16px. Text `--foreground`, labels `--muted-foreground` (12px, 600, uppercase, 0.06em).
- Counts: `--font-mono`, muted. Ticket bar: 4px, track `--border`, fill `--primary` (amber), `--success` when all done.
- Check mark: `--success`, bold "✓".
- Needs you: a bright orange that is not the amber accent. abode has no token for it: add `--abode-needs-you` in `abode/abode.css` (orange-500 in dark, orange-600 in light), with dark text on it. Card gets a 2px border and a header strip "Needs you · answer below"; the sidebar row gets a filled "Needs you" tag in place of the age.
- Emoji per type: 🛠️ developer, 🔍 reviewer, 🧭 explore, 📐 plan, 🤖 anything else (Codex, unnamed).

## States to build

- Working: tickets N of M with bar; rows show finished / started, ✓ only when finished = started.
- Needs you: orange header strip and border; upstream's question panel stays where it is, right under the card.
- All done: bar green, ✓ beside the tickets count, every row ✓.
- Empty (no task list, no subagents): no card at all.
- Only a task list: just the tickets line. Only subagents: just the rows.
- Many types: rows grow; more than 6 types folds the rest into "+N more".
- Long names: truncate with ellipsis in the name column.
- Mobile and narrow web: same card, full width; no layout change needed.
- No motion anywhere.
