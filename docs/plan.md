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

- **Status:** doing
- **What:** replace the "T3 Code" wordmark and logo in the web app (sidebar header, splash/empty states, tab title, PWA manifest name) with an **abode** wordmark, with "ab" highlighted the way T3 highlights "T3". Keep "Huge thanks to T3" credit in About/Settings.
- **Acceptance:**
  - [ ] No visible "T3 Code" branding in the web UI's chrome.
  - [ ] The About section credits T3 Code.

### F-020: Opaque chat surface

- **Status:** doing
- **What:** in the abode theme, the chat column gets an opaque surface distinct from the app background (no see-through glass), like VS Code's editor area.
- **Acceptance:**
  - [ ] The chat area reads as its own panel in the abode theme. Other themes are unchanged.

### F-021: Show which agent is listening

- **Status:** doing
- **What:** like VS Code's agent mode, the composer shows the agent type the main session runs as, e.g. "Orchestrator · Opus 5.5", from Claude's `agent` setting or launch args. It's pickable from the workspace's Agent types. Default is the plain Claude Code agent.
- **Acceptance:**
  - [ ] Choosing "orchestrator" makes the next Claude session run as that agent.
  - [ ] The label shows it.
  - [ ] Any server or contract change is add-only.

### F-022: Branch and worktree info inside the composer toolbar

- **Status:** doing
- **What:** remove the separate strip under the composer (branch, checkout, environment, worktree) and fold its controls into the composer's own footer next to the runtime-mode picker ("Full access"). No information is lost.
- **Acceptance:**
  - [ ] Every control from the strip is reachable from the composer footer.
  - [ ] There's no second bar.
  - [ ] It works at phone width.

### F-023: Live voice transcription

- **Status:** doing
- **What:** while recording, show interim text in the composer (muted) as you speak, updated about every second. Release finalizes it.
- **Acceptance:**
  - [ ] Words appear while speaking.
  - [ ] Final text replaces the interim text.
  - [ ] Esc removes it.
  - [ ] The UI never blocks.

### F-012: A week of daily use

- **Status:** todo
- **Depends on:** F-002 to F-011 (phase 2b can follow)
- **What:** run all Claude sessions in abode for a week, and note friction in `docs/lessons.md`.
- **Acceptance:**
  - [ ] Abhishek says it replaced the terminals, or lists what stopped it. Then plan phase 3 (mobile via Tailscale).
