Status: approved

# Calm mode: glance, don't read

## Why (the mission)

- Why this exists, in one sentence: agents stream walls of text and tool calls nobody reads; I only need to know what's done, who's working, and what's waiting on me.
- Why now, and why you: I run 10 to 15 projects with reviewer and developer subagents and check threads in passing; I can't afford to read.
- If it disappeared tomorrow: I'd keep scrolling transcripts hunting for the one question that needs me.

## Who it's for

- The one person: Abhishek, glancing at a thread while agents work.
- The moment: switching to a thread to see "where is this, does it need me?"
- What he uses today: abode's Simple mode (A-007) hides tool calls but still shows every message in full; upstream shows the task list as a small "N of M" in the composer and subagents as a collapsible row.

## What it does

- The core job: show the state of the work at a glance.
- v1:
  1. **The card**, one per turn: tickets done of total, from the agent's own task list ("Tickets 4 of 5"), and one row per subagent type: emoji, type, "3 of 5" (finished of started), a check mark once all of that type are done. Nothing animates.
  2. **Needs you:** while a question or approval waits, the card shows a bright orange "Needs you", and so does the thread in the sidebar. The question itself opens in upstream's panel under the chat, as today.
  3. **Only the card:** tool calls, thinking and the agent's text are hidden; your own messages stay. One tap on the card shows that turn in full (Detailed).
- Calm replaces Simple: the transcript menu becomes Calm / Detailed, and Calm is the default. (assumed)
- Not doing: changing what agents send; a separate board (dropped 2026-10-14); streaming text; animations; reading docs/plan.md.

## How it should look and feel

- Three words: calm, glanceable, honest.
- Feels like: a CI summary (green checks, counts), not a chat log. (assumed)
- Style: abode's themes (Amber default); an emoji per subagent type (🛠️ developer, 🔍 reviewer, 🧭 explore, 📐 plan, 🤖 anything else). (assumed)
- The one screen: a thread where a developer and a reviewer are working: "Tickets 4 of 5 · 🛠️ developer 3/5 ✓ · 🔍 reviewer 3/5", with an orange "Needs you" while a question is open.

## How we'll know it worked

- I can tell in under 3 seconds what's done, who's working and whether I'm needed, without scrolling.
- Done for v1: the card shows real counts on Claude and Codex threads; the orange marker shows exactly while something waits on me; Detailed still shows everything; Abhishek checks it on a real thread.

## Constraints and risks

- Subagent types are not stored today. Claude's adapter gets `subagent_type` from the Agent tool and drops it; Codex has no named types (its rows fall back to 🤖 "helper").
- Claude subagents' own task lists are dropped by the adapter, so "3 of 5" counts subagents of a type, not tickets inside one subagent.
- Riskiest assumption: one subagent ≈ one ticket in Abhishek's flow (a developer per ticket, a reviewer per ticket). Cheapest test: compare the card with docs/plan.md on the next real batch.

## Decisions and trade-offs

- Tickets come from the agent's task list: works in every project and arrives already; con: counts the agent's to-do items, which match ticket IDs only when the agent writes them that way.
- Group rows by subagent type through a small engine hook (approved by Abhishek 2026-10-14, ADR 0001): reliable names; con: an edit in the Claude adapter and one optional contract field, against the fork's engine-untouched rule.
- Only the card shows, agent text behind a tap: the calmest view; con: an explanation that matters is missed unless the agent asks it as a question.
- "3 of 5" is subagents of that type finished of started: honest with the data we have; con: a subagent that handles two tickets counts once.

## Open questions

- None blocking. Revisit after the first real batch: whether "one subagent per ticket" holds.
