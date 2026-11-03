Status: approved (2026-11-03, "go on autopilot" with the spec and the four decisions)

# One Window: one canvas for every workspace

Spec: docs/canvas/spec.md · prototype: docs/canvas/prototype.html (section C3) · repo map: docs/canvas/repo-map.md.
Replaces docs/briefs/command-center.md. Its autopilot backend (scheduled tasks, deny list, weekly sync) carries over.

## Why

- Past 3 or 4 workspaces, babysitting through the sidebar and chat breaks down. Abhishek wants to set the vision, watch progress and answer only what needs him, all from one window, over the next busy weeks and after.

## Who

- Abhishek at his desk (web on the host, :3773) and on his phone, running about 10 workspaces across ablearn and the M4 Pro.

## What (v1 = spec phases P0, P1, P2, P5)

1. **Shell behind a flag:** top bar, workspace rail and omnibox. The flag lives in an abode local store, and stock abode is unchanged when it's off.
2. **Workspace view:** session pills (mode icon, model dots, status word), a per-session mode (Autopilot, Tell me, Grill me, Jam), the blocks each mode adds, interrupt cards, and a milestones checklist with tickets inside the current milestone.
3. **Omnibox and chat drawer:** bound to the real T3 threads, with keyword routing, the target chip and the 5.5 commands.
4. **Overview (`o`):** hero line, usage meters, one section per machine with its mascot, workspace rows and the "since you last looked" feed. It fits 1440 × 900.

- Next, in order: P4 journey map, P3 monitor. Later: P6 design session, P7 Kit, P8 voice.
- Not doing: engine changes, new upstream hooks, upstream contract edits, a committed `.t3/` folder.

## Look and feel

- omxqua · Developer · Graphite night, exactly as in the prototype's C3. The prototype wins on look, the spec on behaviour. The cartoon style is only for the map, the mascots and the mode characters.

## Success

- The overview shows in under 3 seconds what needs him, on both machines, without opening a thread.
- He steers a session from the omnibox without opening its chat.
- The phone app still pairs and works unchanged.

## Constraints and decisions

- **One Window replaces the command-center brief** (Abhishek, 2026-11-03). Pro: one design. Con: the digest artifact is shelved.
- **Goal and milestones live in each project's `docs/plan.md`**, as a `Goal:` line plus milestone headings (Abhishek). Pro: one source of truth that travels with the repo, and agents already write it. Con: the parser depends on the format holding.
- **v1 is P0, P1, P2 and P5** (Abhishek). Pro: it cures the babysitting first. Con: no design jam yet.
- **It mounts through abode's existing hooks** (the Control room route, the abode sidebar), with no new upstream lines (Abhishek). Pro: merges stay easy. Con: the canvas takes the Control room's place when the flag is on.
- **Conventions:** code goes in `apps/web/src/abode/canvas/` with `cv-` class names. Mounts use `abode:` markers, not `canvas-mount`.
- **Mobile:** web-only UI; any server addition is add-only, and the protocol stays at 2.
- **Per-session mode is stored per device for v1.** Changing it also sends the thread a one-line steering message, so the agent behaves accordingly. (assumed) Syncing modes across devices would need abode's first server table; deferred.
- **Desktop-only in T3:** element pick, UI screenshots, sign-in partitions and `previewUrl`. That matters for P6 later, not for v1.
- **Guest share needs T3 Connect.**

## Open questions

- None blocking v1.
