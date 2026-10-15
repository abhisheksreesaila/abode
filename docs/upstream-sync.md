# abode on top of T3 Code: how we stay current

**Goal:** take T3 Code's engine (server, providers, orchestration, performance work) every time upstream ships a nightly, and keep only abode's look and a few client features on top.

## What went wrong with the first fork (2026-10-01 to 10-10)

- abode branched from upstream on 2026-10-01. Ten days later upstream had 751 new commits, including Orchestration V2 (protocol 2), which V1 abode can't talk to.
- abode had edited about 130 upstream files, including orchestration, the Claude adapter, the projector, and 700-line rewrites of `LegacySidebar.tsx`, `ChatComposer.tsx` and `ChatView.tsx`.
- A trial merge of the latest upstream gave **75 conflicting files**. That number only grows, so merging again and again doesn't work.

## The new shape: a skin layer, not a fork of the engine

abode is rebuilt on branch `abode-next`, starting from upstream nightly `v0.0.46-nightly.20261011.2955`. Rules:

1. **Engine untouched.** No edits to orchestration, providers, persistence, projections or existing contracts. If abode wants an engine feature, it waits for upstream or adds a separate service.
2. **abode code lives in its own folders:**
   - `apps/web/src/abode/` for all client code (shell, sidebar, customizations UI, voice, CSS);
   - `apps/server/src/abode/` for server services (only Customizations today);
   - `packages/contracts/src/abode*.ts` for new RPC types.
3. **Colors are a theme, not CSS overrides.** The VS Code look ships as a built-in theme in upstream's theme system (`packages/shared/src/themePalettes.ts` format). Structural CSS (density, radii, fonts) lives in `apps/web/src/abode/abode.css`.
4. **Hooks into upstream files are small and marked.** Each one is a few lines, tagged with an `abode:` comment, and listed below. `scripts/abode/hook-report.sh` prints every upstream file abode changed and fails if the total goes over budget (**400 changed lines**, not counting lockfiles).
5. **No numbered DB migrations, no contract default changes, no protocol changes** (see `docs/lessons.md`).
6. **Don't delete upstream files** abode stops using; leave them unused.

## Hook points (keep this list current)

One bullet per hook (a list, not a table, so adding a row never re-aligns the others).

Fonts: use upstream's Settings › Appearance › Typography (an inline style on `<html>`, so it overrides abode.css). Omarchy: `scripts/abode/omarchy/install.sh` adds a theme-set hook that publishes Omarchy's palette to abode's server as the "Omarchy" environment theme; nothing in the app.

`t3 theme set abode` does not work by design: abode stays out of `BUILT_IN_THEME_IDS` so the mobile app's theme ids are unchanged.

