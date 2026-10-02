import { create } from "zustand";

/**
 * Which subagent the Agents panel should bring into view, per thread. Set by
 * the sidebar's nested subagent rows; read by the Agents panel. Not persisted:
 * it is a one-shot request, and `nonce` lets a repeat click on the same agent
 * scroll to it again.
 */
export interface AgentFocusRequest {
  readonly agentId: string;
  readonly nonce: number;
}

interface AgentFocusStoreState {
  readonly focusByThreadKey: Readonly<Record<string, AgentFocusRequest>>;
  focusAgent: (threadKey: string, agentId: string) => void;
}

export const useAgentFocusStore = create<AgentFocusStoreState>()((set) => ({
  focusByThreadKey: {},
  focusAgent: (threadKey, agentId) =>
    set((state) => ({
      focusByThreadKey: {
        ...state.focusByThreadKey,
        [threadKey]: { agentId, nonce: (state.focusByThreadKey[threadKey]?.nonce ?? 0) + 1 },
      },
    })),
}));
