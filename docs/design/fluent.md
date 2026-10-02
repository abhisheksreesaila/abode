# Design handoff: Fluent window (option E)

Source: Abhishek's composite mockup https://claude.ai/artifact/8WdcZeJY48ZQtmJAnhVidu (1280×800 window). This replaces the earlier visual pass where they differ: one-line sidebar rows instead of the initials header, blue branch chip instead of purple, and an "Account" footer.

## Principles

- **One blue.** Selection, badges, primary buttons, the branch chip and the usage meter all share the accent. Nothing else is saturated.
- **Amber means waiting on you.** The ask block, the sidebar square and the status bar count all use the same amber.
- **Red means risk.** It's only for "⚠ Full access" and for failed.
- **Purple is only the logo mark** ("ab" in the activity bar) and the abode workspace color.
- Small square dots (2px radius on the workspace dot, 1px on status squares). Buttons and chips have 2px corners.
- No continuously repainting animations.

## Tokens (abode theme)

| Token                                           | Value                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| bg (editor/chat)                                | `#1f1f1f`                                                                                                           |
| side (sidebar, tabs strip, drawers, status bar) | `#181818`                                                                                                           |
| line                                            | `#2b2b2b`                                                                                                           |
| line-hi (inputs, diff borders)                  | `#3c3c3c`                                                                                                           |
| pill / chip bg                                  | `#2b2b2b`                                                                                                           |
| hover                                           | `#2a2d2e`                                                                                                           |
| text / strong / muted / dim                     | `#cccccc` / `#ffffff` / `#9d9d9d` / `#6e6e6e`                                                                       |
| accent                                          | `#0078d4`                                                                                                           |
| accent-hi (links, meter, AI model text)         | `#4cc2ff`                                                                                                           |
| accent-bg (brand chip)                          | `rgb(0 120 212 / .22)`                                                                                              |
| selection (active thread row)                   | `#04395e` with an inset 1px accent ring                                                                             |
| green (ok/running)                              | `#4ec9b0`                                                                                                           |
| red (risk/failed)                               | `#f14c4c`, bg `rgb(241 76 76 / .16)`                                                                                |
| amber (waiting)                                 | `#cca700`, bg `rgb(204 167 0 / .14)`                                                                                |
| diff add / del                                  | `rgb(78 201 176 / .14)` / `rgb(241 76 76 / .14)`                                                                    |
| workspace colors                                | `#4cc2ff`, `#c586c0`, `#dcdcaa`, `#4ec9b0` (then the existing --ws-5..8)                                            |
| fonts                                           | UI: "Segoe UI Variable", "Segoe UI", system-ui, Inter; code: Consolas, "Cascadia Code", "JetBrains Mono", monospace |

## Layout

- Title bar 35px.
  - A centered search/command box ("⌕ <project> — <thread>"), 420px wide, that opens the command palette.
  - On the right, three layout toggles: sidebar, panel, right drawer.
- The main row is: activity bar 48px | sidebar 296px | editor group (chat) | right drawer 400px. Status bar 22px.

### Activity bar (48px, `side` bg, right border)

- **Top:**
  - "ab" logo in purple, 700 weight;
  - Agents (active, with a 2px inset left accent bar);
  - Search (opens the palette);
  - Pull requests (with a blue count badge);
  - Usage/remote;
  - Customizations.
- **Bottom:** Account/connections, then Settings ⚙.
- Icons are 48×48 cells, #868686 normally and white when active. Use a proper icon set (lucide is already in the repo).

### Sidebar (296px)

- **Header** (35px): "AGENTS", 11px uppercase, with + / ⟳ / ⋯ actions on the right.
- **Section header** (22px): "WORKSPACES", 11px bold uppercase, with the count right-aligned in dim text.
- **Workspace row** (one line, 22px), in this order:
  - chevron ▾/▸;
  - 8px square color dot;
  - the name, followed by a dim 11px location (`~/Projects/x`, or the machine name for a remote workspace);
  - on the right, either a count pill (18px round, pill bg, 11px bold) or a red "⊗ failed".
