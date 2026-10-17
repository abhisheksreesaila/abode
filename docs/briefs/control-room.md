Status: approved

# Control room: tiles, a plan table, and machines

## Why (the mission)

- Why this exists, in one sentence: I run 10 to 15 projects with agents and only need to know, per workspace and per machine, whether it's running, how far along it is, and whether it needs me, without reading any chat.
- Why now, and why you: Calm (A-019/A-020) still reads like a chat with a small card; I'm about to add more machines (an old MacBook, cloud CPUs), and the number of things to watch is growing.
- If it disappeared tomorrow: I'd keep clicking through threads and scrolling to find out what's done and what's waiting on me.

## Who it's for

- The one person: Abhishek, zoomed out, glancing at everything between other work.
- The moment: "Where is everything? Does anything need me?", then "what's the state of this one?"
- What he uses today: the sidebar's status squares and "Needs you" tags, then Calm's "Tickets 4 of 5" card above a still chat-shaped transcript.

## What it does

- The core job: show where every workspace and machine stands at a glance, and each workspace's agreed plan as a table.
- v1:
  1. **Workspace tiles (the home page).** Clicking the abode logo shows one tile per workspace in a bento grid. Each tile: a status light (green running, orange "Needs you", grey idle, red failed), a progress bar with a percentage from the agents' task lists, and stats: agents running, sessions, tickets done of total, last activity. Busy and "Needs you" workspaces get bigger tiles. (sizes assumed) Clicking a tile opens that workspace in Calm.
  2. **Calm becomes the plan table.** No chat at all. While the agents work: one row per task-list item with columns Task, Status (not started / in progress / done / blocked), Who (the subagent type working on it, or "main agent"), and a progress bar with "N of M" on top. "Needs you" is an orange banner with the question. When the run finishes: "9 of 9 complete" and an executive summary below the table (the agent's final message, with its links pulled out as buttons). Everything else is behind the Calm / Detailed switch, as today.
  3. **Machine tiles.** The same tile design for each connected machine (this computer, paired Macs, cloud boxes): online or offline, agents running, workspaces on it, CPU and memory load, and the same status light. Clicking a machine filters the workspace tiles to it.
- Rows come from the agents' own task lists (decided). A task matches a ticket when the agent names it with the ID ("A-031: ...").
- Not doing: reading docs/plan.md; changing what agents send; live log streams on tiles; animations that repaint continuously (static progress bars only); starting or managing cloud machines (pairing stays as upstream does it).

## How it should look and feel

- Three words: calm, glanceable, honest.
- Feels like: a CI dashboard or a status board, not a chat log. (assumed)
- Style: abode's themes, no workspace colors (A-025); status colors only for state. Phone and desktop together: tiles stack to one column on a phone. (assumed)
- The one screen: the home tiles, with one workspace orange "Needs you", two green at 60% and 70%, the rest grey.

## How we'll know it worked

- I can tell in under 3 seconds which workspaces and machines need me and how far along each one is.
- Done for v1: tiles and the plan table show real counts on Claude and Codex threads; "Needs you" shows exactly while something waits; the summary appears when a run ends; machine tiles show this computer and any paired machine; Abhishek checks it on a real batch.

## Constraints and risks

- Progress is the agent's task list: a workspace whose agent keeps no list shows "running" with no percentage. (accepted)
- Task-list items carry no owner. "Who" is inferred from the subagent whose description names the task's ticket ID, and falls back to "main agent". Claude's subagents' own task lists are dropped by the adapter (calm-mode brief).
- A workspace's percentage combines its running sessions' lists (done over total across them). (assumed)
- Machine CPU and memory come from upstream's load-balancing resource checks; older or unreachable machines show only online or offline.
- Must stay inside abode folders: new pages and views, no new upstream hooks beyond a route, mindful of the 400-line hook budget (392 today, less after the upstream merge may change).
- Riskiest assumption: the agent's task list is a good enough stand-in for "the plan we agreed". Cheapest test: compare the table with docs/plan.md on the next real batch.

## Decisions and trade-offs

- All three parts in one batch (Abhishek, 2026-10-17): one consistent design; con: machine tiles are built with only one machine to test on until the Mac is paired.
- Rows from the agent's task list (Abhishek): works everywhere, live; con: the agent's wording, not plan.md's.
- Calm shows the table and summary only, no messages (Abhishek): exactly the glance he wants; con: what he asked is only in Detailed.
- Home page becomes the tile board, reached from the logo. (assumed)

## Open questions

- None blocking.
