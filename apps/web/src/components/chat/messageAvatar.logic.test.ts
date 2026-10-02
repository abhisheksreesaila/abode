import { describe, expect, it } from "vite-plus/test";
import { avatarInitials, formatAgentDetail, resolveAgentName } from "./messageAvatar.logic";

describe("avatar", () => {
  it("takes the first letter, uppercased", () => {
    expect(avatarInitials("claude")).toBe("C");
    expect(avatarInitials("Orchestrator")).toBe("O");
    expect(avatarInitials("You")).toBe("Y");
  });
  it("can take two words", () => {
    expect(avatarInitials("abhishek sreesaila", 2)).toBe("AS");
  });
  it("falls back for empty names", () => {
    expect(avatarInitials("  ")).toBe("?");
  });
  it("uses the active agent name, else Claude", () => {
    expect(resolveAgentName("orchestrator")).toBe("orchestrator");
    expect(resolveAgentName(null)).toBe("Claude");
    expect(resolveAgentName("  ")).toBe("Claude");
  });
  it("joins model and access mode", () => {
    expect(formatAgentDetail("Opus 5.5", "full access")).toBe("Opus 5.5 · full access");
    expect(formatAgentDetail(null, "full access")).toBe("full access");
    expect(formatAgentDetail(undefined, null)).toBeNull();
  });
});
