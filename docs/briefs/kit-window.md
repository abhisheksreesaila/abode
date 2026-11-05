Status: approved (2026-11-04, "yes" on the Kit screens)
Screens: https://claude.ai/artifact/MAxT8zMrArrRvoFEjMrcWB (row 3)

# Kit window: a lean kit that stays current

Builds on docs/briefs/workspace-tabs.md (the same frame) and replaces the Kit layout in docs/canvas/spec.md §5.10. The sources and installers table there still holds.

## Why

- Abhishek inherits skills from Matt Pocock, gstack, pstack and tstack (through npx or GitHub), and they keep changing. Today he'd have to watch four repos, and his kit only grows. The bigger pain is carrying too many skills (Abhishek, 2026-11-04).

## Who

- Abhishek, once a day or so, at his desk or on his phone.

## What

1. **Kit uses the workspace frame:** the agent strip, then the tabs Skills · MCP · Plugins · Hooks · Updates, then the same big composer, which talks to a Kit thread whose project is rooted at `~`, so the agent can read and edit the skill folders. (assumed)
2. **Updates tab, fed by a daily check:** once a day the host compares each source's skill folders (the GitHub repo at its default branch) and, for npx sources, the npm version against what it last saw. A change shows as a badge on Kit and a line in the overview's "since you last looked" feed.
   - A **new skill** gets its own card: what it does, what it costs in context, and Inherit / Skip. Skip is remembered and doesn't come back.
   - **Updates to skills you haven't edited** come as one card with "Take all".
   - **Skills you edited** show a diff, and you merge them by jamming.
3. **Pruning by jam:** the Skills tab lists each skill with its source, its context cost and, where known, when it was last used. Ask "what don't I need?" and the agent proposes cuts as a pick list. Nothing is removed without your OK. Removed skills go to `~/.claude/skills/.trash`, which is the way back. (assumed)

- Not doing: watching MCP servers or plugins for updates (assumed, later), auto-installing anything, phone pushes.

## Look and feel

- The workspace tabs screens, unchanged: omxqua · Developer · Graphite night. Cards like the Design tab's, with a pick control.

## Success

- After a week, the kit is smaller than today, and no source change went unseen for more than a day.
- Deciding on a source update takes one tap.

## Decisions and trade-offs

- **The bigger pain is too many skills** (Abhishek). Pro: success is a lean kit, so the feed shows what each skill costs. Con: the odd gem may get skipped.
- **A daily check with a badge and a feed line** (Abhishek). Pro: no new channels. Con: you only see it in abode.
- **New skills ask, unedited updates are one tap, edited ones merge by jam** (Abhishek). Pro: quick, and your edits are safe. Con: updates still need a tap.
- **The check runs on the host, add-only server code** in `apps/server/src/abode`, with its state in a T3-home file, not a DB migration. (assumed)
- **Skills are watched in `~/.claude/skills`, `~/.agents/skills` and `~/.codex/skills`**, following symlinks. (assumed)

## Open questions

- None blocking.
