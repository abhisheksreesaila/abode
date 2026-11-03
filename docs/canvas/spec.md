# One Window: canvas spec for T3 Code

A replacement chat canvas for T3 Code. You run many coding-agent workspaces across machines; this canvas lets you watch them all, steer them, and jam on design without leaving the window.

**The rule:** T3 Code is the engine. This spec only changes the UI layer. Everything here sits on top of what T3 already provides (threads, providers, `delegate_task`, the in-app browser, guest shares, T3 Connect, scripts, usage), so upstream can be merged weekly.

**Reference prototype:** `reference/one-window-prototype.html` is a single-file, interactive build of everything below. Open it in a browser and scroll to section **C3 · One window**. When this doc and the prototype disagree, the prototype wins on look and feel and this doc wins on behaviour and data.

---

## 0. Instructions for Claude Code (read first)

1. Read this whole file, then open the prototype and click through C3: the gear button, the grid button, "⤢ Design session" in gitaway, and the `?` key for the tour.
2. **Explore the repo before planning.** Names below that come from T3's internals (`PreviewManager`, `HostedBrowserWebview`, `BrowserSession.getPartition`, `PickPreload`, `ServerBrowser`, `/api/guest/stream`, the T3 Code MCP) were taken from public docs and PRs and may have moved. Find the real modules, and write a short `docs/canvas/repo-map.md` that maps each spec concept to a file.
3. Write a phased plan (section 9) and wait for approval before Phase 1.
4. **Keep upstream mergeable:**
   - New code lives under one folder, e.g. `apps/web/src/canvas/` (pick the right app after exploring).
   - Touch upstream files only at thin mount points, each marked `// canvas-mount`, and list them in `docs/canvas/mount-points.md`.
   - Everything is behind a setting, `canvas.enabled` (default off), so the stock UI keeps working.
5. Don't fork engine behaviour. If something needs server support T3 lacks, add a small extension module with its own tables, or a project file, and flag it in the plan.
6. After each phase, run the Playwright flows in section 10 and attach screenshots.

---

## 1. Design principles

- **One window.** Never send the user to another app or browser. Native tools open as tabs inside T3's own browser.
- **Just enough detail.** One signal per idea. If two elements say the same thing, delete one. Secondary actions are icons with tooltips; text buttons are for primary actions only.
- **Color means something, or it isn't there.** Five color systems, each with one job (section 7). Everything else is neutral ink on dark surfaces.
- **Cartoon has a job.** The hand-drawn style is used only for:
  - the journey map;
  - the storyboard;
  - the machine mascots;
  - the two mode characters (Ember for Grill me, Pip for Tell me).

  Never for chrome, lists or controls.

- **Focus moment on creation.** Creating anything (workspace, session, design session) blurs the background and gives the new thing an amber glow for about 1.6s.
- **Talk anywhere.** The omnibox is always there, it's centered on the content area, and it routes to the right session.
- **Milestones over tickets.** Start → milestones → goal. Tickets show up only as a checklist inside a milestone.

---

## 2. Upstream sync (weekly merge)

