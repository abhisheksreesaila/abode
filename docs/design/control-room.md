# Control room: design handoff

- **Canvas:** https://claude.ai/artifact/Uf9axLcQUBqSGZzCfQZMYG (Claude's options plus Stitch's drafts, Stitch project 6417818831190429069).
- **Chosen (Abhishek, 2026-10-17):** tables everywhere. The Calm board "Calm: plan table while working" is the reference look; home is "Chosen · Home as tables" (a Workspaces table and a Machines table in the same style). Bento tiles, the status wall and Stitch's tiles were not picked.
- **End of run:** below the plan table, the model's own final message in full, rendered as chat markdown (links clickable), headed "N of N complete". Not rewritten or shortened.

## Look (theme variables, never hex in code)

- Tables: 1px `--border` around, radius 6px; header row on the chrome surface (`--sidebar`/chrome), 11px uppercase 600 muted labels with 0.06em tracking; rows 12px 16px padding, hairline row borders. Wide tables scroll inside their box (`overflow-x: auto`).
- Status pills (999px radius, 12px 600): Running/In progress = success tint; Needs you = `--abode-needs-you` fill with `--abode-needs-you-foreground`; Done = success; Idle/Not started = muted; Failed = destructive tint.
- Progress: 6px bar on `--border` track, fill `--primary` (amber), `--success` at 100%, destructive when failed; mono percentage and "done/total".
- Numbers, IDs and times: `--font-mono`, muted.
- Needs you: a "Needs you" row sorts first, gets a faint orange row tint and shows the waiting question under the name in orange text. In Calm, an orange 2px banner above the table with the question and an Answer button (opens upstream's question panel).
- No motion. No emoji.

## States

- Home: no workspaces (upstream's no-projects hero stays); a workspace with nothing running shows "Nothing running" in Progress; no task list yet shows status only; machine offline: CPU/Memory "—"; resources unavailable (older server): "—".
- Calm: no task list and no subagents yet: "Working…" header with no table, then the final message when the run ends; long task names wrap; more than ~20 rows scroll with the page.
- Phone (390): the home tables drop Agents/Machine/Activity into a second line under the name; the Calm table becomes one row per task (task + ID · who on two lines, status pill right); the Needs-you banner sits at the bottom with a 48px Answer button.

## Gestures

| Gesture             | What it does                                                   | Visible alternative                 | Threshold |
| ------------------- | -------------------------------------------------------------- | ----------------------------------- | --------- |
| Tap a workspace row | Opens its latest session in Calm                               | The row is a link                   | tap       |
| Tap a machine row   | Filters the workspaces table to that machine; tap again clears | "All machines" chip above the table | tap       |
