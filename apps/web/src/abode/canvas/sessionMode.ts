export type SessionMode = "auto" | "tell" | "grill" | "jam";

export const DEFAULT_MODE: SessionMode = "auto";

/** Label and the one-line steering message the thread gets when a session switches to the mode. */
export const MODES: Readonly<
  Record<SessionMode, { readonly label: string; readonly steer: string }>
> = {
  auto: {
    label: "Autopilot",
    steer: "Mode: Autopilot. Carry on by yourself; only stop for anything blocked or irreversible.",
  },
  tell: {
    label: "Tell me",
    steer: "Mode: Tell me. Keep a one or two line brief of where you are current for me.",
  },
  grill: {
    label: "Grill me",
    steer: "Mode: Grill me. Ask me before planning, one question at a time.",
  },
  jam: {
    label: "Jam",
    steer: "Mode: Jam. Explore design options with me and put them up side by side.",
  },
};

export const MODE_ORDER: ReadonlyArray<SessionMode> = ["auto", "tell", "grill", "jam"];

function isSessionMode(value: unknown): value is SessionMode {
  return typeof value === "string" && Object.hasOwn(MODES, value);
}

/** The message to send when a session moves between modes; nothing when the mode did not change. */
export function steeringMessage(from: SessionMode, to: SessionMode): string | null {
  return from === to ? null : MODES[to].steer;
}

/**
 * Stores the new mode, then sends the thread its one steering message. A failed send puts the
 * old mode back and returns the error; an unchanged mode does nothing.
 */
export async function changeMode(input: {
  readonly from: SessionMode;
  readonly to: SessionMode;
  readonly store: (mode: SessionMode) => void;
  readonly send: (text: string) => Promise<Error | null>;
}): Promise<Error | null> {
  const text = steeringMessage(input.from, input.to);
  if (text === null) return null;
  input.store(input.to);
  const error = await input.send(text);
  if (error !== null) input.store(input.from);
  return error;
}

/** Keeps only known, non-default modes from stored data. */
export function sanitizeModes(value: unknown): Record<string, SessionMode> {
  if (typeof value !== "object" || value === null) return {};
  const modes: Record<string, SessionMode> = {};
  for (const [key, mode] of Object.entries(value)) {
    if (isSessionMode(mode) && mode !== DEFAULT_MODE) modes[key] = mode;
  }
  return modes;
}
