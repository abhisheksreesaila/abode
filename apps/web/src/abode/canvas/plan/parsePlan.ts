/**
 * Plan format. Put tickets under a `## Milestone: <name>` heading (or `## Phase X: <name>`); a
 * trailing "(detail)" on the heading becomes the milestone's detail. Write each ticket as
 * `### X-NNN: title` with `- **Status:** <word> (note)` directly beneath: todo, doing (running),
 * blocked (stopped), review (built, reviewed, awaiting the owner: counts as done), done.
 */

export type TicketState = "done" | "running" | "stopped" | "failed" | "todo";
export type MilestoneState = "done" | "current" | "todo";

export interface Ticket {
  id: string;
  name: string;
  state: TicketState;
  note?: string;
}

export interface Milestone {
  key: string;
  name: string;
  detail?: string;
  state: MilestoneState;
  done: number;
  total: number;
  tickets: Ticket[];
}

export interface Plan {
  goal?: string;
  milestones: Milestone[];
}

const STATUS_STATE: Record<string, TicketState> = {
  todo: "todo",
  doing: "running",
  blocked: "stopped",
  review: "done",
  done: "done",
};

const GOAL = /^Goal:\s*(.+?)\s*$/;
const H2 = /^##\s+(.*?)\s*$/;
const MILESTONE = /^Milestone:\s*(.+)$/;
const PHASE = /^Phase\s+\S+?:\s*(.+)$/;
const TICKET = /^###\s+([A-Za-z]+-\d+):\s*(.*?)\s*$/;
const STATUS = /^-\s+\*\*Status:\*\*\s*(\w+)\s*(?:\((.*)\)|(.*))?$/;

const NAME_DETAIL = /^(.*?)\s*\((.*)\)\s*$/;

// The current milestone is the last started, unfinished one; stale unfinished ones before it are todo.
export function parsePlan(markdown: string): Plan {
  let goal: string | undefined;
  const groups: { name: string; detail?: string; tickets: Ticket[] }[] = [];
  let group: (typeof groups)[number] | undefined;
  let ticket: Ticket | undefined;
  let awaitingStatus = false;
  let inComment = false;
  let inFence = false;

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line.includes("<!--") && !line.includes("-->")) {
      inComment = true;
      continue;
    }
    if (line.includes("<!--")) continue;

    const h2 = H2.exec(line);
    if (h2 && !line.startsWith("###")) {
      const title = h2[1]!;
      const full = MILESTONE.exec(title)?.[1] ?? PHASE.exec(title)?.[1];
      const split = full ? NAME_DETAIL.exec(full) : null;
      group = full
        ? {
            name: (split?.[1] ?? full).trim(),
            tickets: [],
            ...(split ? { detail: split[2]!.trim() } : {}),
          }
        : undefined;
      if (group) groups.push(group);
      ticket = undefined;
      continue;
    }
    const t = TICKET.exec(line);
    if (t) {
      ticket = { id: t[1]!, name: t[2]!, state: "todo" };
      group?.tickets.push(ticket);
      awaitingStatus = true;
      continue;
    }
    if (line.trim() === "") continue;
    const status = STATUS.exec(line);
    if (status && ticket && awaitingStatus) {
      ticket.state = STATUS_STATE[status[1]!.toLowerCase()] ?? "todo";
      const note = (status[2] ?? status[3] ?? "").trim();
      if (note) ticket.note = note;
    }
    awaitingStatus = false;
    if (goal === undefined) goal = GOAL.exec(line)?.[1];
  }

  const kept = groups.filter((g) => g.tickets.length > 0);
  const complete = (g: (typeof kept)[number]) => g.tickets.every((t) => t.state === "done");
  const started = (g: (typeof kept)[number]) => g.tickets.some((t) => t.state !== "todo");
  const open = kept.filter((g) => !complete(g));
  const current = open.findLast(started) ?? open[0];

  const milestones = kept.map((g, i): Milestone => {
    const done = g.tickets.filter((t) => t.state === "done").length;
    const state: MilestoneState = complete(g) ? "done" : g === current ? "current" : "todo";
    return {
      key: `${i}-${g.name}`,
      name: g.name,
      ...(g.detail ? { detail: g.detail } : {}),
      state,
      done,
      total: g.tickets.length,
      tickets: g.tickets,
    };
  });

  return goal === undefined ? { milestones } : { goal, milestones };
}
