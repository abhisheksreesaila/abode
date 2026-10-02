import { describe, expect, it } from "vite-plus/test";

import { previewLabel, previewTail } from "./previewText";

describe("previewTail", () => {
  it("leaves short text alone", () => {
    expect(previewTail("add a route")).toBe("add a route");
  });

  it("keeps the newest words with a leading ellipsis", () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const out = previewTail(text, 40);
    expect(out.startsWith("…")).toBe(true);
    expect(out.endsWith("word59")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
  });
});

describe("previewLabel", () => {
  it("shows download progress until words arrive", () => {
    expect(previewLabel({ downloadProgress: 0.43 })).toBe("Downloading voice model 43%…");
    expect(previewLabel({ interim: "hello", downloadProgress: 0.9 })).toBe("hello");
    expect(previewLabel({})).toBeNull();
  });
});
