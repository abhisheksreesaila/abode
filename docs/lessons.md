# Lessons

- Stay wire-compatible with the official T3 mobile app: never change an existing contract field, default, or link format. Encode new meaning inside the existing shapes, or add optional fields that older parsers ignore.
- Run tests from inside the package (`cd apps/web && vp test run src/...`), not from the repo root, or stale copies under `.claude/worktrees/` get picked up.
- Health-check loops in ops scripts need curl timeouts (`--connect-timeout`, `--max-time`), or a rollback can hang forever.
- Host updates restart the server that agents run under, so `scripts/abode/host.sh update` re-launches itself via `systemd-run`. Never run the update inline from an agent turn.
- Never add numbered DB migrations in the fork: upstream's next number would collide, and the migrator silently skips ids at or below the latest one recorded. Fork schema changes go in an idempotent "ensure" step that runs after the numbered migrations.
- The one sanctioned contract-default change: `legacySidebarEnabled` defaults to true (approved by Abhishek 2026-10-02). Re-check it on every upstream merge.
- Don't delete upstream files the fork stops using (e.g. the inbox Sidebar.tsx). Leave them unused: deleting them causes a modify/delete conflict on every monthly upstream merge.
