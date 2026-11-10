# abode on top of T3 Code: how we stay current

**Goal:** run T3 Code exactly as upstream ships it, plus one addition: the **Kit** (a daily check of the skill sources, Inherit/Skip, prune to trash), which T3 has no equivalent for.

## History

- 2026-10: abode was a full fork (130 edited upstream files, 75 conflicts after ten days), then a skin layer (abode-next: its own sidebar, overview, frame, Calm, themes, voice) at ~380 hook lines.
- 2026-11-09: Abhishek decided the custom UI wasn't worth the weekly merge cost. abode was rebuilt from upstream `v0.1.8-nightly.20261109.4433` with only the Kit (about 30 hook lines). The skin-layer history stays in git on abode-next before that commit.

## Rules

1. **Engine untouched.** No edits to orchestration, providers, persistence, projections or existing contracts.
2. **abode code lives in its own folders:** `apps/web/src/abode/`, `apps/server/src/abode/`, `packages/contracts/src/abode*.ts`.
3. **Hooks into upstream files are one-liners marked `abode:`**, listed below. `scripts/abode/hook-report.sh` counts them (budget 400; we are far under).
4. **No numbered DB migrations, no contract default changes, no protocol changes** (see `docs/lessons.md`). New RPCs are add-only, so the official mobile app keeps working.
5. `scripts/abode/sync-upstream.sh` merges the newest nightly; then typecheck, `vp lint apps/web/src/abode apps/server/src/abode`, the abode tests, and `scripts/abode/host.sh update`.

## Hook points

- `packages/contracts/src/rpc.ts`, `index.ts`: spread `ABODE_WS_METHODS` / `ABODE_RPCS` from `abodeRpcs.ts` and export the Kit contracts
- `apps/server/src/ws.ts`: `Customizations` and `SkillSources` services (SkillSources is built once in the outer `Layer.unwrap`: it owns the daily timer and the state file) and one handler spread each
- `apps/server/src/auth/RpcAuthorization.ts`, `observability/RpcInstrumentation.ts`: one spread each from `abode/kitRpcPolicy.ts`
- `apps/server/src/ws.test.ts`: mocks for the two services
- `apps/web/src/components/ChatView.tsx`: `<KitView />` first in the conversation area; it renders only on Kit threads (a project rooted at the host's home folder)
- `apps/web/src/components/AppSidebarLayout.tsx`: `<KitOpener />` beside `BackgroundThreadAnnouncer`, outside the sidebar because the phone drawer unmounts it
- `apps/web/src/components/CommandPalette.tsx`: `actionItems.push(...abodeKitActions())` adds "Open Kit"
- `apps/web/src/components/ChatMarkdown.tsx`: an `abode-prune` code fence renders the prune pick list (`PruneBlock`)

## What the Kit reads from upstream markup (a rename breaks it quietly)

- `[data-chat-canvas]`, `[data-chat-composer-overlay]`, `[data-chat-composer-stack]`: the pane docks the composer and starts below the Kit rows (`--abode-frame-h`).
- `[data-chat-canvas] > [data-thread-details-panel="inline"]` (inline `top`): the details card starts below the Kit rows and hides while a Kit pane is open.
