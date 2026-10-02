# Lessons

- Stay wire-compatible with the official T3 mobile app: never change an existing contract field, default, or link format. Encode new meaning inside the existing shapes, or add optional fields that older parsers ignore.
- Run tests from inside the package (`cd apps/web && vp test run src/...`), not from the repo root, or stale copies under `.claude/worktrees/` get picked up.
- Health-check loops in ops scripts need curl timeouts (`--connect-timeout`, `--max-time`), or a rollback can hang forever.
- Host updates restart the server that agents run under, so `scripts/abode/host.sh update` re-launches itself via `systemd-run`. Never run the update inline from an agent turn.
