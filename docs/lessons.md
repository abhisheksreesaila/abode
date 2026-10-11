# Lessons

- Stay wire-compatible with the official T3 mobile app: never change an existing contract field, default, or link format. Encode new meaning inside the existing shapes, or add optional fields that older parsers ignore.
- Run tests from inside the package (`cd apps/web && vp test run src/...`), not from the repo root, or stale copies under `.claude/worktrees/` get picked up.
- Health-check loops in ops scripts need curl timeouts (`--connect-timeout`, `--max-time`), or a rollback can hang forever.
- Host updates restart the server that agents run under, so `scripts/abode/host.sh update` re-launches itself via `systemd-run`. Never run the update inline from an agent turn.
- Never add numbered DB migrations in the fork: upstream's next number would collide, and the migrator silently skips ids at or below the latest one recorded. Fork schema changes go in an idempotent "ensure" step that runs after the numbered migrations.
- Don't delete upstream files the fork stops using (e.g. the inbox Sidebar.tsx). Leave them unused: deleting them causes a modify/delete conflict on every monthly upstream merge.
- Builders must only edit inside their own worktree. Before each merge, check that the main checkout's `git status` is clean; a builder once leaked an uncommitted edit into main.
- Upstream Orchestration V2 (protocol 2) refuses V1 peers in both directions. Before pulling upstream, check `ORCHESTRATION_PROTOCOL_VERSION` and the official mobile app's version. A protocol bump breaks the phone until abode follows.
- Engine edits made the first fork unmergeable (75 conflicts after 10 days). abode code lives in `abode/` folders, and upstream files only get small `abode:`-marked hooks that `scripts/abode/hook-report.sh` keeps under budget.
- Tests and typecheck don't catch the production build's license check. After adding a dependency, run `cd apps/web && vp build --outDir <scratch>` before calling the ticket done.
