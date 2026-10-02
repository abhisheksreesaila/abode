import { describe, expect, it, vi } from "vite-plus/test";

import { routeWorkerMessage, type PendingRequest } from "./transcriberClient";

function request(): PendingRequest {
  return { resolve: vi.fn(), reject: vi.fn(), onProgress: vi.fn() };
}

describe("routeWorkerMessage", () => {
  it("broadcasts download progress to every waiting request", () => {
    const interim = request();
    const final = request();
    const pending = new Map([
      [1, interim],
      [2, final],
    ]);
    routeWorkerMessage(pending, { type: "progress", id: 1, fraction: 0.43 });
    expect(interim.onProgress).toHaveBeenCalledWith(0.43);
    expect(final.onProgress).toHaveBeenCalledWith(0.43);
  });

  it("settles only the request a result belongs to", () => {
    const a = request();
    const b = request();
    const pending = new Map([
      [1, a],
      [2, b],
    ]);
    routeWorkerMessage(pending, { type: "result", id: 2, text: "hi" });
    expect(b.resolve).toHaveBeenCalledWith("hi");
    expect(a.resolve).not.toHaveBeenCalled();
    expect([...pending.keys()]).toEqual([1]);
  });
});
