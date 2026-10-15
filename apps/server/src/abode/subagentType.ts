/** A-018: the Agent tool's `subagent_type` as it arrives on a Claude task_started frame. */
export function abodeAgentType(message: unknown): { readonly agentType: string } | {} {
  const type = (message as { readonly subagent_type?: unknown } | null)?.subagent_type;
  return typeof type === "string" && type.length > 0 ? { agentType: type } : {};
}
