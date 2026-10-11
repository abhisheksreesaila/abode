import { describe, expect, it } from "vite-plus/test";

import { archiveFailureTitle } from "./archiveFailure";

describe("archiveFailureTitle", () => {
  it("says the archive itself failed when nothing was archived", () => {
    expect(archiveFailureTitle(false)).toBe("Failed to archive thread");
  });

  it("says only the navigation failed once the thread was archived", () => {
    expect(archiveFailureTitle(true)).toBe("Thread archived, but navigation failed");
  });
});