- **Thread rows** (22px, indented 32px):
  - a 7px square status: green running, amber needs you, dim idle;
  - the title, with an ellipsis if it's too long;
  - a meta label on the right ("2m", "needs you", "1d").
  - The active row uses the selection bg, white text, and an inset 1px accent ring.
- "N older" is a dim row.
- **Footer**, under the section header "ACCOUNT", 26px rows:
  - Pull Requests (teal ⑂, count);
  - Claude Max: a blue meter (3px) and the sub-line "42% of 5h · resets 3:40 PM";
  - Customizations (purple ✦, count);
  - Phone & Remote (blue, paired count).
  - Settings lives in the activity bar, not here.

### Editor group (center)

- **Tabs strip** (35px, side bg):
  - each tab shows a status square and a title with ×;
  - the active tab gets the bg color, white text, and a 1px accent line on top;
  - tools on the right (split, layout, ⋯).
  - _Threads opening as tabs is deferred until after the trip._ For now the strip shows the current thread as the single active tab.
- **Thread** (padding 18px 28px, max-width 860px, 16px gap):
  - Each message has a 24px avatar square ("AB" on pill bg for you; the agent's initial on #ff9f0a for the agent), then a name line: **name** plus a muted detail (time, or "Opus 5.5 · full access").
  - **Steps list** (22px rows, 12.5px muted): ✓ green when done, ◐ blue while running, with inline `code` in the code font.
  - **Diff block:**
    - a 1px line-hi border with 4px radius;
    - a file header (28px, side bg) showing the path and +N (green) / −N (red);
    - code lines (40px gutter, add/del backgrounds, +/− markers).
  - **Ask block:**
    - a 2px amber left border on the amber bg;
    - the question text;
    - action buttons: primary blue "Apply", secondary, and a ghost with a line-hi border, all 26px with a 2px radius.
- **Composer:**
  - The box has a line-hi border, 4px radius and side bg, and the border turns accent on focus.
  - The placeholder reads "Reply, or hold Ctrl+Shift+Space to talk".
  - Footer chips are 22px, 11px semibold, 2px radius, on pill bg:
    - agent chip with a 7px orange square: "Orchestrator · Opus 5.5 ▾";
    - risk chip "⚠ Full access ▾" in red bg and red text;
    - branch chip "⑂ main ▾" in accent-bg and accent-hi text (blue for every branch);
    - host chip "laptop" (neutral).
  - On the right: "38% context" as a transparent muted chip, the mic (26px square), and "Send ↵" (accent).

### Bottom panel (190px, side bg)

- Tabs: TERMINAL · PROBLEMS (with a count pill) · OUTPUT, 11px uppercase, with a 1px accent underline on the selected one.
- On the right: "zsh · <project>" in dim text, then ⌄ to close.
- If T3 has no Problems source, leave that tab out (don't fake it). Output can show the agent/orchestration log if one exists.

### Right drawer (400px, left border)

- VS Code file tabs (12.5px, with dividers). The selected tab gets the bg and a 1px accent line on top.
- The tab kinds are the existing ones: editor files, browser ("◫ localhost:3000"), diff, subagents.
- Actions on the right: ⫽ split (only if it already exists), then › to close.
- Editor: a breadcrumb row (22px), then code at 12px/19px with a 44px gutter; the current line gets a faint highlight.
- Browser: a URL bar (32px) with ‹ › ⟳ and a code-font URL showing a green dot.

### Status bar (22px, side bg, top border, 12px)

- **Left:** "⑂ main", then "project · host" (muted), then "● N running" (green), then "⚠ N needs you" (muted/amber).
- **Right:**
  - panel toggle buttons (terminal ⌨, right drawer ◫);
  - the model ("Opus 5.5" in accent-hi);
  - "38% ctx", "Max 42%" and "⌘K", all muted.
- Clicking an item opens its existing menu or popover where one exists.

## Toggles

Ctrl+B sidebar, Ctrl+J bottom panel, Ctrl+Alt+B right drawer (all existing). These work from the title bar buttons, the status bar buttons and each drawer's close control.
