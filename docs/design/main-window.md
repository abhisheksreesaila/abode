# Design handoff: main window (F-004)

- **Mockup:** `docs/design/main-window.html`, also published privately at https://claude.ai/artifact/Toq9vXJGB9Lgegjofnx5sv.
- **Chosen option: B (color-forward).** Abhishek said T3 felt "too monochromatic". B tints each workspace row with its color and gives that row a 3px left border; threads and subagents show a guide line in the workspace color. A is the same layout with only colored dots. If Abhishek prefers A in the morning, switching is a CSS-only change.
- **Approval:** pre-approved by Abhishek on 2026-10-01 ("close to VS Code"), to be reviewed in the morning.

## Tokens

VS Code Dark Modern, shipped as a new built-in palette in T3's theme system (`packages/shared/src/themePalettes.ts` plus the derivation in `apps/web/src/themePalette.ts`). Don't add literal colors to components.

| Role                       | Value     |
| -------------------------- | --------- |
| Chat / editor background   | `#1f1f1f` |
| Sidebar, title bar, panels | `#181818` |
| Raised surface (composer)  | `#252526` |
| Input background           | `#313131` |
| Borders                    | `#2b2b2b` |
| Text                       | `#cccccc` |
| Strong text                | `#e7e7e7` |
| Muted text                 | `#9d9d9d` |
| Accent                     | `#0078d4` |
| Focus                      | `#2488db` |
| List hover                 | `#2a2d2e` |
| List active                | `#37373d` |

**Semantic colors:** ok `#89d185`, waiting `#cca700`, error `#f48771`. Recording red is `#c42b1c`.

**Workspace palette,** assigned in order and editable: `#4fc1ff`, `#c586c0`, `#dcdcaa`, `#4ec9b0`, `#f48771`, then `#b5cea8`, `#9cdcfe` and `#d7ba7d`. These are VS Code syntax hues, so they read well on dark backgrounds.

**Type:** the system UI font at 13px for the UI, and the mono font for code, branches and tool rows.

## Components and states

- **Sidebar:** an "Agents" header, the "New agent" primary button, then the workspace tree.
  - Each workspace row shows: chevron, color dot, name, thread count.
  - Each thread row shows: status dot, title, meta (age, "needs you" or "failed").
  - Status dots: running (teal with a halo, static), waiting (yellow), done (hollow), error (coral). Nothing animates continuously.
  - Subagent rows are indented under their thread with "↳ type · description", visible only while running.
- **Customizations:** pinned to the bottom of the sidebar, scoped to the selected workspace.
  - Four groups: Skills, Agents, MCP servers, Instructions, each with a count.
  - Expanding a group lists its files with a `user` or `workspace` scope label.
  - Empty state: "No skills yet", with an action to create one.
- **Title bar:** three toggles for sidebar, terminal and side panel (Ctrl+B, Ctrl+J, Ctrl+Alt+B) in VS Code's layout-icon style. They're highlighted when the panel is open.
- **Chat header:** a workspace chip in its color, the thread title, and on the right the branch and worktree.
- **Composer:** a picker row for workspace, harness/model and the worktree mode. A mic button sits next to Send.
  - Recording shows a red mic and a bar: "Listening 0:07 · Release to insert · Esc cancel".
  - Other states: Transcribing…, Downloading voice model with percentage, and the error line "Microphone blocked. Allow it in system settings."
- **Side panel:** closed by default.
  - VS Code-style tabs: Editor, Browser, Diff, Agents, plus a close ✕.
  - A breadcrumb shows the path, with a lock toggle ("🔒 Locked" / "🔓 Editing").
- **Long content:** thread titles truncate with an ellipsis; the tree and transcript scroll independently.
- **Mobile:** unchanged (the official app). The web layout below 768px keeps T3's existing mobile behavior.
