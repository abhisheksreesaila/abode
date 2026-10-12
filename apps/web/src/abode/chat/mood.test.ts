import { describe, expect, it } from "vite-plus/test";

import { activityPose, helperMood } from "./mood";

const base = {
  status: null,
  openQuestions: 0,
  latestWarnings: 0,
  hasAnswer: true,
  agreedChoice: null,
} as const;

describe("helperMood", () => {
  it("asks when upstream waits on an approval or the board has an open question", () => {
    expect(helperMood({ ...base, status: "approval" }).mark).toBe("asking");
    expect(helperMood({ ...base, openQuestions: 2 })).toMatchObject({
      mark: "asking",
      headline: "has 2 questions for you",
    });
  });

  it("works while running, and an answer you just gave shows a thumbs up", () => {
    expect(helperMood({ ...base, status: "working" })).toMatchObject({ mark: null, working: true });
    expect(helperMood({ ...base, status: "working", agreedChoice: "Go now" })).toMatchObject({
      mark: "agreed",
      working: true,
    });
  });

  it("is worried after a failure or when the last answer carried warnings", () => {
    expect(helperMood({ ...base, status: "failed" }).mark).toBe("worried");
    expect(helperMood({ ...base, latestWarnings: 1 })).toMatchObject({
      mark: "worried",
      headline: "is done, with 1 warning",
    });
  });

  it("is done after an answer and idle before the first one", () => {
    expect(helperMood(base).mark).toBe("done");
    expect(helperMood({ ...base, hasAnswer: false }).mark).toBe("idle");
  });
});

describe("activityPose", () => {
  it("follows the latest work item", () => {
    expect(activityPose({ type: "file_change" })).toBe("typing");
    expect(activityPose({ type: "command_execution" })).toBe("terminal");
    expect(activityPose({ type: "web_search" })).toBe("search");
    expect(activityPose({ type: "reasoning" })).toBe("thinking");
    expect(activityPose(null)).toBe("thinking");
  });

  it("guesses a subagent's job from its prompt", () => {
    expect(activityPose({ type: "subagent", prompt: "Review commit abc" })).toBe("reviewing");
    expect(activityPose({ type: "subagent", prompt: "Design the board header" })).toBe("painting");
    expect(activityPose({ type: "subagent", prompt: "Build ticket A-010" })).toBe("typing");
  });
});