- **Cadence:** a scheduled merge on Fridays at 9:00. No daily merges.
- **Keep a merge ledger** at `docs/canvas/upstream-ledger.md` (the Kit's Weekly merge tab reads it). Each row has: source (T3 Code, or a skill pack), feature, what it means for the canvas, and a status: `merged | take | later | skip | 3-way`.
- **Merge procedure:**
  1. Fetch upstream.
  2. Rebase the canvas branch.
  3. Re-run section 10.
  4. Update the ledger.
  5. If a mount point breaks, fix the mount, not upstream code.
- **Already adopted** from upstream, shown as `merged` in the ledger:
  - `delegate_task` lineage: model pairs on tabs.
  - PR watches: a feed item when checks go green.
  - The Pi provider.
  - Guest shares.
  - The in-app browser: design session tabs.
- **Next to take:**
  - The `t3 thread` CLI, so the omnibox can start and message threads.
  - Usage-limit auto-resume: show "resumes 11:00" on paused sessions.
  - PDF annotation in previews: reuse the jam pins.

---

## 3. Information architecture

```
Top bar:  [sidebar]  ab · One window · 10 workspaces  T3 powered by T3 Code   …   [⊞ overview] [⚙ kit]

Body (one at a time, all zoom/fade in place):
  ├─ Workspace view   (default; rail on the left, detail on the right)
  ├─ Overview         (⊞ or `o`; every workspace on every machine)
  ├─ Kit              (⚙; skills, MCP, plugins, hooks, weekly merge)
  └─ Design session   (from a jam; native tool tabs + storyboard + chat)

Always present: omnibox (bottom, centered on the content column) + chat drawer (opens above it)
Keyboard: `o` overview · `?` tour · `/` focus omnibox · Esc closes the top-most layer
```

**Removed in the minimalism pass. Don't bring these back:**

- A tour button in the top bar (use the `?` key, or say "tour").
- A "brief me" speaker button (say "brief me").
- A monitor status dot.
- A Kinds legend in the Kit (the kit list headers filter instead).
- Per-row model chips in the overview.
- "x/y" counts next to the overview milestone bars.
- Hint text in the design call block.
- URL bars on design-session panes that aren't focused.
- The "you" badge on panes (show only "agent driving").

---

## 4. Data model

The canvas maps onto T3 entities and adds a little data of its own.

| Canvas concept       | Backed by                                                                    | Canvas-owned fields                                                                                          |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Machine**          | T3 environment / connection (T3 Connect, SSH, Tailscale)                     | `mascot: laptop \| mini`, `color`                                                                            |
| **Workspace**        | T3 project                                                                   | `goal`, `milestones[]`, `archived`, `group` (derived)                                                        |
| **Milestone**        | canvas                                                                       | `name`, `state: done \| current \| todo`, `progress`, `tickets[]`                                            |
| **Ticket**           | canvas (optionally mirrored to GitHub issues)                                | `name`, `state: done \| running \| stopped \| failed \| todo`, `who`, `note`, `source: plan \| jam \| grill` |
| **Session**          | T3 thread                                                                    | `mode: auto \| tell \| grill \| jam`, `milestone`, `role`, `routingKeywords[]`                               |
| **Session model**    | thread provider/model, plus `delegate_task` children                         | read-only from T3; a pair is shown as `parent → child`                                                       |
| **Feed event**       | derived from thread/PR events                                                | `type: ms \| dec \| jam \| red \| pr \| sess`, `workspace`, `text`, `at`                                     |
| **Storyboard frame** | canvas, per design session                                                   | `title`, `tabKind`, `snapshotRef`, `model`, `note`, `locked`                                                 |
| **Kit item**         | filesystem (`~/.claude/skills`, `~/.codex/skills`, MCP config, hooks config) | `source`, `category`, `edited`, `pinnedUpstreamRev`                                                          |

**Where canvas-owned data lives.** This is a decision for the human; recommend option A.

- **A.** Per project, a committed file `.t3/canvas.json` holding goal, milestones and tickets; per thread, a small canvas table keyed by thread id holding mode, milestone and role. Upstream-safe, and the plan travels with the repo.
- **B.** Everything in a canvas-owned SQLite table next to T3's event log.

**Derived workspace group** (used for ordering and the rail dot):

- `need`: any session blocked, waiting on you, or holding an irreversible decision.
- `jam`: has an open jam.
- `move`: anything running.
- `quiet`: goal reached or idle.

---

## 5. Views

### 5.1 Shell and top bar

- **Left:** sidebar toggle, avatar mark, the title "One window" with the subtitle "N workspaces", and a quiet "T3 powered by T3 Code" mark (16px gradient square plus mono text at 70% opacity, no pill).
- **Right:** only ⊞ (overview) and ⚙ (Kit). The active one gets a 16% state background.
- **Body transitions:** zoom/fade (`g3zoom`, 350ms). The design session enters with blur → sharp plus an amber glow ring.

### 5.2 Rail (workspace list)

- **Collapsed by default:** 58px of 44px rounded squares showing initials.
- **Mode badge:** bottom-right, 20px circle with the workspace's mode icon in the mode color.
- **Needs you:** a 9px amber dot at the top-right. No ring and no glow (the ring was too loud).
- **Selected:** a 2px ink outline, offset 3px. Quiet workspaces are at 45% opacity.
- **Groups:** separated by thin rules, in the order need → jam → move → quiet. The `+` at the bottom creates a workspace (with the focus moment).
- **Expanded:** 320px, showing name, mode and a one-line status. Archive lives under the workspace's `…` menu, and Restore is in an "Archived" fold.

### 5.3 Workspace view (detail)

- **Header:** workspace name, then a `…` menu (archive, settings).
- **Session tabs:** pills, one per live session. Each pill has:
  - the mode icon in the mode color (a tap opens a popover to change mode);
  - the session name;
  - **model dots**: 7px circles in the model color. A delegate pair shows as `● → ●`. The full model name is in the tooltip and in the drawer header.
  - a status word, only when blocked or waiting ("waiting on you", amber mono). No status dot.

  After the pills come a "N done" fold and `+` (new session, with the focus moment).

- **Body:** composed by the monitor (5.8) from the block kit. Typical order:
  1. Journey map.
  2. Status prose (one sentence).
  3. An interrupt card, if any.
  4. Mode blocks: Grill me questions with Ember, Jam design call plus chat, Tell me briefs with Pip.
  5. The milestones checklist, with tickets inside the current milestone.

**Journey map** (`map` block): a hand-drawn SVG on a cream card, with an `feTurbulence` + `feDisplacementMap` sketch filter and the Patrick Hand font.

- **The route:** start house → milestone stickers (done = mint with a green ✓, current = yellow, todo = dashed) → goal flag on a green, labelled with the goal.
- **The robot:** sits on the current milestone with a status bubble: `!` blocked, `?` asking, `♪` jamming, `…` working, `★` goal reached. It hops (requestAnimationFrame) when the current milestone advances.
- **Jam clouds:** float above the milestone being jammed.
- **The ▶ button:** replays the journey.

**Milestones checklist** (`plan` block): one row per milestone with a state dot and "x/y". The current milestone expands to show its tickets: ✓ done, ● running, ‖ stopped, ✕ failed, ○ todo, each with an owner or a note. Jam-sourced tickets carry a small jam tag.

### 5.4 Modes (per session)

| Mode      | Icon          | Color                   | What the page shows                                                                                                                               | Agent behaviour                                |
| --------- | ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Autopilot | paper plane   | `--oq-data-1` `#8b7bff` | nothing extra; "N calls made on its own · reversible"                                                                                             | runs; surfaces only if blocked or irreversible |
| Tell me   | speech bubble | `--oq-info` `#52a9ff`   | a brief card by **Pip** (blue speech-bubble mascot; worried face when waiting)                                                                    | keeps a 1–2 line brief current                 |
| Grill me  | flame         | `--oq-data-4` `#ff8a3d` | a question card by **Ember** (flame mascot; stern brows, hops happily when done), one question at a time, chip answers, a "what you've said" list | asks before planning; answers become tickets   |
| Jam       | music note    | `--oq-data-3` `#2bc3ad` | a live board (variants side by side) + chat + "⤢ Design session"                                                                                  | puts options up live; pins → merge → lock      |

- **Mode color shows up in four places:** the tab icon, the omnibox mode tag (below the voice input), the drawer's top edge, and the current segment of the overview milestone bar.
- **One rule overrides every mode:** blocked or irreversible always surfaces as an interrupt card.
- **Ember and Pip** are about 66px and 46px, with a gentle bob animation that speeds up on hover; `prefers-reduced-motion` turns it off. Each card has a one-line quip in Patrick Hand, rotated from a small list. Keep the quips varied and short, and add a "serious mode" setting that hides them.

### 5.5 Omnibox and voice

- **Layout:** `[mic + Hex badge] [mode tag] [input] [→ target chip ▾] [voice-back icon] [send]`.
- **Hex:** on-device dictation (Hex 3.0 is voice → text only). The mic shows a small yellow hexagon badge, and while listening the placeholder reads "Hex is listening…".
- **Voice back** is icon-only, with three states:
  - `off`: dimmed.
  - `key moments` (default): speaker icon in amber. The canvas speaks only when something needs you, gets blocked or lands.
  - `two-way`: filled amber. It answers out loud every time.

  Speech comes from system TTS, not Hex.

- **Routing:**
  1. Keyword match to a session.
  2. Otherwise the open Grill me session, then the jam, then a blocked or waiting session, then a live one, then the first.
  3. The target chip shows `workspace · auto` or `workspace · Session name`. Pick a session from the chip, or pin one from the drawer.
- **Commands:**
  - "put X on grill me": change a session's mode.
  - "add … to <workspace>": add a ticket or milestone.
  - "new workspace X, goal: …".
  - "brief me".
  - "tour".
- **Context switching:** in the overview the target becomes "all workspaces"; in the Kit, the curator; in a design session, the jam.

### 5.6 Chat drawer

- **Opens:** above the omnibox, the same width as it, max 900px, centered on the content column.
- **Header:**
  - status dot, then "chat with workspace · Session";
  - the model chip: model dot + name + delegate, e.g. "Claude · opus → Codex builds";
  - milestone and status;
  - a compact mode dial (4 icons, the active one labelled);
  - pin-target, open full chat, close.
- **Top edge:** a 2px line in the mode color.

### 5.7 Overview (zoom out)

- **Hero line:** "**3** need you · **1** red · **6** milestones since Friday · **14** sessions running" (amber, red, then neutral numbers).
- **Usage meters** (right of the hero): Claude, Codex and Pi, each a model dot plus name plus a 44px bar in the model color plus %. Values come from T3's usage dashboard; label them as estimates.
- **Machine sections:** one card per machine.
  - **Mascot:** a cartoon laptop (pink `#ff9eb5`) or Mac mini (sky `#8fd3ff`). Its face reacts to load: smile below 55%, "o" mouth plus a sweat drop from 55%, a second drop at 85% or more.
  - **Header:** a soft machine-color gradient, then "name / model · online via T3 Connect · N agents" and a CPU or GPU bar in the machine color.
- **Rows** (sorted need → jam → move → quiet): `mode icon · name · N sessions | milestone bar + current milestone name | status word (colored) | pace arrow`.
  - The milestone bar is quiet: done segments at 42% ink, the current one in the mode color with a soft ring, todo at 12% ink.
  - Finished workspaces show `◎ goal` instead of a milestone name.
  - Click a row to zoom into that workspace.
- **"Since you last looked" feed** (right, 320px): type icon + **workspace** + text + time. Click an item to open that workspace. It needs a per-device last-seen timestamp.

### 5.8 Monitor agent and view spec

- **The monitor** is a cheap model (Haiku) that wakes on events. Never poll on a timer.
- **It composes a view spec per workspace** from a fixed block kit. There's no free-form HTML.
- **Block kit:** `map, status, interrupt, grill, answers, design, chat, jamintro, plan, sbrief, made, since, capture, engine, brief`.
- **Composition rules** (copy them from the prototype's `compose()`):
  1. map → status → interrupt (if any).
  2. Each Grill me session adds `[grill, answers]`.
  3. Each jam adds `[design, chat]`, or `[jamintro, chat]` when there's nothing to show yet.
  4. Then `plan`, beside a side column with one `sbrief` per Tell me session, plus `made` if any Autopilot session made calls on its own.

```json
{
  "workspace": "gitaway",
  "composed_by": "monitor · haiku",
  "composed_at": "22:55",
  "sessions": [{ "session": "Rail colours jam", "mode": "jam", "adds": "live board + chat" }],
  "rows": [
    { "cols": [{ "block": "map" }], "why": "the journey" },
    {
      "cols": [
        { "block": "design", "sid": "s3" },
        { "block": "chat", "sid": "s3" }
      ],
      "why": "Rail colours jam is on Jam"
    },
    {
      "cols": [
        { "block": "plan" },
        { "block": "side", "items": [{ "block": "sbrief", "sid": "s1" }] }
      ],
      "why": "milestones; Tell me briefs beside"
    }
  ]
}
```

- **Validate** specs against a JSON schema. On an invalid spec, fall back to `map, status, plan`.
- **Ship as a skill:** the monitor's prompt and rules go in a skill file (`monitor/SKILL.md`), so the block kit and rules can be edited without a code change.

### 5.9 Jam and design session

- **The design call block (in the workspace)** shows variants live side by side as iframes of the dev server, using its `previewUrl`.
- **Its actions:**
  - **Comment:** pin mode. A click finds the element under the pin by sending a `postMessage` probe into the iframe, then snaps to the nearest list item.
  - **Merge my picks:** builds variant C live.
  - **Lock in:** writes the decision into the milestone's ticket and closes the jam.
  - **⤢ Design session.**
- **Design session** is a full-body view and the heart of how the user works.

```
[← gitaway]  Design session / Day rail colours · jam in Polish        [● Claude · opus ▾] [Share] [Lock]
[tabs: ● gitaway · dev  ● Stitch  ● Claude artifact  ● Figma  ＋ open]                [▢ ◫ ▦]
┌ pane (focused shows URL) ───────────┐┌ pane ───────────────────────┐   ┌ Jam chat ────────┐
│ native page in T3 browser tab       ││                              │   │ model-labelled   │
│ [pin] [add to storyboard]           ││  "agent driving" when agent  │   │ messages, guest  │
└─────────────────────────────────────┘└──────────────────────────────┘   │ messages wait    │
[Storyboard: cartoon frames 1 → 2 → 3 → … → next]                          └──────────────────┘
```

- **Tabs are T3 in-app browser tabs** (Chromium WebContents), never re-implemented UI. Persistent partition: `persist:design` per machine, so you sign in once.
  - **Layouts:** one, split (two side by side), grid (up to four).
  - **Close (×):** shows on hover.
  - **"＋ open":** say or paste a URL.
- **The controller badge** follows T3's controller state: show "agent driving" (model dot plus pulse) when the agent controls a tab. Show nothing when you're driving.
- **Agent actions through MCP:**
  - **Stitch:** the official remote MCP (`generate_screen_from_text`, `generate_variants`, `edit_screens`, `get_screen`). Needs `STITCH_API_KEY`.
  - **Claude artifacts and Figma:** plain tabs (Figma's MCP is optional).
  - **localhost:** element picking through T3's pick preload.
- **Pins:** on cross-origin pages (Stitch, claude.ai, Figma), pins sit on a snapshot (T3's capture plus the visible text). On localhost, pins resolve to elements. Say which one in the pin tooltip.
- **Storyboard:**
  - one hand-drawn frame per step: thumbnail (snapshot), title, model dot, note;
  - added by the snapshot button or automatically after agent actions;
  - the locked frame turns pale yellow;
  - it auto-scrolls to the end;
  - on lock it's saved on the milestone, with a "replay" view later.
- **Model switch:** Claude, Codex, Gemini CLI (through ACP, from T3's ACP registry), Pi.
  - Switching hands the new model a summary, so it's lossy. Recommend delegating instead ("Codex, build what Claude planned").
  - Messages keep the model that wrote them.
  - Antigravity has only a community ACP bridge (`agy-acp`); don't ship it by default.
- **Share:** uses T3's guest share (beta, enabled per machine in Settings → Beta; runs over T3 Connect; one guest; expires after 24h; diffs hidden).
  - The popover shows the link, Copy, and Revoke.
  - Guest messages appear in the chat with a yellow outline and "waiting for you", plus `[Send] [Dismiss]`.
  - While shared, the chat header shows "● guest watching".
- **Lock:** writes the direction into the milestone's ticket (same as Lock in), adds a final storyboard frame, and closes the jam.
- **Omnibox here:** "Stitch, three more", "open the artifact next to localhost", "share with Ana", "switch to Gemini", "lock it".

### 5.10 Kit (⚙)

- **Header:**
  - "Kit / what your agents can do, and where each piece came from";
  - neutral tabs with quiet counts: **Skills · MCP · Plugins · Hooks · Weekly merge**;
  - a **context-per-session meter** (skills tokens plus MCP tokens, stacked bar).
- **Skills tab** has three columns:
  - **Sources** (left): a colored avatar per source, name, repo, and "in kit / total", plus "+ Add a source" (paste a repo, or say it).
  - **Curator** (center): Claude Code's flow, below.
  - **Your kit** (right): grouped by category, with clickable headers that filter. Each item shows its name in mono plus a source badge. Click one to open a SKILL.md viewer/editor.
- **Curator flow:**
  1. **Intro:** "4 packs, 112 skills. You need about 25."
  2. **Three questions:** week focus, which agents, duplicate rule.
  3. **Picks:** grouped by category; each has a checkbox, name, source badge, a one-line reason, and "same job as X" for duplicates. A note says how many more were skipped without asking.
  4. **Install run:** shows each real command. Installer prompts that your answers cover are answered automatically ("answered for you · …"). The rest become question cards (gstack needs Bun, pstack's reasoning budget). Name clashes are resolved by your rule, and the old copy goes to `~/.claude/skills/.trash`. It finishes with a load test in each agent.
  5. **Done:** source share as a stacked bar, then "Show my design skills".
- **Sources and installers** (one adapter each):

| Source                                | Count | Install                                                                                                                                   |
| ------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Matt Pocock (`mattpocock/skills`)     | 25    | `npx skills@latest add mattpocock/skills` (interactive: which skills, which agents); update with `npx skills update`                      |
| gstack (Garry Tan, `garrytan/gstack`) | ~31   | clone to `~/.claude/skills/gstack`, then `./setup` (needs Bun 1.0+; `--host codex` for Codex)                                             |
| pstack (poteto)                       | 47    | Cursor plugin `/add-plugin pstack` + `/setup-pstack` (asks for a reasoning budget); use the community Claude Code ports for single skills |
| tstack (Theo, `t3dotgg/tstack`)       | 9     | `cp -R tstack/skills/* ~/.claude/skills/ ~/.codex/skills/`                                                                                |
| Anthropic / Mine                      | —     | already on disk                                                                                                                           |

- **SKILL.md editor:** monospace, with Save / Cancel, "Ask Claude to change it" (fills the omnibox), and Remove (moves the skill to trash). An edit marks the skill `edited`, and future upstream updates need a 3-way merge in the Weekly merge tab.
- **MCP tab:** one row per server. Each row shows:
  - a teal kind bar, then name and vendor;
  - a plain-English "what it lets agents do", with a category dot;
  - overlap warnings (playwright overlaps gstack's qa) and suggestions (Figma for design);
  - tool count and a token-cost bar;
  - which agents use it, and an on/off switch.

  "Add" asks for credentials in a card and stores them in the macOS Keychain, never in a config file. It then tests the server.

- **Plugins tab:** the same row layout, with a note explaining why a plugin is on or off.
- **Hooks tab:** each hook is a sentence: `BEFORE / AFTER / START / STOP` (each event has a color) + "When … → then …" + source + switch. Saying "after every commit, run the tests" makes the curator draft the hook, show it as a sentence, then install it.
- **Weekly merge tab:** the ledger from section 2, with Take / Later / Skip per row, plus "Merge N now" or "let it run Friday 9:00 as a scheduled task".
- **The curator is Claude Code itself,** headless (`claude -p` or the Agent SDK), running in the user's home directory with the skill folders as context. It proposes; nothing installs without the user's OK.

### 5.11 Creation focus moment

On creating a workspace, session or design session:

1. The background content blurs (3px, 70% brightness, 450ms).
2. The new item gets an amber ring plus a 24px glow (`g3fresh`, 1.6–1.8s).
3. The blur clears.

Respect `prefers-reduced-motion`.

---

## 6. Phone (390 × 844)

- One view at a time: a list, then the workspace, with a back button. Same omnibox.
- The Kit and the design session are desktop only; phone shows a one-line note.
- The overview isn't in the phone top bar in v1.

---

## 7. Design tokens

Night theme (`.oq-root.oq-night.oq-family-dev`):

```
surface-0 #0b0b0d   surface-1 #151518   surface-2 #1d1d21   surface-3 #25252a   line #2a2a30
ink #ededef   ink-2 #a9a9b1   state rgb(237 237 239) (use at /.05–/.16 for fills)
ok #3ccf6e   warn #f5a524   bad #f2555a   info #52a9ff
font: Geist · mono: Geist Mono · cartoon only: Patrick Hand
ease-in cubic-bezier(.2,0,0,1) · spring / spring-fast: linear() curves in the prototype
radius: cards 16 · panes 12 · pills 999 · rail tiles 14
```

**The five color systems.** Use each only for its job.

1. **Modes:** Autopilot `#8b7bff` · Tell me `#52a9ff` · Grill me `#ff8a3d` · Jam `#2bc3ad`.
2. **Models:** Claude `#e07a52` · Codex `#3ecf8e` · Pi `#f5c542` · Gemini (ACP) `#7aa2ff`.
3. **Machines:** ablearn laptop `#ff9eb5` · m4-pro mini `#8fd3ff`. Used for the mascot, the header gradient and the load bar.
4. **Skill sources:** Matt `#5aa2ff` · gstack `#ff7a1a` · pstack `#b18cff` · tstack `#f43f8e` · Anthropic `#e07a52` · Mine `#e4e4e7`.
5. **Skill categories** (small dots only): Design `#ff7eb6` · Plan `#7aa2ff` · Build `#3ecf8e` · Review `#ffd166` · Test & QA `#4dd4c6` · Security `#ff5a5f` · Ship & PRs `#c3a6ff` · Debug `#ffa94d` · Guardrails `#94a3b8` · Writing `#a3e635` · Kit care `#e4e4e7`.

**Status is never conveyed by color alone.** Always pair the color with a word or an icon.

**Cartoon palette:** cream `#f7f1e3`, outline `#1c1c20` (2–2.6px), mint `#c8f0d4` (done), yellow `#ffe066` (current), dashed outline for todo, teal robot `#7ad7c9`.

---

## 8. T3 capabilities this relies on

| Need                       | T3 provides                                                                                           | Notes                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Threads, providers, models | Claude Code, Codex, OpenCode, Pi, Cursor, Grok, ACP registry                                          | Gemini CLI comes in through ACP                                 |
| Model pairs                | `delegate_task` + lineage view (Orchestrator V2)                                                      | read lineage for tab dots and the drawer chip                   |
| Agent control of threads   | T3 Code MCP server                                                                                    | the monitor and the omnibox can start, message and fork threads |
| Native tool tabs           | in-app browser: tabs, any URL, persistent partitions, snapshots, element pick, agent/human controller | design session                                                  |
| Guest links                | guest share (beta), `/guest#…` over T3 Connect                                                        | design session Share                                            |
| Machines                   | T3 Connect / SSH / Tailscale environments                                                             | overview sections                                               |
| Usage                      | local usage dashboard (Codex, Claude, Grok)                                                           | overview meters (estimates)                                     |
| Scripts / preview          | `t3.json` scripts + `previewUrl`                                                                      | jam variants and the localhost tab                              |
| PR events                  | PR watches                                                                                            | feed items                                                      |
| Scheduling                 | scheduled tasks                                                                                       | Friday merge, monitor wakeups                                   |

**Gaps to build as canvas extensions:** goal/milestones/tickets storage; per-session mode; the monitor and its view specs; the storyboard; Kit adapters and the curator; voice back (TTS).

---

## 9. Phases and acceptance criteria

**P0 · Scaffold**

- Canvas folder, the `canvas.enabled` setting, the mount points doc, the repo map, tokens as CSS variables, and an empty shell with the top bar, rail and omnibox.
- _Done when:_ stock T3 is unchanged with the flag off, and the canvas shell renders with it on.

**P1 · Workspace and sessions**

- Rail (amber dot, mode badge, groups), session tabs (mode icon, model dots, status word), milestones checklist with tickets, and per-session mode with the popover.
- _Done when:_ changing a session's mode updates the tab, the omnibox tag and the drawer edge within one frame. The Grill me, Tell me and Jam blocks appear and disappear by mode.

**P2 · Omnibox and drawer**

- Routing, the target chip, the drawer chat bound to the real T3 thread, and the commands in 5.5.
- _Done when:_ "skip docs this release" on omxcore routes to Docs refresh, and "the token's in 1Password, run the setup script" routes to Publish.

**P3 · Monitor and view specs**

- Haiku monitor skill, schema validation, fallback, and an event-driven recompose.
- _Done when:_ toggling modes recomposes rows exactly as in `compose()`, and an invalid spec falls back to map, status, plan.

**P4 · Journey map**

- SVG map, robot states, hop animation, jam clouds, replay.
- _Done when:_ completing the last ticket of the current milestone hops the robot to the next sticker.

**P5 · Overview**

- Hero line, usage meters, machine sections with mascots, quiet rows, feed, `o` key, click to zoom in.
- _Done when:_ every workspace on both machines fits on one 1440×900 screen without scrolling.

**P6 · Design session**

- T3 browser tabs with the `persist:design` partition, layouts, pins (snapshot vs element), storyboard, model switch, guest share, lock.
- _Done when:_ Stitch and a claude.ai artifact open signed in after the first login, side by side with localhost, and the agent can add Stitch variants through MCP while the tab shows "agent driving".

**P7 · Kit**

- Sources, curator (headless Claude Code), per-pack install adapters with prompt passthrough, kit list, SKILL.md editor, MCP/Plugins/Hooks tabs, Weekly merge ledger.
- _Done when:_ a fresh machine reaches about 25 curated skills from four packs without touching a terminal, and every interactive installer prompt is either answered automatically or shown as a card.

**P8 · Voice and polish**

- Hex input, voice back (three states), focus moment everywhere, reduced motion, phone pass.

---

## 10. Tests (Playwright, mirror the prototype)

1. **Walkthrough:** `?` starts the tour; stepping through it reaches every mode with no console errors.
2. **Routing:** the two P2 sentences route correctly; the target chip pins and unpins.
3. **Overview:** `o` toggles it; clicking the omxcore row zooms into omxcore.
4. **Kit:** run the curator → install, answering Bun = install and budget = Medium → kit shows 25 skills → the Design filter lists 6 → editing a SKILL.md marks it `edited` → adding Figma in MCP asks for a token.
5. **Design session:** open from the jam → "Stitch, three more" adds three variants and one storyboard frame → pin on localhost → switch to Gemini (earlier messages keep the Claude label) → share, then a guest message waits → open Figma (sign-in card) → grid layout → lock writes the ticket and adds the final frame.
6. **Regression:** class names must not collide. The prototype hit three collisions, all now fixed: `.big`, `.g3-ov` and `.g3-pv` (the model badge was renamed `.g3-pvd`). Use CSS modules or a `cv-` prefix.

---

## 11. Risks and open questions

- **Milestone % is a guess:** it's tickets done ÷ planned, so it jumps when tickets are added. Decide whether you want honest jumps or a smoothed number.
- **The status word is a judgment call:** every word should open the evidence behind it.
- **"Since you last looked"** needs a last-seen time per device.
- **Talking to all workspaces** needs a preview ("this will touch 4 workspaces") before it runs.
- **Embedded sign-in:** Google sign-in can block embedded browsers. Test Stitch's login in T3's preview first.
- **Cross-origin pins** are pins on a picture.
- **Model switching is lossy;** prefer delegating.
- **Installers:**
  - There's no common format across packs.
  - Interactive prompts can change between versions, so pin versions.
  - Show what any skill or hook will execute before installing.
- **Name clashes:** `tdd`, `grill-me` and `teach` exist in several packs, and "Grill me" is also a mode. Use prefixes or aliases.
- **Context cost:** skill descriptions plus MCP tools load into every session, and the meter's numbers must be measured, not estimated.
- **Memory:** four live tool tabs plus agents on a MacBook. Pause hidden tabs.
- **Guest share is beta:** one guest, 24h, T3 Connect only.

---

## 12. Prompt to paste into Claude Code

> Read `ONE-WINDOW-SPEC.md` in full and open `reference/one-window-prototype.html` (section C3). This is a UI-layer-only canvas for our T3 Code fork, and upstream must stay mergeable weekly. First explore the repo and write `docs/canvas/repo-map.md` (spec concept → real module) and `docs/canvas/mount-points.md`. Then propose a phased plan matching section 9, with the files you'll add and the few upstream files you'll touch. Don't write feature code until I approve the plan. Everything goes behind `canvas.enabled`. After each phase, run the section 10 flows with Playwright and show screenshots.

---

### Sources

- T3 Code v0.1.0 (Orchestrator V2, providers, MCP): https://mwolson.org/blog/2026-10-15-t3-code-v0-1-0-orchestration-and-beta/
- Orchestrator V2 details: https://aicoder.com/news/news-20261003-t3code-orchestrator-v2
- T3 Code releases: https://github.com/pingdotgg/t3code/releases
- Guest share PR: https://github.com/pingdotgg/t3code/pull/24104
- In-app browser and snapshots: https://deepwiki.com/pingdotgg/t3code/4.4-in-app-browser-preview-and-snapshots
- T3 Code deep dive: https://flaviocopes.com/t3-code/
- Stitch MCP: https://aiidelist.com/blog/stitch-mcp-server-guide.md
- Gemini CLI ACP: https://geminicli.com/docs/cli/acp-mode/
- Hex (Voice Action removal, 3.0): https://github.com/anomalyco/hex/pull/423
- mattpocock/skills: https://mer.vin/news/mattpocock-skills-the-skill-pack-topping-github-trending/
- gstack: https://codex.danielvaughan.com/2026/03/30/gstack-garry-tan-production-skills-toolkit/
- pstack: https://www.webreactiva.com/blog/pstack-skills-cursor
- tstack: https://github.com/t3dotgg/tstack
