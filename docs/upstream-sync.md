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

`t3 theme set abode` does not work by design: abode stays out of `BUILT_IN_THEME_IDS` so the mobile app's theme ids are unchanged.

- `apps/web/src/components/AppSidebarLayout.tsx`: renders `ActivityBar` + `AbodeSidebar` instead of `LegacySidebar`/`Sidebar` (A-005); spreads `abodeShellProviderStyle` into the provider style, before the macOS inset. Those two sidebar files stay in the tree, unused
- `apps/web/src/main.tsx`: imports the bundled fonts and `abode/abode.css`
- `apps/web/src/themePalette.ts`: adds `ABODE_THEME` to the web built-in definitions (not shared `BUILT_IN_THEMES`: mobile mirrors it)
- `packages/shared/src/themePalettes.ts`: reserves the id `abode` (one line)
- `apps/web/src/hooks/useTheme.ts`: default theme and default appearance for a fresh profile
- `apps/web/index.html`, `src/themeBoot.test.ts`: boot splash palette for abode; nothing stored boots as abode
- `ThemeSettings.tsx`, `CommandPalette.tsx`: list the abode theme card / command
- `apps/web/src/components/CommandPalette.tsx`: A-005: one line, `actionItems.push(...abodePanelToggleActions())`, adds Toggle sidebar / terminal / side panel
- `apps/web/src/components/chat/MessagesTimeline.tsx`: A-007: `useStableRows(useSimpleRows(rawRows, timelineEntries), ...)` filters the derived rows by the Simple/Detailed mode (Detailed returns the same array)
- `apps/web/src/hooks/useThreadActionMenu.ts`, `components/threadActionMenu.logic.ts`: A-007: header menu gets a Transcript submenu (`abode:${string}` ids); the palette row rides on `abodePanelToggleActions`
- `packages/contracts/src/rpc.ts`, `index.ts`: three `customizations.*` RPCs (add-only)
- `apps/server/src/ws.ts`, `auth/RpcAuthorization.ts`: wires the Customizations service (add-only)
- `apps/server/src/observability/RpcInstrumentation.ts`: span aggregate names for the three `customizations.*` RPCs (add-only)
- `apps/web/src/components/chat/ChatComposer.tsx`: voice: `beforeActions` slot in the footer, `voiceAction` element, `insertComposerText` accepts a numeric offset
- `apps/web/src/components/ComposerPromptEditorTiptap.tsx`: voice: registers the provisional-dictation extension, exposes `provisionalDictation` on the editor handle, hides placeholder while dictating
- `apps/web/src/components/settings/SettingsPanels.tsx`: voice: renders `VoiceSettingsSection` in General settings
- `apps/web/package.json`, `pnpm-workspace.yaml`: voice: `@huggingface/transformers`, `onnxruntime-web` (pinned to transformers.js's version); `allowBuilds` entries for their optional native deps
- `third-party-licenses.config.json`: voice: generated notices for onnxruntime, guid-typescript and sharp-libvips (the production build fails without them)

Tickets add a bullet here when they add a hook.

### What the abode shell reads from upstream (check these when a sync breaks the build)

`apps/web/src/abode/shell/` replaces upstream's two thread sidebars, so it depends on their building blocks instead of copying them. A type error after a sync usually points at one of these:

- `components/Sidebar.logic.ts`: `resolveThreadStatusPill`, `resolveSidebarThreadStatus`, `sortSidebarV2ProjectGroups`, `orderItemsByPreferredIds`, `useSidebarRowSubscriptionLease`, thread-jump and traversal helpers.
- `components/threadActionMenu.logic.ts` (`buildThreadActionMenuItems`), `components/ThreadStatusIndicators.tsx` (PR state), `components/sidebar/*` (update pills, undo notice).
- `sidebarProjectGrouping.ts`, `logicalProject.ts`, `uiStateStore.ts` (expansion and project order), `composerDraftStore.ts` (drafts), `hooks/useThreadActions.ts`, `hooks/useHandleNewThread.ts`.
- Subagents are ordinary V2 threads (`lineage.relationshipToParent === "subagent"`), nested by `subagentNesting.ts`.
- The three panel toggles press upstream's own `sidebar.toggle`, `terminal.toggle` and `rightPanel.toggle` shortcuts (`panelToggles.ts`); nothing in the shell keeps panel state of its own.
- The bottom of the sidebar holds an empty `<div data-abode-slot="customizations">` for A-006.

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
