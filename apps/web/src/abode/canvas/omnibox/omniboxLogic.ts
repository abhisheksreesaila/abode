import { parseCommand, type OmniboxCommand } from "./commands";
import {
  routeMessage,
  type RouteContext,
  type RouteWorkspace,
  type SessionMode,
  type SessionState,
} from "./routeMessage";

/** What the omnibox needs of a canvas workspace (structurally a `CanvasWorkspace`). */
export interface CtxWorkspace {
  readonly key: string;
  readonly name: string;
  readonly sessions: {
    readonly pills: ReadonlyArray<{
      readonly key: string;
      readonly title: string;
      readonly status: "waiting on you" | "blocked" | "landed" | null;
      readonly running: boolean;
    }>;
  };
}

function stateOf(pill: CtxWorkspace["sessions"]["pills"][number]): SessionState {
  if (pill.status === "waiting on you") return "waiting";
  if (pill.status !== null) return pill.status;
  return pill.running ? "running" : "idle";
}

/** Keywords come from each title (routeMessage's default); a session's id is its pill key. */
export function buildRouteContext(input: {
  readonly workspaces: ReadonlyArray<CtxWorkspace>;
  readonly view: RouteContext["view"];
  readonly selectedKey: string;
  readonly pinned: string | undefined;
  readonly modeOf: (sessionKey: string) => SessionMode;
}): RouteContext {
  return {
    view: input.view,
    selectedWorkspaceKey: input.selectedKey,
    pinned: input.pinned,
    workspaces: input.workspaces.map((workspace) => ({
      key: workspace.key,
      name: workspace.name,
      sessions: workspace.sessions.pills.map((pill) => ({
        id: pill.key,
        title: pill.title,
        mode: input.modeOf(pill.key),
        state: stateOf(pill),
        keywords: [],
      })),
    })),
  };
}

export function findSession<W extends CtxWorkspace>(
  workspaces: ReadonlyArray<W>,
  sessionKey: string,
): { workspace: W; pill: W["sessions"]["pills"][number] } | null {
  for (const workspace of workspaces) {
    const pill = workspace.sessions.pills.find((p) => p.key === sessionKey);
    if (pill) return { workspace, pill };
  }
  return null;
}

export interface PreviewItem {
  readonly workspaceKey: string;
  readonly workspaceName: string;
  readonly sessionId: string;
  readonly sessionTitle: string;
}

export type SendDecision =
  | { readonly kind: "command"; readonly command: OmniboxCommand }
  | {
      readonly kind: "send";
      readonly workspaceKey: string;
      readonly sessionId: string | null;
      readonly text: string;
    }
  | { readonly kind: "preview"; readonly text: string; readonly items: ReadonlyArray<PreviewItem> };

const inWorkspace = (ctx: RouteContext, workspaceKey: string): RouteContext => ({
  ...ctx,
  view: "workspace",
  selectedWorkspaceKey: workspaceKey,
  pinned: undefined,
});

/** Command first, then routing; "all workspaces" never broadcasts without a preview. */
export function decideSend(input: string, ctx: RouteContext): SendDecision {
  const text = input.trim();
  const command = parseCommand(text, ctx);
  if (command?.kind === "addToPlan") {
    const { target } = routeMessage("", inWorkspace(ctx, command.workspaceKey));
    return {
      kind: "send",
      workspaceKey: command.workspaceKey,
      sessionId: "all" in target ? null : target.sessionId,
      text: `Add this to docs/plan.md as a ticket: ${command.text}`,
    };
  }
  if (command) return { kind: "command", command };

  const { target } = routeMessage(text, ctx);
  if ("all" in target) {
    const items = ctx.workspaces.flatMap((workspace: RouteWorkspace): PreviewItem[] => {
      const routed = routeMessage(text, inWorkspace(ctx, workspace.key)).target;
      if ("all" in routed || routed.sessionId === null) return [];
      const session = workspace.sessions.find((s) => s.id === routed.sessionId);
      return session
        ? [
            {
              workspaceKey: workspace.key,
              workspaceName: workspace.name,
              sessionId: session.id,
              sessionTitle: session.title,
            },
          ]
        : [];
    });
    return { kind: "preview", text, items };
  }
  return { kind: "send", workspaceKey: target.workspaceKey, sessionId: target.sessionId, text };
}

export type OmniboxKeyAction = "focus" | "close-preview" | "close-drawer" | "blur" | null;

/**
 * `/` focuses the omnibox unless typing in any field. Esc closes the top-most layer only:
 * an open popup (left to itself), then the preview, then the drawer, then blurs the omnibox.
 */
export function omniboxKeyAction(event: {
  readonly key: string;
  readonly mod: boolean;
  readonly typing: boolean;
  readonly inOmnibox: boolean;
  readonly previewOpen: boolean;
  readonly drawerOpen: boolean;
  readonly layerOpen: boolean;
}): OmniboxKeyAction {
  if (event.key === "/") return event.mod || event.typing ? null : "focus";
  if (event.key !== "Escape" || event.layerOpen) return null;
  if (event.previewOpen) return "close-preview";
  if (event.drawerOpen) return "close-drawer";
  return event.inOmnibox ? "blur" : null;
}

/** The input is cleared only when the command or send actually went through. */
export const textAfter = (current: string, succeeded: boolean): string =>
  succeeded ? "" : current;

/** After sending a preview: only the workspaces that failed stay (never resend the rest). */
export function afterPreviewSend(
  items: ReadonlyArray<PreviewItem>,
  results: ReadonlyArray<boolean>,
): { readonly remaining: ReadonlyArray<PreviewItem>; readonly clearInput: boolean } {
  const remaining = items.filter((_, index) => results[index] !== true);
  return { remaining, clearInput: remaining.length === 0 };
}
