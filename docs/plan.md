# abode plan (phases 1–2)

<!--
Format: one ticket per vertical slice, each independently shippable.
Status: todo | doing | blocked (one line: what Abhishek must do) | review | done
Commit after each passing slice: "F-00N: <what changed>". A ticket is done only after the reviewer passes it.
Brief: docs/brief.md. Rule: server/contract changes are add-only.
-->

## Phase 0: remote before the LA trip (deadline 2026-10-02)

Order for the next 24 hours: M-001, then M-002, then F-001 to F-003 (voice), then F-004 (design, reviewed from the phone). The rest of phase 2 is built from LA.

### M-001: abode runs as an always-on host

- **Status:** doing
- **What:**
  - A pinned build of abode, in its own checkout separate from the working copy, runs as a systemd user service.
  - Its own home is `~/.abode`, seeded with a `VACUUM INTO` snapshot of `~/.t3/userdata`. The installed T3 data is never touched.
  - It's reachable over Tailscale HTTPS.
  - One update command builds a commit, restarts the service and health-checks it, and **automatically rolls back** to the previous build if the check fails. There's no backup host (Abhishek's choice), so a bad update must never leave it down.
- **Acceptance:**
  - [ ] The service survives a reboot and logout (lingering is on), and restarts itself if it crashes.
  - [ ] Agents editing and restarting the dev working copy don't affect the host.
  - [ ] Updating to a deliberately broken commit rolls back by itself, and the host stays reachable.
  - [ ] Every agent can run the update command from a thread, so changes can ship from the phone.

### M-002: Pair the phone (needs Abhishek, about 20 minutes)

- **Status:** blocked (Abhishek: run the Tailscale/lid command from the chat, install Tailscale + T3 Code on the phone)
- **Depends on:** M-001
- **What:** the steps only Abhishek can do:
  - install Tailscale on the laptop (sudo) and sign in;
  - install Tailscale and the T3 Code app on the phone, signed in to the same account;
  - set the lid and idle behavior so the laptop doesn't suspend while plugged in;
  - pair the phone with abode.
    Walked through with the `wizard` skill.
- **Acceptance:**
  - [ ] On cellular, with Wi-Fi off, the phone opens abode, starts a Claude thread in a project, and sees it finish.
  - [ ] With the lid closed and plugged in, the laptop stays reachable for 30 minutes.

## Phase 1: voice

### F-001: Voice spike, deciding whether in-app speech is good enough

- **Status:** review (reviewer PASS, merged; needs a real-app check with your voice)
- **What:**
  - Throwaway prototype: Whisper (base.en or small.en) and Moonshine via transformers.js, running in the desktop app's renderer on this laptop. Use WebGPU if it's available, otherwise WASM.
  - Record five real prompts, say 5–20 seconds each, with project names and code words like "worktree", "fh-saas" or "pixi".
  - Use the `prototype` skill. No code is kept.
- **Acceptance:**
  - [ ] Report back: model sizes, first-load time, and transcription time for a 10-second clip.
  - [ ] Show the five transcripts next to what was actually said.
  - [ ] Recommend a model. Or, if nothing gets under about 2 seconds for a 10-second clip with usable accuracy, recommend falling back to whisper.cpp, and Abhishek decides.

### F-002: Dictate into the composer

- **Status:** review (reviewer PASS, merged; needs a real-app check with your voice)
- **Depends on:** F-001
- **What:** a mic button in the composer, plus a hold-to-talk key. The speech is transcribed locally and inserted at the cursor; nothing is sent until Abhishek presses Enter. Works in desktop and web.
- **Acceptance:**
  - [ ] Hold the key or tap the mic, speak, release, and the text appears in the composer within the F-001 target time.
  - [ ] On first use, the model downloads with visible progress. After that it works with the network off.
  - [ ] While recording, there's a clear indicator with no continuously repainting animation.
  - [ ] Mic permission denied, download failed, and an empty result each show a one-line message, and the composer stays usable.
  - [ ] Esc cancels a recording without inserting anything.
  - [ ] Unit tests cover the recording state machine (idle → recording → transcribing → idle, and cancel/error).

### F-003: Voice settings