- `apps/web/src/components/AppSidebarLayout.tsx`: renders `AbodeSidebar` instead of `LegacySidebar`/`Sidebar` (A-005): an import and one render line. The sidebar's own header row (home, search, settings) and its left padding for the window controls live in `abode/`. Those two sidebar files stay in the tree, unused
- `apps/web/src/main.tsx`: imports the bundled fonts and `abode/abode.css`
- `apps/web/src/themePalette.ts`: adds `ABODE_THEMES` (Amber, Azure) to the web built-in definitions (not shared `BUILT_IN_THEMES`: mobile mirrors it). A new abode theme goes in that list and needs no new hook, apart from its id in shared and its boot colors in `index.html`
- `packages/shared/src/themePalettes.ts`: reserves the ids `abode` and `abode-azure` (one line each)
- `apps/web/src/hooks/useTheme.ts`: default theme and default appearance for a fresh profile
- `apps/web/index.html`, `src/themeBoot.test.ts`: boot splash palettes for the abode themes; nothing stored boots as abode (Amber)
- `apps/web/index.html`, `public/manifest.webmanifest`: tab icon, splash logo and title point at `public/abode/` (rendered from `public/abode/icon.svg` with `rsvg-convert`; upstream's own icons stay in place, unused)
- `apps/web/src/branding.ts`, `src/branding.test.ts`: the product name is "abode" (the desktop app's injected name still wins)
- `apps/web/src/components/sidebar/SidebarChrome.tsx`: `SidebarBrandMark` shows "abode" instead of the T3 wordmark (Settings sidebar header and the sidebar width probe)
- `ThemeSettings.tsx`, `CommandPalette.tsx`: list the abode theme cards / commands (`...ABODE_THEMES`)
- `apps/web/src/components/CommandPalette.tsx`: A-005: one line, `actionItems.push(...abodePanelToggleActions())`, adds Toggle sidebar / terminal / side panel
- `apps/web/src/components/chat/MessagesTimeline.tsx`: A-007: `useStableRows(useSimpleRows(rawRows, timelineEntries), ...)` filters the derived rows by the Calm/Detailed mode (A-019: Calm replaced Simple, same hook line) (Detailed returns the same array)
- `apps/web/src/hooks/useThreadActionMenu.ts`, `components/threadActionMenu.logic.ts`: A-007: header menu gets a Transcript submenu (`abode:${string}` ids); the palette row rides on `abodePanelToggleActions`
- `packages/contracts/src/rpc.ts`, `index.ts`: three `customizations.*` RPCs (add-only)
- `apps/server/src/ws.ts`, `auth/RpcAuthorization.ts`: wires the Customizations service (add-only)
- `apps/server/src/observability/RpcInstrumentation.ts`: span aggregate names for the three `customizations.*` RPCs (add-only)
- Host voice (A-029), all add-only: `packages/contracts/src/rpc.ts` and `index.ts` (import, `WS_METHODS.voice`, group entry; the RPC itself is defined in `abodeVoice.ts`), `apps/server/src/ws.ts` (import, service, one handler line, layer), `auth/RpcAuthorization.ts` (orchestration:operate) and `observability/RpcInstrumentation.ts` (one line each). `apps/server/vite.config.ts` adds `src/abode/voice/voiceWorker.ts` as a bundle entry (the worker thread that runs the model); `scripts/lib/cli-external-packages.ts` (and its test list) keeps `sherpa-onnx-node` external, so the desktop sidecar installs it. `apps/server/package.json` + lockfile: `sherpa-onnx-node` (native, Apache-2.0). `third-party-licenses.config.json`: notices for `sherpa-onnx-node` and `sherpa-onnx-linux-x64`; a build on another platform needs its `sherpa-onnx-<platform>-<arch>` added the same way. No client hook: the composer's voice control already lives in `abode/`
- `apps/web/src/components/chat/ChatComposer.tsx`: voice: `beforeActions` slot in the footer, `voiceAction` element, `insertComposerText` accepts a numeric offset
- `apps/web/src/components/chat/ChatComposer.tsx`: A-006: the `composer.stash` key handler returns early for key presses inside the customization editor (`data-abode-editor`), so Ctrl+S saves the file there (2 lines)
- `apps/web/src/components/ComposerPromptEditorTiptap.tsx`: voice: registers the provisional-dictation extension, exposes `provisionalDictation` on the editor handle, hides placeholder while dictating
- `apps/web/src/components/settings/SettingsPanels.tsx`: renders `AbodeSettingsSections` (abode chat, then voice) in General settings
- `apps/web/src/components/ChatView.tsx`: A-006: the lazy `FilePreviewPanel` import points at `abode/customizations/FilePreviewPanelRouter`, which opens customization files (skills, agents, `~/.claude/...`) in abode's editor and passes every other file to upstream's panel (2 lines)
- `apps/web/package.json`, `pnpm-workspace.yaml`: voice: `@huggingface/transformers`, `onnxruntime-web` (pinned to transformers.js's version); `allowBuilds` entries for their optional native deps
- `third-party-licenses.config.json`: voice: generated notices for onnxruntime, guid-typescript and sharp-libvips (the production build fails without them)

- `apps/web/src/components/ChatMarkdown.tsx`: A-009: `remarkAbodeCallouts` in the remark plugin list and `ABODE_ALERT_PRESENTATIONS` as the fallback in the blockquote renderer's alert lookup (3 lines incl. import); abode's callouts ride on upstream's GitHub-alert rendering

- `apps/web/src/components/chat/DraftHeroHeadline.tsx`: A-023: the project trigger's content is `<ProjectChipLabel>` (folder, name, chevron), each picker row gets `<ProjectPathHint>`, and the popup is `w-96` (4 lines + import); abode.css draws the chip on `[data-draft-project-trigger]`
- `apps/web/src/components/ChatView.tsx`: A-020: `<CalmCard threadRef=… />` just above the composer anchor in the composer stack (1 line + import); it reads the thread itself and shows only in Calm
- `apps/web/src/components/ChatView.tsx`: A-015: `<ChatAvatars threadRef=… />` right after the chat column (1 line + import); it hands the timeline its avatars as CSS variables on the shared flex container
- Avatars beside messages need no hook: `abode/chat/chat.css` targets the timeline's existing `data-timeline-row-kind` / `data-message-role` attributes. If upstream renames those, avatars silently disappear (nothing breaks)
- `packages/contracts/src/orchestrationV2.ts`: A-018: optional `agentType` on `OrchestrationV2Subagent` (1 line, add-only; ADR 0001)
- `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts`: A-018: the `task_started` and `task_progress` calls spread `abodeAgentType(message)` (`apps/server/src/abode/subagentType.ts`, reads the frame's `subagent_type`); `updateClaudeSubagentNode` takes `agentType` and fills it when the subagent has none yet (8 lines, marked `abode:`). Known gap: a subagent recovered after a restart (`recoverResumedClaudeSubagent`) is rebuilt without the type until a later frame carrying it arrives. If upstream stores the type itself, drop this and read theirs

Tickets add a bullet here when they add a hook.

### What the abode shell reads from upstream (check these when a sync breaks the build)

`apps/web/src/abode/shell/` replaces upstream's two thread sidebars, so it depends on their building blocks instead of copying them. A type error after a sync usually points at one of these:

- `components/Sidebar.logic.ts`: `resolveThreadStatusPill`, `resolveSidebarThreadStatus`, `sortSidebarV2ProjectGroups`, `orderItemsByPreferredIds`, `useSidebarRowSubscriptionLease`, thread-jump and traversal helpers.
- `components/threadActionMenu.logic.ts` (`buildThreadActionMenuItems`), `components/ThreadStatusIndicators.tsx` (PR state), `components/sidebar/*` (update pills, undo notice).
- `sidebarProjectGrouping.ts`, `logicalProject.ts`, `uiStateStore.ts` (expansion and project order), `composerDraftStore.ts` (drafts), `hooks/useThreadActions.ts`, `hooks/useHandleNewThread.ts`.
- Subagents are ordinary V2 threads (`lineage.relationshipToParent === "subagent"`), nested by `subagentNesting.ts`.
- The three panel toggles press upstream's own `sidebar.toggle`, `terminal.toggle` and `rightPanel.toggle` shortcuts (`panelToggles.ts`); nothing in the shell keeps panel state of its own.
- The bottom of the sidebar holds `<div data-abode-slot="customizations">` (A-006, `display: contents`) with the Customizations section. It reads `useRightPanelStore.openFile` (absolute paths open as file tabs), the thread shell and project for the workspace root, and `FilePreviewPanel`'s props (the router forwards them unchanged).

## Pulling upstream (each nightly, or whenever upstream ships something good)

```bash
scripts/abode/sync-upstream.sh            # merges the newest nightly tag into abode-next
scripts/abode/sync-upstream.sh <tag>      # or a specific tag
```

The script:

1. fetches upstream tags and picks the newest `*-nightly.*` tag;
2. warns if `ORCHESTRATION_PROTOCOL_VERSION` changed (the phone app must be on the same protocol);
3. merges the tag into the current branch (merge, never rebase: no force-push needed);
4. on conflicts, stops and lists them. With the rules above they should only be in the hook lines;
5. runs the hook report.

Then run the abode tests (`cd apps/web && vp test run src/abode`), typecheck, and check the app before updating the host.

## What was dropped from the first fork, and why

- **Autonomous mode** (server reactor and policy): it was built on V1 orchestration internals. Rebuild later on V2's own task and delegation API if it's still wanted.
- **Fork DB columns** (`forkColumns.ts`), and edits to the Claude adapter, projector, decider, projection queries, git driver: engine edits, the main source of conflicts.
- **The `legacySidebarEnabled` default change:** abode's sidebar replaces both upstream sidebars from its own hook, so no contract default needs changing.
