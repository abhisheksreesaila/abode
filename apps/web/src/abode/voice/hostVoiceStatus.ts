import type { VoiceStatus } from "@t3tools/contracts";

import { formatModelSize } from "./voiceModel";

/**
 * Who turns speech into text: the host's Nemotron when it reports a ready model, otherwise
 * Moonshine in this browser. `null` status (an older server, a failed request, or not asked
 * yet) always means the browser: the host path is only used on a positive answer.
 */
export type VoiceEngine = "host" | "browser";

export function pickVoiceEngine(status: VoiceStatus | null): VoiceEngine {
  return status?.model === "ready" ? "host" : "browser";
}

export function describeVoiceEngine(engine: VoiceEngine): string {
  return engine === "host" ? "On this computer: Nemotron" : "In the browser: Moonshine";
}

export interface HostModelRow {
  readonly description: string;
  /** The button the row offers, if any. */
  readonly action: "download" | "retry" | null;
}

/** The Settings › Voice row for the host's model. */
export function describeHostModel(status: VoiceStatus | null): HostModelRow {
  if (status === null) {
    return {
      description: "This server has no host voice. Dictation runs in the browser.",
      action: null,
    };
  }
  switch (status.model) {
    case "unsupported":
      return {
        description: status.message ?? "This computer can't run the host speech model.",
        action: null,
      };
    case "missing":
      return {
        description: `Not downloaded${status.sizeBytes ? `, ${formatModelSize(status.sizeBytes)}` : ""}. It downloads the first time you dictate, or now.`,
        action: "download",
      };
    case "downloading":
      return {
        description: `Downloading… ${Math.round((status.progress ?? 0) * 100)}%`,
        action: null,
      };
    case "failed":
      return { description: status.message ?? "The host speech model failed.", action: "retry" };
    case "ready":
      return {
        description: `Ready${status.sizeBytes ? `, ${formatModelSize(status.sizeBytes)}` : ""}. ${status.loaded ? "Loaded in memory." : "Loads when you dictate and unloads after a few idle minutes."}`,
        action: null,
      };
  }
}