- **Status:** review (reviewer PASS, merged; needs a real-app check with your voice)
- **Depends on:** F-002
- **What:** a Voice section in Settings with: on/off, the hold-to-talk key (rebindable through the existing keybindings), and the downloaded model's size with a Delete button.
- **Acceptance:**
  - [ ] Turning voice off hides the mic button and disables the key.
  - [ ] Deleting the model frees its storage, and the next use downloads it again.
  - [ ] The key can be changed and persists across restarts.

## Phase 2: VS Code polish

### F-004: Design the main window

- **Status:** done (option B confirmed in comments; round 2 applied)
- **What:** artboards made with the `designer` skill, in VS Code Dark Modern structure with workspace accent colors, covering:
  - the colored workspace tree with threads and nested subagents;
  - the workspace and harness dropdowns;
  - the title-bar panel toggles;
  - the bottom-left customizations list;
  - the side panel with its Editor and Browser tabs, open and closed.
- **Acceptance:**
  - [ ] Abhishek approves the artboards. (Pre-approved on 2026-10-01: "as long as you're close to VS Code in terms of design, I approve it." Review happens in the morning.)
  - [ ] A short handoff is written for F-005 to F-011.

### F-005: abode theme

- **Status:** done
- **Depends on:** F-004
- **What:** a VS Code Dark Modern–style palette and density, added as a new built-in theme in its own file and registered with a small hook. Selectable in Settings → Appearance and set as the default.
- **Acceptance:**
  - [ ] Matches the F-004 artboards for colors, spacing and radii.
  - [ ] Switching back to a T3 theme still works.
  - [ ] Contrast checks pass.

### F-006: Workspace colors

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **Note:** T3's default sidebar is a flat inbox. The colored workspace tree is the "Legacy sidebar" in Settings. Making it the default means changing an existing contract default, which needs Abhishek's OK.
- **Depends on:** F-005
- **What:** each project gets an accent color assigned automatically from a palette, editable from the project's context menu. The color shows on the project row, its threads and the chat header. It's stored on the client only.
- **Acceptance:**
  - [ ] New projects get distinct colors.
  - [ ] Changing a color updates every place it shows immediately and persists.
  - [ ] "Reset color" returns to the auto color.
  - [ ] Projects stay collapsible and expandable.

### F-007: VS Code panel toggles

- **Status:** done
- **Depends on:** F-005
- **What:** title-bar toggle buttons for the sidebar, bottom terminal and side panel, with Ctrl+B, Ctrl+J and Ctrl+Alt+B (and their Cmd equivalents). The side panel is closed by default.
- **Acceptance:**
  - [ ] Each key and button opens and closes its panel, and the state survives a reload.
  - [ ] Keys that conflict with existing T3 bindings are resolved and listed in the commit.
  - [ ] The command palette has matching toggle commands.

### F-008: Subagents in the sidebar

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **Depends on:** F-005
- **What:** running subagents nest under their thread with a live status dot. Clicking one opens the existing Agents tab, focused on it. Finished subagents collapse away.
- **Acceptance:**
  - [ ] With a real Claude turn that spawns two subagents, both appear under the thread while running and clear when done.
  - [ ] Clicking one opens its activity.
  - [ ] No extra WebSocket traffic: it uses data the client already has.

### F-009: Workspace and harness pickers above the composer

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **Depends on:** F-005
- **What:** for a new thread, two compact dropdowns above the composer, one for the workspace and one for the harness (Claude, plus Codex when available). Reuse the existing environment and provider pickers where they exist.
- **Acceptance:**
  - [ ] Starting a thread from any view lets you pick the workspace and harness in two clicks.
  - [ ] The same works from the command palette and the new-thread keybinding.

### F-010: Customizations service (server, add-only)

- **Status:** done
- **What:** one new service with new RPC methods (it alters nothing existing):
  - It lists Claude **skills, agents, MCP servers and instructions** for a workspace. Each entry has a name, a file path and a scope: user (`~/.claude/…`, `~/.claude.json`) or workspace (`.claude/…`, `.mcp.json`, `CLAUDE.md`).
  - It reads and saves those files.
  - Writes are allowed only inside those roots, checked after resolving symlinks.
  - MCP entries expose only server names and the file to open; values like `env` and `headers` are never sent.
- **Acceptance:**
  - [ ] Focused tests: listing finds user and workspace items.
  - [ ] A write outside the allowed roots (`..`, absolute paths, symlink escapes) is rejected.
  - [ ] Saving through an allowed path works.
  - [ ] MCP secrets never appear in the response.
  - [ ] Existing contracts are unchanged (the diff only adds).

