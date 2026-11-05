Status: approved (2026-11-04, "I love it… that's all I need" on the screens)
Screens: https://claude.ai/artifact/MAxT8zMrArrRvoFEjMrcWB

# Workspace tabs: Jam, Milestones, Design in one window

Replaces parts of docs/briefs/one-window.md (journey map, drawer, omnibox routing, mode pills). The overview and the workspace rail carry over.

## Why

- One Window's drawer and omnibox were too cramped, so Abhishek kept slipping back to the plain T3 chat (2026-11-04). He wants one roomy window per workspace where chatting, tracking tickets and picking designs don't clutter each other.

## Who

- Abhishek at his desk (host :3773) and on his phone, moving between about 10 workspaces.

## What

1. **Three tabs per workspace:**
   - **Jam** is T3's real chat view for the current thread, at full width.
   - **Milestones** shows the project's `docs/plan.md` as an accordion, M1, M2, M3…, with tickets and their status inside each milestone. It refreshes as the agent edits the file.
   - **Design** shows every design found in the workspace: Claude artifact links, Stitch links and `docs/design/*.html` from its threads. They appear as cards that preview in the browser panel, and picking one sends "I pick X" to the chat.
2. **Agent strip above the tabs:** "3 agents running", then one line per running thread or subagent in this workspace, each saying what it is doing and its status (in progress, needs you, done).
3. **One composer on all three tabs:** T3's own large rectangular composer, bound to the current thread. (assumed)
4. **Removed:** the journey map, keyword routing, the chat drawer, the mode pills and the omnibox commands.
5. **Kept:** the overview (`o`), the workspace rail and Kit ⚙ (assumed). The One window switch (Settings → abode) stays on by default, and turning it off gives back stock T3.

- Not doing: engine changes, upstream contract edits, new numbered migrations.

## Look and feel

- omxqua · Developer · Graphite night, as now. The tabs sit in one quiet segmented bar. No cartoon style anywhere in the workspace view (the overview mascots stay).
- At phone width, the tabs become a segmented control under the agent strip, and the composer stays docked at the bottom. (assumed)

## Success

- Abhishek runs a whole day from this window without switching off One window.
- He can tick through a milestone's tickets and pick a design without scrolling the chat.

## Decisions and trade-offs

- **Jam is T3's real chat** (Abhishek). Pro: every T3 feature and nightly fix comes free, at full width. Con: Jam looks like T3, not like the prototype.
- **Designs are auto-collected from links and files** (Abhishek). Pro: the agent needs no new habits. Con: the odd non-design link may show up.
- **Keep the overview and rail, cut the rest** (Abhishek). Pro: far less to maintain. Con: there is no more messaging another workspace from anywhere.
- **Milestones reads `docs/plan.md` only**, using A-044's parser. When a project has no plan, the tab says so and offers "Ask the agent to plan". (assumed)
- **The tab is remembered per workspace and per device.** (assumed)

## Open questions

- None blocking.
