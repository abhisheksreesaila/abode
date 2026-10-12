import type { MoodMark } from "./cast/Characters";

export type Pose = "typing" | "terminal" | "search" | "reviewing" | "painting" | "thinking";

/** Upstream's rolled-up thread status (`resolveSidebarThreadStatus`), or null when idle. */
export type HelperStatus = "approval" | "input" | "working" | "failed" | "limited" | null;

export interface HelperMood {
  readonly mark: MoodMark;
  /** Follows the helper's name: "Sunny has a question for you". */
  readonly headline: string;
  readonly working: boolean;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** What the helper's face says about the thread, most urgent first. */
export function helperMood(input: {
  readonly status: HelperStatus;
  readonly openQuestions: number;
  readonly latestWarnings: number;
  readonly hasAnswer: boolean;
  /** The answer the user just gave from the board, until the next turn settles. */
  readonly agreedChoice: string | null;
}): HelperMood {
  const working = input.status === "working";
  if (input.status === "approval") return { mark: "asking", headline: "needs your OK", working };
  if (input.status === "input") {
    return { mark: "asking", headline: "has a question for you below", working };
  }
  if (input.status === "failed" || input.status === "limited") {
    return { mark: "worried", headline: "ran into a problem", working };
  }
  if (input.agreedChoice !== null) {
    return { mark: "agreed", headline: `is on it: ${input.agreedChoice}`, working };
  }
  if (working) return { mark: null, headline: "is working", working };
  if (input.openQuestions > 0) {
    const what = input.openQuestions === 1 ? "a question" : plural(input.openQuestions, "question");
    return { mark: "asking", headline: `has ${what} for you`, working };
  }
  if (input.latestWarnings > 0) {
    return {
      mark: "worried",
      headline: `is done, with ${plural(input.latestWarnings, "warning")}`,
      working,
    };
  }
  if (input.hasAnswer) return { mark: "done", headline: "is done. Your turn.", working };
  return { mark: "idle", headline: "is ready when you are", working };
}

/** The pose for the newest work item while the agent runs. */
export function activityPose(
  item: { readonly type: string; readonly prompt?: string } | null,
): Pose {
  switch (item?.type) {
    case "file_change":
      return "typing";
    case "command_execution":
      return "terminal";
    case "file_search":
    case "web_search":
      return "search";
    case "subagent": {
      const prompt = item.prompt ?? "";
      if (/\breview/i.test(prompt)) return "reviewing";
      if (/\bdesign|mockup|artboard/i.test(prompt)) return "painting";
      return "typing";
    }
    default:
      return "thinking";
  }
}