### F-011: Customizations list and side-panel editing

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **Depends on:** F-005, F-010
- **What:** a bottom-left list of Skills, Agents, MCP servers and Instructions, grouped as User or Workspace. Clicking an item opens its file in the side panel's Editor tab, with a lock toggle (read-only on or off). Markdown also renders in the Browser tab.
- **Acceptance:**
  - [ ] Editing and saving a workspace skill shows up in Claude after a session restart.
  - [ ] When locked, the file can't be edited; unlocking allows editing again.
  - [ ] User-wide and workspace items are visibly distinct.
  - [ ] An empty state links to creating the first skill or agent.

## Phase 2b: from Abhishek's mockup comments (2026-10-02)

Mockup version 3 shows all of these. Each ticket starts by checking what T3 already has (it already ships plan, question and tool cards, token usage, Claude usage limits and checkpoint revert) and restyles or reuses before building anything new.

### F-013: Simple / Detailed transcript

- **Status:** review (reviewer PASS, merged; needs a real-app check. Card restyle toward the mockup is not done yet.)
- **Depends on:** F-005
- **What:** a Simple/Detailed toggle in the chat header, remembered globally.
  - Simple shows only messages and the rich cards: plan checklist, questions with clickable options, a "done" summary with files changed and test results, and subagents.
  - Detailed also shows every tool call (expandable), inline diffs and subagent detail.
  - Everything is formatted HTML, never terminal text.
- **Acceptance:**
  - [ ] A real Claude turn reads like a report in Simple and shows every tool call in Detailed.
  - [ ] Questions are answerable from the card.
  - [ ] The toggle is also in the command palette.

### F-014: Context meter

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** "Context 38% · 76k / 200k" with a thin bar in the composer footer, using the existing thread token usage. It turns amber near the limit; clicking it offers /compact.
- **Acceptance:**
  - [ ] It matches Claude's own context figure for the thread and updates after each turn, with no extra WebSocket traffic.

### F-015: Usage limits by window

- **Status:** review (reviewer PASS, merged; needs a real-app check against `claude /usage`)
- **What:** the status bar shows the limit closest to running out with its absolute reset time ("5h 42% · resets 3:40pm"). Clicking it opens a popover with a row per window: session 5h, weekly all models, weekly per model, and monthly spend where a provider has one. Amber at 80%, red at 95%.
- **Acceptance:**
  - [ ] The figures match `claude /usage` for the same account.
  - [ ] It's reachable on web and desktop.

### F-016: Edit a prompt and ask about anything

- **Status:** review (reviewer PASS, merged; needs a real-app check: palette → restore dialog focus, button overlap)
- **What:**
  - Hover your own message to Edit it, which rewinds to that checkpoint and re-runs. The edit is marked in history.
  - Hover any agent card or selected text to "Ask about this", which quotes it into the composer.
- **Acceptance:**
  - [ ] Editing restores files to that checkpoint and re-runs.
  - [ ] The quoted reference is sent with the next prompt and can be removed.

### F-017: Provider tint and clear agent names

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:**
  - The harness/model picker gets a faint provider tint: Claude orange `#d97757` at about 12%, and Codex its own.
  - Names are made distinct: the sidebar "Agents" (threads), "Agent types" under Customizations, and the side panel tab "Subagents".
- **Acceptance:**
  - [ ] The tint matches the mockup.
  - [ ] All three labels are renamed everywhere they appear: sidebar, tab, command palette and settings.

### F-018: Codex conventions in Customizations (deferred until there's a Codex subscription)

- **Status:** todo
- **What:** tag each customization with its source (Claude Code or Codex) and use that tool's real paths and frontmatter:
  - Codex skills: `~/.codex/skills/`
  - Codex prompts: `~/.codex/prompts/`
  - Codex instructions: `AGENTS.md`
  - Codex MCP: `[mcp_servers]` in `~/.codex/config.toml`

## Phase 2c: Abhishek's first real-app feedback (2026-10-02)

