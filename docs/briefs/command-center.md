Status: superseded by docs/briefs/one-window.md (2026-11-03)

# Command center: unattended work, decisions only

Builds on docs/briefs/control-room.md (A-032..A-034), which stays the live view inside abode.

## Why (the mission)

- Why this exists: Abhishek is busy for the next two weeks and wants his 10 to 15 workspaces to keep moving around the clock, pulling him in only for major decisions.
- Why now: past 3 or 4 workspaces, babysitting breaks down: walls of text, questions mid-run, no idea what's running, asking for status.
- If it's never built: work stops whenever he's away, and he can only handle 3 or 4 workspaces at a time.

## Who it's for

- Abhishek, between other work: sets the vision once per workspace, reads a digest morning and evening, answers decisions by comment.
- Today: the sidebar plus each thread's chat; he clicks into every workspace to learn its state.

## What it does

- The core job: keep agents working through approved plans unattended, and put progress and decisions on one page twice a day.
- v1, in order (the autopilot loop ships first):
  1. **Autopilot loop.** One upstream scheduled task per workspace (interval, skips while a run is going): "continue docs/plan.md under autopilot rules". It covers every workspace with an approved brief and a plan; `Autopilot: off` in a repo's CLAUDE.md excludes it. Agents decide anything reversible inside an approved brief and write it to a decision log. A ticket waiting on him is marked `needs you`, and the agent moves on to the next ticket that doesn't depend on it. (assumed)
  2. **Decisions.** Only new product direction, irreversible steps (host update, deploy, merge, delete, money) and real blocks (a key, an account) reach him.
  3. **Permissions.** Full-access runtime with a Claude Code deny list (host update, force-push, `rm -rf`, deploys, `gh pr merge`, reading `.env`). A blocked step becomes a decision.
  4. **Digest artifact, morning and evening.** A scheduled job first routes new comments on the digest to their workspace's thread (or answers the waiting decision), then republishes one claude.ai artifact. At the top, the decisions waiting, each with its context and options. Below, the control-room table: one row per workspace with status, N of M tickets, what moved since the last digest, and the decision log behind a toggle.
  5. **Idle list.** Each plan.md gets an `Idle` section of standing jobs (DuckDB tests, benchmarks, dependency checks) that run only when that workspace has no other work queued, and report into the digest.
  6. **Mac M4 Pro** paired as a linked environment. Tickets and idle jobs tagged `Machine: mac` (Mac builds, Metal/GPU, DuckDB-on-GPU) run there; everything else stays here. Pairing is a setup script he runs.
  7. **Weekly upstream sync.** A weekly scheduled task merges the newest nightly on a branch and runs the checks plus the hook budget. If it's clean, it lands on abode-next and "Update host?" becomes a decision. Hooks get trimmed under budget before the first run.
- Not doing: changes to abode's engine; a live digest page that reads abode over the tailnet; a conductor that sets priorities across workspaces; phone pushes; Claude-limit reserves.

## How it should look and feel

- Three words: quiet, glanceable, trustworthy.
- Feels like: a CI status page with an inbox on top. The digest uses the same table look as the control room, in omxqua, phone first (decisions stack as cards on a phone).

## How we'll know it worked

- After two busy weeks: autopilot workspaces finished tickets with reviewer PASS while he was away, he answered 3 or fewer decisions a day, and he never opened a thread to learn status.
- Done for v1: a dry run on abode plus one other repo for one night; the first morning digest is read together; then everything is switched on.

## Constraints and risks

- Riskiest assumption: agents run ticket, review and fix to done without him. Cheapest test: the one-night dry run.
- Agents run Claude to the limit, so he may find none left when he opens a session himself. (accepted)
- A comment waits up to 12 hours to reach its agent, and a decision can stall its ticket that long.
- The deny list is the only guard on irreversible steps; a command it misses isn't caught.
- It must be possible for the digest job's agent to publish and read artifact comments from a scheduled run. Check that in the dry run.
- Mostly configuration (scheduled tasks, rules, deny list, scripts), with little new abode code. Only the abode/ folders and the 400-line hook budget apply.

## Decisions and trade-offs

- Agents decide reversible work inside a brief (Abhishek, 2026-11-02). Pro: few interruptions. Con: some calls he'd have made differently, undone from the log.
- Digest as an artifact, morning and evening (Abhishek). Pro: readable anywhere, calm. Con: a second place to look, and decisions can wait 12 hours.
- Weekly upstream batch (Abhishek). Pro: fewer merges. Con: bigger conflicts at the 399/400 hook budget.
- Run Claude to the limit (Abhishek). Pro: maximum throughput. Con: he may be locked out until the window resets.
- All workspaces with a plan (Abhishek). Pro: zero setup. Con: dormant repos wake up; `Autopilot: off` is the way out.
- One scheduled task per workspace (Abhishek). Pro: upstream-native, visible in Settings. Con: no priority across projects.
- The Mac takes tagged Mac/GPU work and idle jobs (Abhishek). Pro: simple routing. Con: tickets are tagged by hand.
- Backend stays upstream's: abode adds code in abode/ folders plus 78 hook lines (checked 2026-11-02).

## Open questions

- None blocking.
