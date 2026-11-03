/**
 * Plan format: `Goal: <line>`, `## Milestone: <name>` headings, tickets as `### X-NNN: title` with a
 * `- **Status:** todo|doing|blocked|review|done (note)` line. Done = all tickets done; first not-done
 * is current. Without milestones, `## Phase X: <title>` headings are used; other `##` are ignored.
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
  name: string;
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
  review: "running",
  done: "done",
};

const GOAL = /^Goal:\s*(.+?)\s*$/;
const H2 = /^##\s+(.*?)\s*$/;
const MILESTONE = /^Milestone:\s*(.+)$/;
const PHASE = /^Phase\s+\S+?:\s*(.+)$/;
const TICKET = /^###\s+([A-Za-z]+-\d+):\s*(.*?)\s*$/;
const STATUS = /^-\s+\*\*Status:\*\*\s*(\w+)\s*(?:\((.*)\)|(.*))?$/;

export function parsePlan(markdown: string): Plan {
  let goal: string | undefined;
  const groups: { name: string; tickets: Ticket[] }[] = [];
  let group: { name: string; tickets: Ticket[] } | undefined;
  let ticket: Ticket | undefined;

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const h2 = H2.exec(line);
    if (h2 && !line.startsWith("###")) {
      const title = h2[1]!;
      const name = MILESTONE.exec(title)?.[1] ?? PHASE.exec(title)?.[1];
      group = name ? { name: name.trim(), tickets: [] } : undefined;
      if (group) groups.push(group);
      ticket = undefined;
      continue;
    }
    const t = TICKET.exec(line);
    if (t) {
      ticket = { id: t[1]!, name: t[2]!, state: "todo" };
      group?.tickets.push(ticket);
      continue;
    }
    const status = STATUS.exec(line);
    if (status && ticket) {
      ticket.state = STATUS_STATE[status[1]!.toLowerCase()] ?? "todo";
      const note = (status[2] ?? status[3] ?? "").trim();
      if (note) ticket.note = note;
      ticket = undefined;
      continue;
    }
    if (goal === undefined) goal = GOAL.exec(line)?.[1];
  }

  let currentTaken = false;
  const milestones = groups
    .filter((g) => g.tickets.length > 0)
    .map((g): Milestone => {
      const done = g.tickets.filter((t) => t.state === "done").length;
      const allDone = done === g.tickets.length;
      const state: MilestoneState = allDone ? "done" : currentTaken ? "todo" : "current";
      if (!allDone) currentTaken = true;
      return { name: g.name, state, done, total: g.tickets.length, tickets: g.tickets };
    });

  return goal === undefined ? { milestones } : { goal, milestones };
}
