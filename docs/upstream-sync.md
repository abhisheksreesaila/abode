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
4. **Hooks into upstream files are small and marked.** Each one is a few lines, tagged with an `abode:` comment, and listed in the table below. `scripts/abode/hook-report.sh` prints every upstream file abode changed and fails if the total goes over budget (**400 changed lines**, not counting lockfiles).
5. **No numbered DB migrations, no contract default changes, no protocol changes** (see `docs/lessons.md`).
6. **Don't delete upstream files** abode stops using; leave them unused.

## Hook points (keep this table current)

| Upstream file                                       | What abode hooks there                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/AppSidebarLayout.tsx`      | renders `AbodeShell`/`AbodeSidebar` in place of the thread sidebar                                   |
| `apps/web/src/main.tsx`                             | imports the bundled fonts and `abode/abode.css`                                                      |
| `apps/web/src/themePalette.ts`                      | adds `ABODE_THEME` to the web built-in definitions (not shared `BUILT_IN_THEMES`: mobile mirrors it) |
| `packages/shared/src/themePalettes.ts`              | reserves the id `abode` (one line)                                                                   |
| `apps/web/src/hooks/useTheme.ts`                    | default theme and default appearance for a fresh profile                                             |
| `apps/web/index.html`, `src/themeBoot.test.ts`      | boot splash palette for abode; nothing stored boots as abode                                         |
| `ThemeSettings.tsx`, `CommandPalette.tsx`           | list the abode theme card / command                                                                  |
| `packages/contracts/src/rpc.ts`, `index.ts`         | three `customizations.*` RPCs (add-only)                                                             |
| `apps/server/src/ws.ts`, `auth/RpcAuthorization.ts` | wires the Customizations service (add-only)                                                          |
| `apps/web/src/components/chat/ChatComposer.tsx`     | mic button slot for voice                                                                            |

`t3 theme set abode` does not work by design: abode stays out of `BUILT_IN_THEME_IDS` so the mobile app's theme ids are unchanged.

Tickets add rows here when they add a hook.

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
