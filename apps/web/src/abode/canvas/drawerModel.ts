import type { ProviderKey, SessionPill } from "./sessionPills";

const PROVIDER_LABEL: Record<ProviderKey, string> = {
  claude: "Claude",
  codex: "Codex",
  pi: "Pi",
  gemini: "Gemini",
  other: "Agent",
};

/** The drawer's model chip text (spec 5.6): "Claude · opus", or "Claude · opus → Codex builds" with a delegate. */
export function modelChipText(pill: Pick<SessionPill, "dots">, model: string): string {
  const [own, delegate] = pill.dots;
  const base = [PROVIDER_LABEL[own ?? "other"], model].filter((part) => part !== "").join(" · ");
  return delegate === undefined ? base : `${base} → ${PROVIDER_LABEL[delegate]} builds`;
}

/** One word for the drawer header: what the session is doing for the user. */
export function drawerStatus(pill: Pick<SessionPill, "running" | "status">): string {
  if (pill.status !== null) return pill.status;
  return pill.running ? "running" : "idle";
}