### F-019: abode branding

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** replace the "T3 Code" wordmark and logo in the web app (sidebar header, splash/empty states, tab title, PWA manifest name) with an **abode** wordmark, with "ab" highlighted the way T3 highlights "T3". Keep "Huge thanks to T3" credit in About/Settings.
- **Acceptance:**
  - [ ] No visible "T3 Code" branding in the web UI's chrome.
  - [ ] The About section credits T3 Code.

### F-020: Opaque chat surface

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** in the abode theme, the chat column gets an opaque surface distinct from the app background (no see-through glass), like VS Code's editor area.
- **Acceptance:**
  - [ ] The chat area reads as its own panel in the abode theme. Other themes are unchanged.

### F-021: Show which agent is listening

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** like VS Code's agent mode, the composer shows the agent type the main session runs as, e.g. "Orchestrator · Opus 5.5", from Claude's `agent` setting or launch args. It's pickable from the workspace's Agent types. Default is the plain Claude Code agent.
- **Acceptance:**
  - [ ] Choosing "orchestrator" makes the next Claude session run as that agent.
  - [ ] The label shows it.
  - [ ] Any server or contract change is add-only.

### F-022: Branch and worktree info inside the composer toolbar

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** remove the separate strip under the composer (branch, checkout, environment, worktree) and fold its controls into the composer's own footer next to the runtime-mode picker ("Full access"). No information is lost.
- **Acceptance:**
  - [ ] Every control from the strip is reachable from the composer footer.
  - [ ] There's no second bar.
  - [ ] It works at phone width.

### F-023: Live voice transcription

- **Status:** review (reviewer PASS, merged; needs a real-app check with your voice)
- **What:** while recording, show interim text in the composer (muted) as you speak, updated about every second. Release finalizes it.
- **Acceptance:**
  - [ ] Words appear while speaking.
  - [ ] Final text replaces the interim text.
  - [ ] Esc removes it.
  - [ ] The UI never blocks.

## Phase 2d: visual pass (mockup https://claude.ai/artifact/WBU6qkLY4z9Mh2MHDykJW7, docs/design/visual-pass.html)

