Status: approved (2026-10-01)

# ABode: product brief (phases 1–2)

## Why (the mission)
- **Why this exists:** one window where I talk to all my coding agents across every workspace, so I stop juggling terminals and workspace switches.
- **Why now, and why me:** I run 10–15 projects. T3 Code already does the hard parts (the Claude harness, worktrees, subagents, mobile), but it has no voice and doesn't have the VS Code agents-window feel I like.
- **If it disappeared:** I'd go back to separate Claude Code terminals and VS Code windows.

## Who it's for
- **Who:** me, a solo founder driving Claude Code agents all day. It's a personal fork, so nobody else needs to be served.
- **Trigger:** I have an idea or a follow-up for one of my projects and want to say it, not type it, without hunting for the right terminal.
- **Today:** a separate terminal or window per workspace. T3 Code is close, but it's monochrome, it has no voice, and its panels don't open and close like VS Code's.

## What it does
- **Core job:** talk to and watch all my agents in one window.
- **Phase 1, voice:** local, offline dictation in the web/desktop client. Hold a key or tap a mic, the speech becomes text in the composer, and I press Enter. English only. The model downloads once (assumed: Whisper or Moonshine via transformers.js).
- **Phase 2, VS Code polish, using existing features only:**
  - one left tree of colored, collapsible workspaces with their threads underneath, and running subagents nested under each thread with a live dot (clicking one opens the existing Agents tab);
  - workspace and harness dropdowns above the composer;
  - panel toggles copied from VS Code: Ctrl+B sidebar, Ctrl+J terminal, Ctrl+Alt+B side panel (closed by default);
  - a **customizations list** at the bottom left, like VS Code's: Skills, Agents, MCP servers and Instructions.
    - Each entry is a link to a file on disk: user-wide under `~/.claude/` or workspace-specific under `.claude/`, `.mcp.json` and `CLAUDE.md`.
    - Clicking one opens it in the side panel's editor tab, where I can edit it or lock it read-only.
    - It's backed by one new server service. The service lists Claude agents, skills, MCP servers and CLAUDE.md files, and it saves edits only inside `~/.claude/` and the workspace's own `.claude/`, `.mcp.json` and `CLAUDE.md`.
    - The side panel's browser tab also renders markdown.
- **Not in this brief:**
  - mobile pairing (next, over Tailscale with the official app);
  - agent names, emojis, calm/detailed modes and the HTML review (later);
  - Codex testing (no subscription);
  - restyling mobile;
  - contributing upstream.

## How it should look and feel
- **Three words:** familiar, colorful, calm (assumed).
- **Feels like:** VS Code's agents window, borrowing its structure, density, panel toggles and keybindings. Plus a bright accent color per workspace.
- **Style:** VS Code Dark Modern structure with workspace colors, not Terminal Ledger.
- **The screen that matters:** the main window, meaning sidebar, chat and a closable side panel. There I pick a workspace, speak a prompt, and glance at which agents are busy.

## How we'll know it worked
- **Signal:** after a week, I run all my Claude sessions in ABode instead of separate terminals.
- **Done for phases 1–2:**
  - Voice works offline in the desktop app.
  - The phase 2 layout is in daily use.
  - The official mobile app can still connect.

## Constraints and risks
- **Add, never change:** phases 1–2 live mostly in `apps/web`. Server and `packages/contracts` changes may only **add** new methods and types, never alter existing ones, so the official mobile app stays compatible. The only planned addition is the customizations service.
- **Merge friction:** upstream changes daily and `Sidebar.tsx` (~5k lines) and `ChatView.tsx` (~10k) are huge. Customizations go in new files with small hooks, and I pull upstream about monthly.
- **Riskiest assumption:** an in-app speech model is fast and accurate enough on my Linux laptop. Test: a one-hour spike before building voice. If it fails, fall back to whisper.cpp, which needs a server change and so a new decision.
- **Policy:** this uses my own Claude subscription through the official Agent SDK and my own CLI, for personal use. Before inviting others to use it, I re-check Anthropic's terms.

## Decisions and trade-offs
- **Fork, not rebuild:** I get every feature (harness, worktrees, subagents, mobile) for free; I accept a large codebase and monthly merges.
- **Mostly client-side, add-only server changes:** this keeps the fork light and mobile-compatible; I accept that voice runs per client and isn't shared with the phone.
- **A real customizations service, not the unchecked-folder write loophole:** it survives upstream security fixes and only writes where it should; I accept a little server code to maintain.
- **Voice in the app, not on the server:** no native binaries and offline; I accept a first-use model download and possibly lower accuracy than whisper.cpp (the spike decides).
- **VS Code look, not Terminal Ledger:** familiar from day one and fixes the monochrome feel; I accept less personal identity until the fun extras.
- **Tailscale for mobile later:** private and free; I accept depending on Tailscale for sign-in and coordination (it never sees my traffic).

## Open questions
- **Deferred:** mobile layout changes and the phase 4 extras.
