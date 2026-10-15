import { describe, expect, it } from "vite-plus/test";

import { applyDevVocabulary } from "./devVocabulary";

describe("applyDevVocabulary", () => {
  it("fixes the developer words the speech model keeps mishearing", () => {
    expect(
      applyDevVocabulary("Create a work tree, then run Pixie install and read it from sq. light."),
    ).toBe("Create a worktree, then run pixi install and read it from SQLite.");
    expect(applyDevVocabulary("The web socket closes. Both work trees are clean.")).toBe(
      "The websocket closes. Both worktrees are clean.",
    );
  });

  it("writes React hooks and project names the way they are typed", () => {
    expect(applyDevVocabulary("Why does use effect run twice, and should I use memo here?")).toBe(
      "Why does useEffect run twice, and should I useMemo here?",
    );
    expect(applyDevVocabulary("Rebase on a Bode Next, then ask the FH SaaS app.")).toBe(
      "Rebase on abode next, then ask the fh-saas app.",
    );
    expect(applyDevVocabulary("Set T three code home.")).toBe("Set T3 code home.");
  });

  it("leaves ordinary sentences and longer words alone", () => {
    const text = "The pixies work on the tree; a worktree is not a work treehouse.";
    expect(applyDevVocabulary(text)).toBe(text);
  });
});
