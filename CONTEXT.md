# abode vocabulary

abode uses T3 Code's glossary (`docs/internals/glossary.md`). These are the extra words we use when talking about abode:

- **Workspace:** what VS Code calls it; in the code it's a T3 **project** (a folder). In abode, each workspace has an accent color.
- **Session (agent):** a T3 **thread**, one conversation inside a workspace.
- **Subagent:** a short-lived agent a thread spawns. It shows nested under its thread.
- **Harness:** a T3 **provider** (Claude, Codex, …).
- **Side panel:** T3's right panel (files, diff, browser, terminal tabs). It's closed by default.
- **Card:** one tagged piece of an agent's answer (question, warning, info, tickets, done), written by the agent as a `> [!KIND]` callout and rendered by abode as a colored block.
- **Pin:** a message or card the user saved to the thread's Pinned list, optionally flagged and with the user's own note.
- **Autopilot:** a workspace's scheduled task that keeps its agent working through `docs/plan.md` unattended. On for every workspace with an approved brief and plan, unless its CLAUDE.md says `Autopilot: off`.
- **Decision:** something only Abhishek may settle: new product direction, an irreversible step, or a block such as a key or an account. Everything else the agent decides and writes to its decision log.
- **Idle list:** the `Idle` section of a plan.md: standing jobs that run only when that workspace has no other work queued.
