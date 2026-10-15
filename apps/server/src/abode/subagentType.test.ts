import { describe, expect, it } from "@effect/vitest";

import { abodeAgentType } from "./subagentType.ts";

describe("abodeAgentType", () => {
  it("reads subagent_type", () => {
    expect(abodeAgentType({ subagent_type: "reviewer" })).toEqual({ agentType: "reviewer" });
  });
  it("leaves it out when missing, empty or not a string", () => {
    expect(abodeAgentType({})).toEqual({});
    expect(abodeAgentType({ subagent_type: "" })).toEqual({});
    expect(abodeAgentType({ subagent_type: 3 })).toEqual({});
  });
});
