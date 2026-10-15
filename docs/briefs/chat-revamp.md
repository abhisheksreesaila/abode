Status: approved (2026-10-11, "experiment is the name of the game")

# Chat revamp: reinvent the agent chat

## Why (the mission)

- **Goal:** make talking to agents fun, useful and focused. Today it's a stream of text. This is an experiment: reinvent the agent chat interface, try bold ideas, keep what works.
- **Problem:** agent answers are long walls of white-on-black text; questions, warnings, tickets and plain info all look the same, so I have to read everything to find what needs me.
- **Why now:** abode's shell, themes and customizations are done; the chat is where I spend the day.
- **If it disappeared:** I'd keep reading every answer top to bottom and scrolling back to find the ticket or question I needed.

## Who it's for

- **Who:** me, driving Claude/Codex agents across 10–15 projects.
- **Trigger:** an agent finishes a turn and I need to know in seconds: does it need me, what went wrong, what's next.
- **Today:** upstream's markdown in a code-editor feel. Readable, but every kind of content looks alike.

## What it does

- **Core job:** make an agent's answer skimmable at a glance.
- **v1:**
  1. **Message cards by kind.** Agents tag content with callouts (`> [!QUESTION]`, `> [!WARNING]`, `> [!INFO]`, `> [!TICKETS]`, `> [!DONE]`); abode renders each as a colored card with an icon. A shipped skill/CLAUDE.md snippet tells agents to use them. Untagged answers get abode's best guess (questions, warnings, ticket lists); a wrong guess is fine, the text is still all there.
  2. **A pleasant reading style** for all agent text: proportional font, comfortable line length and spacing, softer contrast, nicer headings, lists and tables. Code stays monospace.
  3. **Dropped 2026-10-14 (Abhishek never used it; the chat gets the width instead):** ~~**Two columns on desktop** (mockup C): the readable chat on the left; on the right a board that collects every card from the thread into lanes (Needs you, Watch out, Tickets, Done), with answer buttons on questions and a jump back to the message. On a narrow window the board is a tab.~~ The moods and poses that lived on the board went with it; the avatars beside messages stay.
  4. **The cast with moods:** original Pixar-style helpers, Sunny (Claude) and Pip (Codex), whose face shows the mood (asking, worried, working, done, idle) at the top of the board and next to each turn. I'm the Boss: built from parts (face, hat/crown/hair, brows, eyes/glasses, scarf color) or a photo, with my own name; helpers can be renamed. Off-switch in Settings.
  5. **Activity poses:** the helper's pose follows what the agent is doing (typing for file edits, a terminal for commands, glasses and a magnifier for reading and search, painting for a designer subagent, glasses and clipboard for a reviewer, a thought bubble for thinking). One short motion per real event, then still; nothing loops.
  6. **Thumbs up on answers:** answering a question from the board turns its buttons into a "👍 your choice · on it" chip (with "change"), and the helper hops once into a done/happy mood.
- **Not doing:** pins and flags (sessions end and context fills, so a pin in a dead thread is never reopened; the board collects what matters automatically); rewriting upstream's timeline (virtualization, tool calls, diffs stay upstream's); a model that classifies messages; Minion/Gru images or names; changing what the agent sends over the wire; mobile.

## How it should look and feel

- **Three words:** fun, useful, focused.
- **Feels like:** Linear/Notion docs for reading comfort, GitHub callouts for the cards, a touch of Pixar warmth in the avatars only.
- **Style:** abode's themes (Amber default), not Terminal Ledger.
- **The one screen:** a thread with a long agent answer: the board on the right shows Sunny asking one question and one warning; you answer with a button without scrolling the chat.
- **Mockups:** https://claude.ai/artifact/6GkVJ5rYWzpZWqjMUgRAqm (`design/chat-revamp.html`): picked C's layout, the cast and the Boss builder.

## How we'll know it worked

- I can tell what an answer needs from me without reading it all, and answer it from the board.
- **Done for v1:** cards render for all five kinds in Amber, Azure and Omarchy themes; the board fills from tags and guesses; moods follow the thread's state; my Boss and helper names survive reload; the agent skill is installed; Abhishek checks it on a real thread.

## Constraints and risks

- **Merge safety:** `MessagesTimeline.tsx` is 5,900 upstream lines. Cards and reading style go through one small hook into upstream's `ChatMarkdown` (custom blockquote/callout renderer) plus CSS; pins through one hook on the message actions. Must stay inside the 400-line hook budget (326 used).
- **Performance:** no looping animations (upstream rule: they peg the GPU). Motion is one-shot per agent event (~0.5s), paused in hidden windows and off under "reduce motion"; characters are inline SVG, a few KB.
- **Riskiest assumption:** the new layout is actually easier than the stream. Cheapest test: mockups of real threads first, then ship behind a Settings switch (Classic / abode chat) so it can be compared and turned off.

## Decisions and trade-offs

- Scan fast is v1's priority: biggest daily win.
- No pins or flags: less to build and nothing to curate; "Carry over" (open items into a new session or docs/plan.md) is a later idea.
- Avatar settings per browser for v1 (assumed): like workspace colors; a phone or second browser starts with the default Boss.
- Agents tag, abode also guesses: tags are reliable, guesses cover old and untagged answers; mislabels are accepted (the full text is always shown).
- Experiment behind a switch: bold changes are safe to try because Classic is one click away.
- Original look-alike characters, not Minions/Gru: safe in a public repo; it won't be the exact movie characters.

## Open questions

- None blocking.
