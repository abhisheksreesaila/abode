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

- **Status:** review (reviewer PASS, merged; needs Abhishek in the real app, including macOS traffic lights over the logo. 2026-10-11: "Hide from sidebar" on a workspace's menu (client-only, undone from the "N hidden" row); the open session is a soft accent fill instead of an outline)
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

- **Status:** blocked (Abhishek: look at abode-next in the app, then say "switch the host". Also check the T3 Code phone app is a version that speaks orchestration protocol 2.)
- **What:** point `scripts/abode/host.sh update` at `abode-next` (later, make `abode-next` the new `main`). The old V1 release stays as the rollback.
