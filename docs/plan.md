# abode plan: rebuild on upstream nightly (branch `abode-next`)

<!--
Format: one ticket per vertical slice, each independently shippable.
Status: todo | doing | blocked (one line: what Abhishek must do) | review | done
Commit after each passing slice: "A-00N: <what changed>". A ticket is done only after the reviewer passes it.
Brief: docs/brief.md. Strategy and hook rules: docs/upstream-sync.md (read it first).
The first fork's plan (F-001..F-052) is on branch `main` in docs/plan.md; its code is the reference for porting:
read it with `git show main:<path>`. Port behavior, not diffs: upstream's APIs moved a lot since 2026-10-01.
-->

## Rules for every ticket

- New code goes in `apps/web/src/abode/<area>/` (server: `apps/server/src/abode/`, contracts: `packages/contracts/src/abode*.ts`).
- Edits to upstream files are hooks: a few lines each, marked with an `abode:` comment, and added to the hook table in `docs/upstream-sync.md`. Keep `scripts/abode/hook-report.sh` under budget.
- Never edit orchestration, providers, persistence, projections, or existing contract fields/defaults.
- Tests: `cd apps/web && vp test run src/abode/...` (or the server package equivalent). Typecheck the package you touched. No repo-wide checks, no dev servers.

## Phase A: the engine is upstream, the skin is abode

### A-001: Sync strategy and tooling

- **Status:** done
- **What:** `docs/upstream-sync.md`, `scripts/abode/sync-upstream.sh`, `scripts/abode/hook-report.sh`; branch `abode-next` from `v0.0.46-nightly.20261011.2955`.

### A-002: abode theme and fonts

- **Status:** review (reviewer PASS, merged. 2026-10-11: Amber palette (default), flat Azure theme, Omarchy follow via hook; fonts use upstream Typography. Needs Abhishek to look)
- **What:**
  - The VS Code Dark Modern palette from the first fork (`git show main:packages/shared/src/abodeTheme.ts`, tokens in `docs/design/fluent.md`) becomes a built-in theme called "abode" in upstream's theme system, with dark and light variants.
  - abode is the default theme when the user has never picked one. A theme picked later in Settings › Appearance wins.
  - Inter for UI and JetBrains Mono for code, bundled through `@fontsource-variable`.
  - Density, 2px radii and other structural tweaks that a theme can't express go in `apps/web/src/abode/abode.css`, imported once from `main.tsx`.
- **Upstream files it may touch:** `packages/shared/src/themePalettes.ts`, `apps/web/src/main.tsx`, `apps/web/package.json`, and `apps/web/src/themePalette.ts` only if the default needs a hook.
- **Acceptance:**
  - [ ] "abode" shows in Settings › Appearance and can be switched to and away from.
  - [ ] A fresh profile starts on abode; an existing theme choice is kept.
  - [ ] A test covers the default-theme rule.
  - [ ] The hook report stays under budget.

### A-003: Customizations service (server, add-only)

- **Status:** done (reviewer PASS, merged; live server check pending)
- **What:** port the first fork's Customizations service (`git show main:apps/server/src/customizations/Customizations.ts` and `main:packages/contracts/src/customizations.ts`) to `apps/server/src/abode/` and `packages/contracts/src/abodeCustomizations.ts`. It lists Claude skills, agents, MCP servers and CLAUDE.md files (user-wide and per workspace), and reads and writes them only inside `~/.claude/` and a workspace's `.claude/`, `.mcp.json` and `CLAUDE.md`. Same three RPCs (`customizations.list`, `.readFile`, `.writeFile`) and the same auth scopes.
- **Upstream files it may touch:** `packages/contracts/src/rpc.ts`, `packages/contracts/src/index.ts`, `apps/server/src/ws.ts`, `apps/server/src/auth/RpcAuthorization.ts`.
- **Acceptance:**
  - [ ] The first fork's service tests pass against the V2 server.
  - [ ] Writes outside the allowed paths are refused (tested).
  - [ ] Contracts are add-only: no existing field, default or method changes.

### A-004: Voice dictation

