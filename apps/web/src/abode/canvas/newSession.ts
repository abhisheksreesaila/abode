/** A session's title from its first message: the first line, cut to 60 characters. */
export function sessionTitle(firstMessage: string): string {
  const line =
    firstMessage
      .split("\n")
      .find((entry) => entry.trim() !== "")
      ?.trim() ?? "";
  if (line === "") return "New session";
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
}

/** The project's default model when it has one, else the first usable provider's default. */
export function chooseModel<T>(projectDefault: T | null, fallback: T | null): T | null {
  return projectDefault ?? fallback;
}
