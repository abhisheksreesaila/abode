export type SessionMode = "auto" | "tell" | "grill" | "jam";
export type SessionState = "running" | "waiting" | "blocked" | "landed" | "idle";

export interface RouteSession {
  readonly id: string;
  readonly title: string;
  readonly mode: SessionMode;
  readonly state: SessionState;
  readonly keywords: ReadonlyArray<string>;
}
export interface RouteWorkspace {
  readonly key: string;
  readonly name: string;
  readonly sessions: ReadonlyArray<RouteSession>;
}
export interface RouteContext {
  readonly view: "workspace" | "overview";
  readonly selectedWorkspaceKey: string;
  readonly pinned?: string | undefined;
  readonly workspaces: ReadonlyArray<RouteWorkspace>;
}
export type RouteTarget =
  | { readonly workspaceKey: string; readonly sessionId: string | null }
  | { readonly all: true };
export interface Route {
  readonly target: RouteTarget;
  readonly reason: string;
}

const STOPWORDS = new Set(
  "a an and are as at be but by for from has have in into is it its of on or our so that the this to was we with you your".split(
    " ",
  ),
);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasPhrase = (text: string, phrase: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(phrase)}(?![\\p{L}\\p{N}])`, "iu").test(text);

const GENERIC = new Set(
  "fix update refresh add change make check test build bug issue thing stuff page work".split(" "),
);

function keywordsOf(s: RouteSession): ReadonlyArray<string> {
  const explicit = s.keywords.map((k) => k.trim()).filter((k) => k.length > 0);
  if (explicit.length > 0) return explicit;
  return s.title
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !GENERIC.has(w));
}

/** The session whose keywords match the text best (most hits, earliest on a tie). */
export function matchSession(
  text: string,
  sessions: ReadonlyArray<RouteSession>,
): { session: RouteSession; keyword: string } | null {
  let best: { session: RouteSession; keyword: string; score: number } | null = null;
  for (const session of sessions) {
    const hits = keywordsOf(session).filter((k) => hasPhrase(text, k));
    if (hits.length > (best?.score ?? 0)) best = { session, keyword: hits[0]!, score: hits.length };
  }
  return best;
}

const nameVariants = (name: string) => [name, name.replace(/[-_]/g, " ")];

/** A name must be a whole tail like "git away" or "the git-away plan", nothing more. */
export function findWorkspaceByName(
  tail: string,
  workspaces: ReadonlyArray<RouteWorkspace>,
): RouteWorkspace | null {
  const t = tail
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/(?:'s)?\s+(?:docs\/plan\.md|plan)\W*$/, "")
    .replace(/\W+$/, "");
  return workspaces.find((w) => nameVariants(w.name.toLowerCase()).includes(t)) ?? null;
}

/**
 * The workspace the text names (longest name wins); "git-away" also matches "git away".
 * Names under 4 letters only count as "<name>:", "in <name>" or "on <name>".
 */
function matchWorkspace(
  text: string,
  workspaces: ReadonlyArray<RouteWorkspace>,
): RouteWorkspace | null {
  let best: RouteWorkspace | null = null;
  for (const w of workspaces) {
    const named = nameVariants(w.name).some((n) =>
      n.length >= 4
        ? hasPhrase(text, n)
        : hasPhrase(text, `${n}:`) || hasPhrase(text, `in ${n}`) || hasPhrase(text, `on ${n}`),
    );
    if (!named) continue;
    if (!best || w.name.length > best.name.length) best = w;
  }
  return best;
}

function fallbackSession(sessions: ReadonlyArray<RouteSession>): [RouteSession, string] | null {
  const open = (s: RouteSession) => s.state !== "landed";
  const pick = (test: (s: RouteSession) => boolean, why: string): [RouteSession, string] | null => {
    const s = sessions.find(test);
    return s ? [s, why] : null;
  };
  return (
    pick((s) => s.mode === "grill" && open(s), "open Grill me") ??
    pick((s) => s.mode === "jam" && open(s), "the jam") ??
    pick((s) => s.state === "blocked" || s.state === "waiting", "needs you") ??
    pick((s) => s.state === "running", "live session") ??
    (sessions[0] ? [sessions[0], "first session"] : null)
  );
}

function routeWithin(text: string, w: RouteWorkspace): Route {
  const hit = matchSession(text, w.sessions);
  if (hit) {
    return {
      target: { workspaceKey: w.key, sessionId: hit.session.id },
      reason: `keyword: ${hit.keyword}`,
    };
  }
  const fb = fallbackSession(w.sessions);
  return {
    target: { workspaceKey: w.key, sessionId: fb?.[0].id ?? null },
    reason: fb?.[1] ?? "empty workspace",
  };
}

export function routeMessage(text: string, ctx: RouteContext): Route {
  if (ctx.pinned) {
    const w = ctx.workspaces.find((x) => x.sessions.some((s) => s.id === ctx.pinned));
    if (w) return { target: { workspaceKey: w.key, sessionId: ctx.pinned }, reason: "pinned" };
  }
  if (ctx.view === "overview") {
    const named = matchWorkspace(text, ctx.workspaces);
    return named ? routeWithin(text, named) : { target: { all: true }, reason: "overview" };
  }
  const w = ctx.workspaces.find((x) => x.key === ctx.selectedWorkspaceKey);
  return w
    ? routeWithin(text, w)
    : {
        target: { workspaceKey: ctx.selectedWorkspaceKey, sessionId: null },
        reason: "no workspace",
      };
}

/** The target chip: "workspace · auto", or "workspace · Session title" when pinned. */
export function targetLabel(ctx: RouteContext): string {
  if (ctx.view === "overview" && !ctx.pinned) return "all workspaces";
  const pinned = ctx.pinned
    ? ctx.workspaces
        .flatMap((w) => w.sessions.map((s) => [w, s] as const))
        .find(([, s]) => s.id === ctx.pinned)
    : undefined;
  if (pinned) return `${pinned[0].name} · ${pinned[1].title}`;
  const w = ctx.workspaces.find((x) => x.key === ctx.selectedWorkspaceKey);
  return `${w?.name ?? ctx.selectedWorkspaceKey} · auto`;
}
