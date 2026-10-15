# 0001: Record the subagent type in the Claude adapter

Status: accepted (2026-10-14, Abhishek)

## Context

Calm mode (docs/briefs/calm-mode.md) groups subagents by type ("🛠️ developer 3/5"). Claude's Agent tool input carries `subagent_type`, but `ClaudeAdapterV2` keeps only the description as the subagent's title and drops the type. The fork's rule is "engine untouched" (docs/upstream-sync.md), and guessing the type from the description gives wrong names.

## Decision

Make one marked `abode:` hook in the Claude adapter: copy `subagent_type` into a new optional `agentType` field on the subagent projection. The field is optional and add-only, so the official mobile app and older clients ignore it (docs/lessons.md). Codex leaves it empty.

## Consequences

- The hook goes in the hook table and counts against the 400-line budget.
- A monthly upstream merge can conflict in the adapter; the hook stays a few lines so the conflict is trivial.
- If upstream starts storing the type itself, drop the hook and read theirs.
