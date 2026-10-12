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
  3. **Pin and flag** (assumed scope): pin a message or a card to the thread's Pinned list; flag it as "come back to"; add your own note to a pin; "reply to this" quotes it into the composer. Kept per browser like workspace colors (assumed).
  - **Characters** (after the three above, same brief): original Pixar-style yellow helpers drawn for abode, one per harness (Claude, Codex), and a "boss" avatar for me. Shown as small avatars next to turns, plus a few personality touches in empty states. Off-switch in Settings.
- **Not doing:** rewriting upstream's timeline (virtualization, tool calls, diffs stay upstream's); a model that classifies messages; Minion/Gru images or names; changing what the agent sends over the wire; mobile.

## How it should look and feel

- **Three words:** fun, useful, focused.
- **Feels like:** Linear/Notion docs for reading comfort, GitHub callouts for the cards, a touch of Pixar warmth in the avatars only.
- **Style:** abode's themes (Amber default), not Terminal Ledger.
- **The one screen:** a thread with a long agent answer: you see the question card and warning card first, pin the ticket list, reply to the question.

## How we'll know it worked

- I can tell what an answer needs from me without reading it all, and I find pinned items without scrolling.
- **Done for v1:** cards render for all five kinds in Amber, Azure and Omarchy themes; pins survive reload; the agent skill is installed; Abhishek checks it on a real thread.

## Constraints and risks

- **Merge safety:** `MessagesTimeline.tsx` is 5,900 upstream lines. Cards and reading style go through one small hook into upstream's `ChatMarkdown` (custom blockquote/callout renderer) plus CSS; pins through one hook on the message actions. Must stay inside the 400-line hook budget (326 used).
- **Performance:** no animations that repaint; avatars are static images, a few KB each.
- **Riskiest assumption:** the new layout is actually easier than the stream. Cheapest test: mockups of real threads first, then ship behind a Settings switch (Classic / abode chat) so it can be compared and turned off.

## Decisions and trade-offs

- Scan fast is v1's priority: biggest daily win; pins and characters come after.
- Agents tag, abode also guesses: tags are reliable, guesses cover old and untagged answers; mislabels are accepted (the full text is always shown).
- Experiment behind a switch: bold changes are safe to try because Classic is one click away.
- Original look-alike characters, not Minions/Gru: safe in a public repo; it won't be the exact movie characters.

## Open questions

- None blocking. Exact pin/flag/append behaviour is assumed above; correct it on the mockups.
