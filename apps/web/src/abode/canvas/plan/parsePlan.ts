/**
 * Plan formats. A/B: `## Milestone: <name>` (or `## Phase X: <name>`) with `### X-NNN: title` and
 * `- **Status:** <word> (note)` beneath. C (no `###` tickets): `# <section>` milestones, tickets as
 * `## X-NNN title [status] (note)`; with one `#` only, other `##` also split. Status: todo, doing, blocked, review (counts as done), done.
 */

export type TicketState = "done" | "running" | "stopped" | "failed" | "todo";
export type MilestoneState = "done" | "current" | "todo";

export interface Ticket {
  id: string;
  name: string;
  state: TicketState;
  /** The status word was `review`: counted as done, shown as "in review". */
  review?: true;
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
const TICKET = /^###\s+([A-Za-z]+-\d+[a-z]?):\s*(.*?)\s*$/;
const STATUS = /^-\s+\*\*Status:\*\*\s*(\w+)\s*(?:\((.*)\)|(.*))?$/;

const NAME_DETAIL = /^(.*?)\s*\((.*)\)\s*$/;

// Lines outside HTML comments and code fences, trailing space trimmed.
function plainLines(markdown: string): string[] {
  const out: string[] = [];
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
    out.push(line);
  }
  return out;
}

const H1 = /^#\s+(.*?)\s*$/;
const TICKET_C = /^##\s+([A-Za-z]+-\d+[a-z]?)\s+(.*?)\s*\[(\w+)[^\]]*\]\s*(?:\((.*)\)|(.*))?$/;
const TICKET_AB = /^###\s+[A-Za-z]+-\d+[a-z]?:/m;

type Group = { name: string; detail?: string; tickets: Ticket[] };

function parseStatusPlan(markdown: string): Group[] {
  const groups: Group[] = [];
  let group: Group | undefined;
  const lines = plainLines(markdown);
  const splitByH2 = lines.filter((l) => H1.test(l) && !l.startsWith("##")).length <= 1;
  for (const line of lines) {
    const h1 = H1.exec(line);
    if (h1 && !line.startsWith("##")) {
      const split = NAME_DETAIL.exec(h1[1]!);
      group = { name: (split?.[1] ?? h1[1]!).trim(), tickets: [] };
      if (split) group.detail = split[2]!.trim();
      groups.push(group);
      continue;
    }
    const t = TICKET_C.exec(line);
    if (!t) {
      const h2 = splitByH2 && !line.startsWith("###") ? H2.exec(line) : null;
      if (h2) {
        const split = NAME_DETAIL.exec(h2[1]!);
        group = { name: (split?.[1] ?? h2[1]!).trim(), tickets: [] };
        if (split) group.detail = split[2]!.trim();
        groups.push(group);
      }
      continue;
    }
    const ticket: Ticket = {
      id: t[1]!,
      name: t[2]!,
      state: STATUS_STATE[t[3]!.toLowerCase()] ?? "todo",
    };
    if (t[3]!.toLowerCase() === "review") ticket.review = true;
    const note = (t[4] ?? t[5] ?? "").trim();
    if (note) ticket.note = note;
    group?.tickets.push(ticket);
  }
  return groups;
}

// The current milestone is the last started, unfinished one; stale unfinished ones before it are todo.
export function parsePlan(markdown: string): Plan {
  let goal: string | undefined;
  const groups: Group[] = [];
  let group: Group | undefined;
  let ticket: Ticket | undefined;
  let awaitingStatus = false;

  for (const line of plainLines(markdown)) {
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
      if (status[1]!.toLowerCase() === "review") ticket.review = true;
      const note = (status[2] ?? status[3] ?? "").trim();
      if (note) ticket.note = note;
    }
    awaitingStatus = false;
    if (goal === undefined) goal = GOAL.exec(line)?.[1];
  }

  const kept = (TICKET_AB.test(markdown) ? groups : parseStatusPlan(markdown)).filter(
    (g) => g.tickets.length > 0,
  );
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