### F-024: Compact workspace list (option B)

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:**
  - Each workspace header is one compact block:
    - a ▾/▸ chevron;
    - colored initials;
    - the name;
    - its location on a second line ("~/Projects/x", prefixed with the machine name when it isn't this laptop);
    - a status pill on the right (running/waiting/failed) that stays visible when collapsed.
  - Each workspace shows its two latest threads, plus "+N older", which expands the rest.
- **Acceptance:**
  - [ ] It takes noticeably less vertical space than today.
  - [ ] Collapse and expand persist.
  - [ ] The location is correct for local and remote environments.

### F-025: Colorful sidebar footer (list style)

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** footer rows, each with its own colored icon tile:
  - Pull requests (green);
  - Claude usage (amber, "5h 42% used · resets 3:40pm" plus a meter, replacing F-015's line);
  - Customizations (pink, count);
  - Phone and remote (coral);
  - Settings (blue). Open-PR count, paired count and the ⌘, hint are deferred follow-ups.
- **Acceptance:**
  - [ ] All five are reachable and colored as in the mockup.
  - [ ] Nothing is lost from the old footer.

### F-026: Project welcome

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** a new thread in a project greets you with:
  - a vibrant title: an emoji, "What should we build in <Project>?", and the project name in a gradient;
  - the README tagline;
  - location, machine and branch chips;
  - four emoji starter cards (add a feature, fix a bug, explain the code, pick up the last thread).
- **Acceptance:**
  - [ ] It reads the README via the existing file RPC, with no new server code.
  - [ ] It falls back gracefully without a README.
  - [ ] Starter cards prefill the composer.

### F-027: Composer chips with meaning

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** subtle semantic tints:
  - Full access: coral with ⚠;
  - Auto-accept edits: amber;
  - Ask first: green;
  - main/master branch: purple;
  - feature branch: blue;
  - worktree: teal;
  - provider: orange, as now;
  - Send: blue.
- **Acceptance:**
  - [ ] Each mode and branch state shows its tint.
  - [ ] It's done with variants, not className restyles.
  - [ ] Contrast passes.

## Phase 2e: Fluent window (docs/design/fluent.md; mockup https://claude.ai/artifact/8WdcZeJY48ZQtmJAnhVidu)

It replaces the visual pass where they differ: one-line sidebar rows, the blue branch chip, and the Account footer.

### F-028: Activity bar, Fluent sidebar and palette

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:**
  - a 48px activity bar;
  - "Workspaces" with one-line rows and 22px thread rows with the selection style;
  - the Account footer, with Settings moved to the activity bar;
  - the Fluent tokens (one blue, amber waiting, red risk, square dots, 2px radius, Segoe/Consolas) for the abode theme, including the branch chip going blue.
- **Acceptance:**
  - [ ] Matches fluent.md.
  - [ ] Nothing reachable before becomes unreachable.

### F-029: Fluent transcript

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** avatar rows, ✓/◐ step lists, an inline diff block style, and an amber ask block with action buttons, by restyling the existing timeline items.
- **Acceptance:**
  - [ ] A real Claude turn renders like the mockup in Simple mode.
  - [ ] Detailed mode still shows everything.

### F-030: Drawers and status bar

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:**
  - Bottom panel tabs (Terminal / Output, plus Problems only if a real source exists) with a ⌄ close.
  - Right drawer VS Code tabs with a › close.
  - A new 22px status bar with branch, project · host, running and needs-you counts, panel toggles, model, ctx % and Max %.
  - The title bar gets a centered search box that opens the palette.
- **Acceptance:**
  - [ ] Every toggle works from the title bar, the status bar, the drawer header and the keys.
  - [ ] There are no fake counts.

### F-031: Threads as editor tabs (deferred until after the trip)

- **Status:** todo
- **What:** threads open as tabs beside files in one editor group, and can be split.

### F-032: Autonomous mode

- **Status:** review (reviewer PASS, merged; needs a real-app check with a real Claude run)
- **What:**
  - An Autonomous toggle per thread. When a Claude turn ends without a done signal (or with a question), abode replies with a continue nudge: "make reasonable assumptions, log open questions in docs/plan.md, end with your done signal". It's capped (e.g. 30 continues).
  - The thread and sidebar show its state.
  - It works from the phone, so the official app sending a turn keeps the setting.
- **Acceptance:**
  - [ ] It keeps going until done or the cap.
  - [ ] The user can stop it at any time.
  - [ ] Any contract change is add-only.

## Phase 2f: Abhishek's core loop (2026-10-02)

### F-033: Each workspace has its own right drawer (changed files plus browser)

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **Follow-ups:** keep the record's terminalOpen when a thread has no terminal sessions; confirm staged deletions appear in the Diff tab scope.
- **What:**
  - Switching to a workspace restores that workspace's right drawer: open or closed, the active tab, and its own browser at that app's URL.
  - A Changes view lists the files changed in the workspace; click one to open it in the editor tab.
  - Each workspace keeps its own browser session and URL (auto-detected from the workspace's dev server if T3 already does that, otherwise the last URL used there).
- **Acceptance:**
  - [ ] Switching between two workspaces swaps the files and the browser.
  - [ ] Both drawers can be closed, and the closed state is remembered per workspace.

### F-034: Delight and fonts

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:**
  - Fonts: Inter (UI) and JetBrains Mono (code), bundled and OFL-licensed, so they're the same on every platform and work offline.
  - Whimsy, every piece one-shot and never looping, respecting reduced-motion, with Settings → Appearance → "Little delights" to turn it off:
    - a ☕ in the status bar at 3pm with a one-time steam puff;
    - a time-of-day greeting on the project welcome;
    - a small sparkle when an autonomous run ends with done;
    - "ship it 🚢" on Friday afternoons (from 15:00);
    - an "All done ✨" toast when an autonomous run finishes.
- **Acceptance:**
  - [ ] Nothing animates continuously.
  - [ ] The toggle turns all of it off.
  - [ ] The fonts load with no network.

## Phase 2g: simplify to the agents-window reference (2026-10-02)

Reference: `docs/design/ref-agents-window.png` (VS Code agents window). Current state: `docs/design/current-abode-2026-10-02.png`, `docs/design/current-agent-menu-2026-10-02.png`. Simplify: no extra chrome. Anything that doesn't fit goes under one ⋯ menu or Settings.

### F-035: Sessions sidebar (the default)

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:**
  - **Header:** "Sessions", with New (Ctrl+N), filter and search.
  - **Sections:**
    - Automations (autonomous threads);
    - Pinned (if T3 supports pinning);
    - Chats (no-project threads);
    - then each project as a folder with its sessions: the title, and a meta line of folder icon · time, or +N −M · time.
  - **Bottom:** an always-visible "Customizations" list (MCP Servers, Skills, Instructions, Agents, Hooks; Plugins if Claude reports them), with counts. Clicking one opens it.
  - The Account footer is removed.
  - Abhishek approved (2026-10-02) making the project-grouped sidebar the default. That's a one-line change to an existing contract default (`legacySidebarEnabled`), and only abode clients read it. Re-check it on every upstream merge.
- **Acceptance:**
  - [ ] A fresh browser shows this sidebar.
  - [ ] It matches the reference.

### F-036: The icon bar holds the account items

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** the left rail has Sessions and Search at the top, and at the bottom Pull requests, Claude Max usage (a meter in the tooltip, with a popover), Phone & Remote, and Settings.

### F-037: Simple top bar

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:**
  - **Left:** sidebar toggle and back/forward.
  - **Center:** one box showing the workspace (or "New session"), which opens the palette.
  - **Next to it:** ▷ run (project actions) and open-in-editor.
  - **Right:** bottom/right panel toggles, remote, and a ⋯ menu with Simple/Detailed, Add action, Initialize, and Open in….
  - The breadcrumb and the duplicate search box are removed.

### F-038: Status bar hidden by default

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** a Settings → Appearance switch "Show status bar", default off. Its info lives in the icon bar and the top bar.

### F-039: Composer like the reference

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:**
  - Workspace and harness pickers sit above the box.
  - Inside the box: the input, +, agent and model.
  - Below the box, as a plain-text row with no box: access mode (Ask Before Edits / Full access in red), New Worktree / worktree, and the branch.
  - Picker menus are compact: max ~360px, two-line clamped descriptions, anchored to their trigger, never full width.

### F-040: Right drawer with Changes | Files tabs

- **Status:** review (reviewer PASS, merged; needs a real-app check)
- **What:** two top tabs: Changes (F-033's list) and Files (the tree). Browser, Diff and Editor stay as the existing tabs or modes.

## Phase 2h: final simplification (2026-10-02 late)

Screenshot: `docs/design/current-abode-2026-10-02-late.png`. Reference: `docs/design/ref-agents-window.png`.

**Vocabulary:** a workspace is a project folder; a session (T3 calls it a thread) is a conversation inside a workspace.

### F-041: Clean canvas

- **Status:** doing
- **What:**
  - A new session in a workspace shows only the title "What should we build in <workspace>?" (the greeting line may stay, small).
  - Removed:
    - the starter cards;
    - the path, host and branch chips;
    - the "Ship it Friday" chip;
    - the thread count;
    - "or start without a project".
  - Nothing overlaps the top bar.

### F-042: One sidebar: workspaces with their sessions

- **Status:** doing
- **What:**
  - Always render the workspace-grouped Sessions sidebar: remove the inbox mode and its setting from the UI. The contract field stays and is ignored.
  - The header reads "WORKSPACES".
  - Remove the left icon rail and the ACCOUNT footer.

### F-043: Customizations as folders, with +

- **Status:** doing
- **What:**
  - The always-open Customizations section has folders: Skills, Agents, Instructions, MCP Servers.
  - Click a file to open it in the editor.
  - Click + on a folder to open a dialog:
    - name;
    - harness (Claude / Codex);
    - scope (this workspace / all workspaces);
    - a pre-filled template with the right front matter.
  - Save writes the file to that harness's real location and opens it.
  - Codex locations (`~/.codex/skills/<name>/SKILL.md`, `~/.codex/prompts/<name>.md`, `AGENTS.md`) need an add-only extension of the server write allowlist.

### F-044: Quiet top bar with account icons

- **Status:** doing
- **What:**
  - Remove the search button (the centre box and Ctrl+K stay).
  - Top-right small flat icons: Pull requests, Claude Max usage (popover), Phone & Remote, Settings.
  - VS Code-like flat icon buttons: no borders, 16px icons, subtle hover.

### F-012: A week of daily use

- **Status:** todo
- **Depends on:** F-002 to F-011 (phase 2b can follow)
- **What:** run all Claude sessions in abode for a week, and note friction in `docs/lessons.md`.
- **Acceptance:**
  - [ ] Abhishek says it replaced the terminals, or lists what stopped it. Then plan phase 3 (mobile via Tailscale).
