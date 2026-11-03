import {
  findWorkspaceByName,
  matchSession,
  type RouteContext,
  type SessionMode,
} from "./routeMessage";

export type OmniboxCommand =
  | { readonly kind: "setMode"; readonly sessionId: string; readonly mode: SessionMode }
  | { readonly kind: "addToPlan"; readonly workspaceKey: string; readonly text: string }
  | { readonly kind: "newWorkspace"; readonly name: string; readonly goal?: string }
  | { readonly kind: "briefMe" }
  | { readonly kind: "tour" };

const MODES: Record<string, SessionMode> = {
  "grill me": "grill",
  grill: "grill",
  "tell me": "tell",
  autopilot: "auto",
  auto: "auto",
  jam: "jam",
};

const SENTENCE_VERB =
  /\b(is|are|was|were|has|have|should|must|needs?|isn't|aren't|doesn't|don't|won't)\b/i;
const trimEnd = (s: string) => s.trim().replace(/[.?!\s]+$/, "");
const unquote = (s: string) => s.trim().replace(/^["“'](.*)["”']$/, "$1");

export function parseCommand(input: string, ctx: RouteContext): OmniboxCommand | null {
  const text = input.trim();
  if (/^(brief me|give me a brief|status brief)\W*$/i.test(text)) return { kind: "briefMe" };
  if (/^(\?|(take (me on )?a )?tour)\W*$/i.test(text)) return { kind: "tour" };

  const nw = /^(?:new|create)\s+workspace\s+(.+?)(?:\s*,?\s*goal\s*[:=-]\s*(.+))?$/i.exec(text);
  if (nw) {
    const name = unquote(trimEnd(nw[1]!));
    const goal = nw[2] ? trimEnd(nw[2]) : "";
    if (goal) return { kind: "newWorkspace", name, goal };
    const shortName = name.split(/\s+/).length <= 3 && !SENTENCE_VERB.test(name);
    return shortName ? { kind: "newWorkspace", name } : null;
  }

  const mode =
    /^(?:put|set|switch|move)\s+(.+?)\s+(?:on|to|in)\s+(grill me|grill|tell me|autopilot|auto|jam)\W*$/i.exec(
      text,
    );
  if (mode) {
    const scoped =
      ctx.view === "overview"
        ? ctx.workspaces
        : ctx.workspaces.filter((w) => w.key === ctx.selectedWorkspaceKey);
    const hit = matchSession(
      mode[1]!,
      scoped.flatMap((w) => w.sessions),
    );
    return hit
      ? { kind: "setMode", sessionId: hit.session.id, mode: MODES[mode[2]!.toLowerCase()]! }
      : null;
  }

  const add = /^add\s+(.+)\s+to\s+(.+?)$/i.exec(text);
  if (add) {
    const w = findWorkspaceByName(add[2]!, ctx.workspaces);
    if (w) return { kind: "addToPlan", workspaceKey: w.key, text: add[1]!.trim() };
  }
  return null;
}