- **Status:** review (reviewer PASS, merged; needs Abhishek with a real mic)
- **What:** port voice from the first fork (`git show main:apps/web/src/voice/...`, tickets F-002, F-003, F-023, F-052) into `apps/web/src/abode/voice/`. Mic button in the composer and a hold-to-talk key; local Moonshine/Whisper via transformers.js in a worker; text streams into the composer and nothing is sent until Enter. Voice settings appear in Settings.
- **Upstream files it may touch:** `apps/web/src/components/chat/ChatComposer.tsx` (one slot for the mic control), the settings panel that hosts the voice section, `apps/web/package.json`.
- **Acceptance:**
  - [ ] The first fork's voice logic tests pass (recording machine, PCM buffer, provisional dictation, shortcut).
  - [ ] The composer hook is a few marked lines.
  - [ ] Abhishek verifies with a real mic (that check stays open after the reviewer passes it).

### A-005: abode shell: activity bar, workspaces sidebar, panel toggles

- **Status:** review (reviewer PASS, merged; needs Abhishek in the real app, including macOS traffic lights over the logo. 2026-10-11: "Hide from sidebar" on a workspace's menu (client-only, undone from the "N hidden" row); the open session is a soft accent fill instead of an outline. Hide/show is only on the workspace menu, not the palette)
- **What:** the VS Code agents-window layout from the first fork (F-028, F-035–F-044, F-047; `docs/design/fluent.md`, `docs/design/main-window.md`), rebuilt as abode components that read upstream's existing state and hooks:
  - a 48px activity bar on the far left (logo, Agents, Search → command palette, Pull requests, Usage, then Settings at the bottom);
  - one sidebar: colored, collapsible workspaces with their sessions underneath, running subagents nested under their session with a live dot, and the "needs you" amber state;
  - per-workspace accent colors, picked from the workspace's context menu;
  - VS Code panel toggles: Ctrl+B sidebar, Ctrl+J terminal, Ctrl+Alt+B right panel (closed by default), also reachable from the command palette.
  - Leave a clearly marked empty slot at the bottom of the sidebar for Customizations (A-006).
- **Upstream files it may touch:** `apps/web/src/components/AppSidebarLayout.tsx` (render the abode sidebar instead of the thread sidebar; the settings sidebar stays upstream's), plus the smallest hooks needed for the activity bar and keybindings.
- **Acceptance:**
  - [ ] All sessions upstream's sidebar can reach are reachable (new session, archive, rename, PR state, drafts, projectless threads).
  - [ ] Logic (grouping, colors, subagent nesting, toggles) has focused tests.
  - [ ] No continuously repainting animations.
  - [ ] Abhishek checks it in the real app.

### A-006: Customizations in the sidebar and right-panel editor

- **Status:** review (reviewer PASS; real-app fixes 2026-10-11: works on new-thread drafts, opens symlinked skills, Ctrl+S saves, new skills show in `/` at once. Needs Abhishek to confirm. Editor is a plain textarea: no line numbers, highlighting or find yet)
- **Depends on:** A-003, A-005
- **What:** port F-011, F-043, F-045, F-046: a resizable Customizations section at the bottom of the abode sidebar with folders (Skills, Agents, MCP servers, Instructions), user-wide and per workspace, a + to create a new skill or agent from a template, and clicking an item opens it in an editor tab in the right panel, with save and a read-only lock.
- **Acceptance:**
  - [ ] Adding a skill from the + creates `~/.claude/skills/<name>/SKILL.md` (or the workspace's `.claude/skills/`), and it appears in the composer's skill list without a server restart.
  - [ ] Abhishek checks it in the real app.

### A-007: Composer and transcript polish

- **Status:** doing (part 1, Simple/Detailed, reviewer PASS and merged; needs a real-app check. Parts 2 and 3 todo.)
- **Depends on:** A-005
- **Gap check (2026-10-11):** upstream nightly already has the context meter with compact (F-014), usage limits and the /usage page (F-015), edit from here and cite selection (F-016), Changes/Files/PR/preview tabs in the right panel (F-040, F-049). Don't port those.
- **What, in order:**
  1. Simple/Detailed transcript toggle (F-013), M.
  2. Composer layout like the reference with the branch/worktree info inside the footer and colored chips for access mode, branch kind and worktree (F-022, F-039, F-027), M.
  3. Cheap wins: visible Back button on utility pages (F-048), README tagline and starter cards on the project welcome (F-026), provider tint on the picker (F-017). Each S.
  - Only if Abhishek still wants them: status bar (F-030), picking a Claude agent type (F-021), delights (F-034).

### A-008: Switch the host to abode-next

- **Status:** done (2026-10-11: host runs abode-next 2835b2afc8; dry run on a copy of the data first, all 4 projects and 5 threads carried over. Backup of the old data: `~/.abode/backups/pre-abode-next-20261011`. Still check the T3 Code phone app speaks orchestration protocol 2.)
- **What:** `scripts/abode/host.sh update` now builds `abode-next` by default. Rollback: `host.sh rollback`, then copy the backup's `state.sqlite` back (the new build migrated the database).

## Phase B: the abode chat (brief: docs/briefs/chat-revamp.md, mockups: design/chat-revamp.html)

Hook plan (keeps daily upstream merges cheap): cards ride on upstream's own GitHub-alert rendering (two lines in `ChatMarkdown.tsx`); the board is one line after the chat column in `ChatView.tsx`; avatars are pure CSS on the timeline's existing `data-message-role` attributes; settings reuse the voice-settings hook line; answers use upstream's `startTurn` command. Everything else lives in `apps/web/src/abode/chat/`.

### A-009: Cards in the chat

- **Status:** review (reviewer PASS; GitHub alerts stay upstream's in Classic. Needs Abhishek on a real thread)
- **What:** `> [!QUESTION]`, `> [!WARNING]`, `> [!INFO]`, `> [!TICKETS]`, `> [!DONE]` (plus GitHub's NOTE/TIP/IMPORTANT/CAUTION) render as colored cards with an icon and label, and agent text gets the calmer reading style. Parser for the board: `abode/chat/cards.ts` (tags first, guesses for untagged answers).
- **Acceptance:**
  - [ ] All five abode kinds render as cards in Amber, Azure and Omarchy; upstream's own alerts still render.
  - [ ] Streaming still parses incrementally (no `extraRemarkPlugins`).
  - [ ] Parser tests cover tags, options, tickets, code fences and guesses.

### A-010: The board column

- **Status:** dropped (2026-10-14: Abhishek never used the board; removed in A-015)
- **Depends on:** A-009
- **What:** on wide windows a column right of the chat: a header with the helper, then lanes Needs you (open questions from the latest answer, plus upstream's pending approvals/inputs linking to the composer), Watch out, Tickets, Done. Question options are buttons that send the choice as a user message (`startTurn`) and turn into a "👍 choice · on it" chip with "change". Each item jumps to its message. Hidden on narrow windows and when abode chat is off.
- **Acceptance:**
  - [ ] Lane building and "is this question still open" are pure and tested.
  - [ ] An answer button sends one user message to the thread; the chip appears; nothing is sent twice.
  - [ ] Works on a thread handed off from Claude to Codex.

### A-011: The cast with moods and activity poses

- **Status:** review (reviewer PASS; handed-off threads show the current helper on every row. 2026-10-14: moods and poses removed with the board (A-015); avatars stay. Needs Abhishek)
- **Depends on:** A-010
- **What:** Sunny (Claude) / Pip (Codex) avatars beside assistant messages and the Boss beside the user's, via CSS. The board header shows the helper's mood (asking, worried, working, done, idle, agreed) and an activity pose from the latest work item (typing for file changes, terminal for commands, magnifier for search, thought bubble for reasoning). One ~0.5s motion per new work item, no loops, off under reduced motion.
- **Acceptance:**
  - [ ] Mood and pose are pure functions with tests.
  - [ ] No CSS animation runs while the agent is idle (checked in the browser).

### A-012: Settings: abode chat switch, Boss builder, names

- **Status:** review (reviewer PASS. Needs Abhishek)
- **What:** in Settings › General next to Voice: an "abode chat" switch (Classic = upstream's chat untouched), the Boss builder (face, top, brows, eyes, scarf, or a photo) and names for the Boss, the Claude helper and the Codex helper. Saved per browser.
- **Acceptance:**
  - [ ] Turning abode chat off removes the board, cards styling and avatars.
  - [ ] Settings survive reload; junk in storage falls back to defaults (tested).

### A-013: Tell the agents about cards

- **Status:** blocked (Abhishek: say "install the card instructions" to run `install-instructions.sh cards` on your real ~/.claude/CLAUDE.md and ~/.codex/AGENTS.md; tested on scratch copies: idempotent, --remove restores)
- **What:** `scripts/abode/chat/install-instructions.sh` appends a marked, idempotent block to `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` explaining the five callouts (and removes it with `--remove`). Upstream has no custom-instructions setting, so this is the engine-free route.
- **Acceptance:**
  - [ ] Running it twice changes nothing; `--remove` restores the files.
  - [ ] Abhishek agrees before it touches his global files.

## Phase C: polish from using it (2026-10-14)

### A-014: Breathing room in the workspaces sidebar

- **Status:** review (reviewer PASS; needs Abhishek in the real app)
- **What:** workspaces sit 16px apart (was 6px), headers are 32px and session rows 30px with 2px between them, so picking a session doesn't take focus. Spacing only, in `abode/shell/shell.css`.
- **Acceptance:**
  - [ ] Each workspace reads as its own group; neighboring sessions are easy to hit (Abhishek in the real app).

### A-015: Drop the board; the chat gets the width

- **Status:** review (reviewer PASS; needs Abhishek in the real app)
- **What:** the board column, its lanes, moods and poses are gone. The avatars beside messages stay (`abode/chat/ChatAvatars.tsx` hands them over, as the board did). Agent answers no longer stop at 76ch, so Settings › Chat width (Wide or Full) widens the whole chat.
- **Acceptance:**
  - [ ] No column right of the chat; avatars still show with abode chat on.
  - [ ] With Chat width set to Wide, answers use the full lane.

### A-016: Voice: "Listening" bars instead of live text

- **Status:** review (reviewer PASS; needs Abhishek in the real app)
- **What:** while recording, the composer shows bars that follow the mic level and "Listening 0:05"; nothing is transcribed until release. The model warms up in the background when recording starts, so the one transcription after release stays quick. Bars update about 20 times a second only while recording, and hold still under reduced motion.
- **Acceptance:**
  - [ ] No live text appears while speaking; the transcript lands at the caret on release (Abhishek with a real mic).
  - [ ] Level math is tested; no animation runs when not recording.

### A-017: Pages open in the browser next to the chat

- **Status:** review (installed 2026-10-14 in ~/.claude/CLAUDE.md; needs Abhishek to ask for an artifact in a real thread)
- **What:** Claude was never told about T3 Code's in-app browser (upstream gives those instructions to Codex only), so pages went to the system browser in another Omarchy workspace. `install-instructions.sh browser` adds a block to `~/.claude/CLAUDE.md` telling Claude to show pages with the `t3-code` server's `preview_open` and its `url`. No engine change. If Claude ignores it, the fallback is a hook in the Claude adapter, which needs Abhishek's sign-off.
- **Acceptance:**
  - [ ] Asking for an artifact in an abode thread opens it in the browser panel beside that thread.
  - [ ] Installing twice changes nothing; `--remove` restores the file (tested on scratch copies).

## Phase D: calm mode (brief: docs/briefs/calm-mode.md, ADR: docs/adr/0001-subagent-type-hook.md)

The card sits above the composer (where questions already open) and shows the thread's current work. Earlier turns fold into upstream's "Worked for…" row; a tap opens that turn in full.

### A-018: Record the subagent type

- **Status:** done (reviewer PASS; known gap: a subagent recovered after a server restart has no type until a later frame carries one)
- **What:** optional `agentType` on `OrchestrationV2Subagent` (contracts, add-only). The Claude adapter keeps the Agent tool's `subagent_type` with the pending launch and copies it onto the subagent when `task_started` arrives. Codex leaves it empty. Marked `abode:` hooks, listed in docs/upstream-sync.md.
- **Upstream files it may touch:** `packages/contracts/src/orchestrationV2.ts`, `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts`.
- **Acceptance:**
  - [ ] A server test: an Agent call with `subagent_type: "reviewer"` produces a subagent with `agentType: "reviewer"`; without it, no field.
  - [ ] Old payloads without the field still decode (the mobile app is unaffected).
  - [ ] Hook report stays under budget.

### A-019: Calm transcript

- **Status:** review (reviewer PASS; needs Abhishek in the real app)
- **What:** the transcript menu becomes Calm / Detailed (Calm replaces Simple, default; a stored "simple" reads as Calm). Calm shows your messages and each settled turn's "Worked for…" fold row; agent text, tool calls and thinking are hidden. Opening a fold shows that turn as Detailed. Failures and errors stay visible.
- **Acceptance:**
  - [ ] Row filtering is pure and tested (a turn with text, tools and a failure; a running turn; an expanded fold).
  - [ ] Detailed is unchanged.

### A-020: The calm card

- **Status:** review (reviewer PASS; needs Abhishek on a real batch)
- **Depends on:** A-018 for names (without it every subagent is 🤖 helper)
- **What:** above the composer while a thread has a task list or subagents in its latest run: "Tickets 4 of 5" from the agent's task list, then one row per subagent type: emoji, type, finished of started, ✓ when all are done. A bright orange "Needs you" while an approval or question waits. Static: no animation. Only in Calm.
- **Acceptance:**
  - [ ] The card model (counts, grouping, emoji, needs-you) is pure and tested, including Codex subagents without a type.
  - [ ] Hidden when there's nothing to show; hidden in Detailed.
- **Known gap:** members of a multi-agent workflow have no run of their own, so a workflow counts as one row (its coordinator).

### A-021: Needs you in the sidebar

- **Status:** review (reviewer PASS; needs Abhishek in the real app)
- **What:** a session waiting on you shows a bright orange "Needs you" tag on its sidebar row instead of only the small square.
- **Acceptance:**
  - [ ] Shows exactly while the session waits on you (an approval, a question, or a plan ready to approve); goes away when answered.

### A-022: Sidebar like VS Code's agent sessions

- **Status:** review (reviewer PASS; needs Abhishek in the real app)
- **What:** Abhishek's reference (VS Code's agent sessions view): a workspace header is a folder icon in the workspace color and the name (no tinted bar, no path line; Copy path stays on its menu). A session is two lines: status square and title, then where it runs (worktree icon or folder, branch) and its age or "Needs you" tag. No guide line. Replaces A-014's 16px gaps. Diff counts (+N −M) are left out: upstream's thread shells don't carry them yet (its own sidebar has an empty seam for it).
- **Acceptance:**
  - [ ] Matches the reference in the real app (Abhishek).
  - [ ] Session place logic is pure and tested.

### A-023: Project chip on a new session

- **Status:** review (reviewer PASS; needs Abhishek in the real app)
- **What:** Abhishek's reference (VS Code's project chip): upstream's new-session project picker ("What should we build in [project]?") becomes a rounded chip with a folder, the name and a chevron; each project in its list shows its parent folder in grey (`~/Projects`), and "Add project" stays last. Same picker, same behaviour; only its look and the path hint change.
- **Acceptance:**
  - [ ] The chip opens the searchable list; picking a project switches the draft as before (Abhishek in the real app).
  - [ ] The path hint is pure and tested.

## Phase E: from using it (2026-10-15)

Every ticket here stays inside `apps/web/src/abode/`: no new upstream hooks, and a trial merge with the latest nightly must stay as clean as before.

### A-024: Voice that hears you

- **Status:** review (reviewer PASS; needs Abhishek to dictate a long real prompt)
- **What:** Abhishek struggled with dictation on 2026-10-14. Measured (`docs/research/voice-spike.md`): no model beats Moonshine Base within the CPU (wasm) budget, but Moonshine loops on anything past 30 s, and the whole recording went to it in one call (a 2-minute clip came back at 253% WER). Long recordings are now cut at pauses (judged against the room's noise floor, so quiet endings and noisy rooms work) into pieces of 30 s or less and transcribed in order: 2 minutes goes to about 4% WER. A developer vocabulary fixes words Moonshine mishears (worktree, websocket, pixi, SQLite, fh-saas, abode, the React hooks). Cancel stops a long transcription, and the composer shows "Transcribing 2 of 8…". The model and its download are unchanged. GPU or streaming voice is a separate decision (Nemotron spike, `docs/research/voice-nemotron.md`).
- **Acceptance:**
  - [x] The comparison is a script someone can rerun (`apps/web/scripts/abode/voice-bench/`), and its tables are in `docs/research/voice-spike.md`.
  - [x] Pause segmentation is pure and tested with exact boundaries (soft tail, 10 and 15 dB room noise, no-pause cut, tiny tail).
  - [ ] Abhishek dictates a real 1 to 3 minute prompt in the app.

### A-025: Calmer sidebar chrome

- **Status:** review
- **What:** Workspaces lose their colors: the color picker leaves the workspace menu, and every folder icon uses the theme's default color (color store and hooks deleted). The activity bar loses Pull requests and Usage; both become rows in the Customizations list at the bottom of the sidebar (after Instructions) that open the same pages. The activity bar keeps Agents, Search and Settings.
- **Acceptance:**
  - [ ] No workspace color code is left; existing stored colors are simply ignored.
  - [ ] Pull requests (only where supported) and Usage open from Customizations; their activity-bar buttons are gone.

### A-026: "+" shows the new session under its folder

- **Status:** review
- **What:** Like VS Code: pressing + (or starting a new session any other way) puts a "New session" row under that workspace at once, selected, while the pane opens beside it. It stays a draft: no server thread until the first message. An empty draft's row stays only while it is the open one; leaving it empty removes the row.
- **Acceptance:**
  - [ ] The draft-row rule is pure and tested (empty and open: shown; empty and not open: gone; with text: shown).

### A-027: Remove a workspace from the sidebar

- **Status:** review
- **What:** "Hide from sidebar" becomes "Remove from sidebar", and the "N hidden" row is gone. Nothing is deleted on the server, so its sessions come back with it. A removed workspace returns as soon as it becomes the open one again (picked in the new-session project chip, or added again with "Add project"), and stays back.
- **Acceptance:**
  - [ ] Remove and return are pure and tested; no "hidden" wording is left in the UI.

### A-028: No activity bar

- **Status:** review
- **What:** Abhishek doesn't use the activity bar. It goes; the sidebar gets its width. Its jobs move to the sidebar's own header row: the "abode" mark on the left goes home (`/`, the sessions), and on the right a Search button (opens the command palette, tooltip shows its shortcut) and a Settings gear. Upstream's own sidebar toggle and Ctrl+B are how a collapsed sidebar comes back. The `ActivityBar` lines in `AppSidebarLayout.tsx` and the activity-bar width in `shellLayout.ts` go, so the upstream hook shrinks.
- **Acceptance:**
  - [ ] No activity bar on any route; home, search and settings reachable from the sidebar header; a collapsed sidebar can be reopened without the keyboard.
  - [ ] `hook-report.sh` total goes down, and no new upstream lines.

### A-029: Voice on the host: Nemotron streaming

- **Status:** done
- **What:** Abhishek wants VS Code's dictation. VS Code runs NVIDIA Nemotron 3.5 ASR streaming natively on the machine; the spike (`docs/research/voice-nemotron.md`) shows it from Node via `sherpa-onnx-node` (Apache-2.0): 5.4% WER (Moonshine 6.7%), 3.3% on 3-minute prompts, final text 0.13 s after you stop, RTF about 0.12 on 4 CPU threads. Do the same through the abode server:
  - **Server** (`apps/server/src/abode/`): a voice service running Nemotron 3.5 560 ms int8 (k2-fsa's sherpa build, OpenMDW-1.1) in a worker thread with 4 threads. The model (about 453 MB) downloads on first use into T3 home with its checksum pinned, reporting progress; nothing loads until someone dictates, and it unloads after a few idle minutes.
  - **Wire:** mic audio streams as 16 kHz PCM from the client to the host while you talk; the final text returns when you stop. Add-only `abode*` contracts and RPCs, an existing permission scope, bounded buffers and session counts.
  - **Client** (`apps/web/src/abode/voice/`): use the host when it has voice, and Moonshine in the browser (A-024) when not. Same mic button, hold-to-talk key, listening bars, Esc and Enter. Settings › Voice shows which engine is active and the host model's download state.
- **Acceptance:**
  - [x] Service and session logic tested with a fake recognizer; one real-model test runs when the model is present and is skipped otherwise.
  - [x] Final text arrives within about 1 s of stopping for a 2-minute recording on this machine: measured 161 ms (`scripts/abode/voice-latency.ts`, audio paced at speech speed in 200 ms chunks through the RPC's JSON encoding).
  - [x] Falls back to Moonshine when the host has no voice; works from a remote browser, since the audio goes to the host (not tried from a second device).
  - [x] `hook-report.sh` stays under 400 (398), and `vp build` passes the license check.
  - [x] security-auditor: waived by Abhishek on 2026-10-15; the reviewer covered upload bounds, session ownership and the model download.
  - [x] Abhishek dictates a real prompt: "now it works really well" (2026-10-16).

### A-030: Host voice follow-ups

- **Status:** todo
- **What:** from A-029's review. (1) A model load that never sends `ready` blocks server shutdown and `host.sh update`: time out `ensureEngine` (about 60 s) in `VoiceRecognizerSherpa.ts` and report `unavailable`. (2) License notices list only `sherpa-onnx-linux-x64`; a macOS or Windows desktop build fails the license check until the other platform packages are listed (mind the hook budget: 391/400).

### A-031: Dictation survives the screensaver

- **Status:** review
- **What:** A mic-button dictation stopped when Omarchy's idle screensaver opened: the screensaver is a fullscreen window, the browser lost focus, and the blur rule meant for hold-to-talk (a keyup never arrives) stopped every recording. Now blur stops only a dictation started by holding the key, and the page holds a screen wake lock while recording, so the screensaver and idle lock don't start while you talk.
- **Acceptance:**
  - [ ] A mic-button dictation keeps recording when another window takes focus; a held-key dictation still stops on blur.
  - [ ] Talking past the idle timeout without touching anything: no screensaver, and the text arrives.

## Phase F: control room (brief: docs/briefs/control-room.md, design: docs/design/control-room.md)

Tables, not tiles. Data comes from what the client already has (`useWorkspaceGroups`, thread shells, `deriveWorkspaceThreadState`, environments, `server.getHostResources`, per-thread projections for task lists). One new upstream hook at most: the `/` route.

### A-032: Home is the control room: workspaces table

- **Status:** review
- **What:** `/` (the abode logo) shows "Control room" instead of jumping into a draft: a Workspaces table, one row per workspace from `useWorkspaceGroups()`: name, status (Needs you / Running / Failed / Done / Idle from `deriveWorkspaceThreadState` over its sessions, needs-you first), progress (done/total over the task lists of its running and needs-you sessions, from their projections; bar plus percent), agents running (running sessions plus running subagents), machine (environment label; several when it spans), last activity. A needs-you row shows the waiting question's text when the shell or projection has it. Clicking a row opens the workspace's most relevant session (needs-you, else running, else latest) in Calm. The + button and "New session" still start drafts.
- **Upstream files it may touch:** `apps/web/src/routes/_chat.index.tsx` (one hook: render the abode view in place of `IndexDraftLanding` when there are projects).
- **Acceptance:**
  - [ ] The row model (status priority, progress sums, agent counts, sort, chosen session) is pure and tested.
  - [ ] Only running and needs-you sessions subscribe to their projections; idle rows don't.
  - [ ] Matches the chosen design; no-projects still shows upstream's hero.

### A-033: Calm is the plan table

- **Status:** review
- **What:** in Calm, the session shows no chat: a header (status, "N of M done · P%" bar, agents running by type), the orange Needs-you banner with the question and an Answer button that opens upstream's panel, then a table of the current batch's task-list items: Task, Status (Not started / In progress / Done / Needs you), Who (the subagent whose title or prompt names the task's ticket ID, by `agentType`; else "main agent"), Time (that subagent's duration when known). When the batch finishes: "N of N complete" and the model's own final assistant message of the batch in full, rendered as chat markdown. Detailed is unchanged. Replaces the A-020 card and A-019 rows in Calm.
- **Acceptance:**
  - [ ] The table model (rows from plan steps, ticket-ID matching to subagents, who/time, header counts, final message pick across wake runs) is pure and tested, including a Codex session without types and a session with no task list.
  - [ ] Detailed still shows everything; switching back and forth keeps the scroll position sane.

### A-034: Machines table and filter

- **Status:** review
- **Depends on:** A-032
- **What:** under the workspaces table, a Machines table: one row per environment from `useEnvironments()`: name and route (local, Tailscale, relay), status (Online / Connecting / Offline from the connection phase), CPU and memory bars from `server.getHostResources` (polled only while the page is open, "—" when unavailable), agents running and workspaces on it. Clicking a machine filters the workspaces table; an "All machines" chip clears it.
- **Acceptance:**
  - [ ] The machine row model is pure and tested (offline, no resources, a workspace spanning two machines).
  - [ ] Resource polling stops when the page is closed.

## Phase B: follow-ups from the v0.1.3 sync (2026-10-25)

Upstream `v0.1.3-nightly.20261025.3669` made Settings and Usage modals, added guest sharing and new test lint rules. Hook budget is 398/400: free lines by trimming or moving an existing hook rather than raising the budget.

### A-035: Settings over the Control room

- **Status:** todo
- **What:** opening Settings (or Usage) from `/` shows the Control room behind the modal, not an empty backdrop. Upstream's `ChatRouteLayout` (`apps/web/src/routes/_chat.tsx`) only keeps a thread or draft behind the modal.
- **Acceptance:**
  - [ ] From `/`, Settings opens over the Control room; closing it returns to `/` with the table intact.
  - [ ] From a thread or draft, behaviour is unchanged.
  - [ ] Any logic deciding what stays behind the modal is tested; hook report stays at or under 400.

### A-036: Settings search finds abode's settings

- **Status:** todo
- **What:** upstream's Settings search uses a static index; abode's chat and voice sections (`AbodeSettingsSections`) never match. Add abode's entries to the index so searching e.g. "voice", "dictation", "calm" finds and opens them.
- **Acceptance:**
  - [ ] Searching an abode setting's label returns it and navigates to its section.
  - [ ] Abode's entries live in `abode/`; the upstream hook is one line. Tested.

### A-037: Share with guest from the sidebar

- **Status:** todo
- **What:** abode's sidebar thread menu (`useAbodeThreadActions.ts`) passes `canShareWithGuest` like upstream's sidebar, so "Share with guest" appears on right-click where upstream offers it.
- **Acceptance:**
  - [ ] The item appears under the same conditions as upstream's header menu and opens the same share flow. No upstream file edits.

### A-038: Voice benchmarks pass upstream's test lint

- **Status:** todo
- **What:** `apps/server/src/abode/voice/Voice.latency.test.ts` and `Voice.real.test.ts` fail `no-test-timeout-or-unreasoned-skip` / `no-wall-clock-in-tests` / `no-real-time-wait-in-tests`. Move the wall-clock latency benchmark out of `*.test.ts` into a script (e.g. `apps/server/scripts/abode/voice-latency.ts`), and make the real-model test assert on events, not timings. Don't silence the rules.
- **Acceptance:**
  - [ ] `vp lint apps/server/src/abode` is clean with no new disables.
  - [ ] The benchmark still runs on demand and prints its numbers.
