import type { TailnetStatus } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { macState, tailnetRows } from "./tailnetModel";

const status = (peers: TailnetStatus["peers"], available = true): TailnetStatus => ({
  available,
  self: { name: "abode-host", os: "linux", online: true },
  peers,
});
const iphone = { name: "iphone", os: "iOS", online: true, ips: [] };
const mac = { name: "macbook-pro", os: "macOS", online: true, ips: [] };

describe("macState", () => {
  it("says none when the tailnet has no Mac", () => {
    const s = status([iphone]);
    expect(macState(s, tailnetRows(s, []))).toEqual({ kind: "none" });
  });

  it("finds a Mac that abode does not know", () => {
    const s = status([iphone, mac]);
    expect(macState(s, tailnetRows(s, ["abode-host"]))).toEqual({
      kind: "found",
      name: "macbook-pro",
    });
  });

  it("matches an environment label loosely and reports connected", () => {
    const s = status([mac]);
    const rows = tailnetRows(s, ["MacBook Pro"]);
    expect(rows.map((row) => [row.name, row.inAbode])).toEqual([
      ["abode-host", true],
      ["macbook-pro", true],
    ]);
    expect(macState(s, rows)).toEqual({ kind: "connected", name: "macbook-pro" });
  });

  it("does not guess when tailscale is unavailable", () => {
    const s = status([], false);
    expect(macState(s, tailnetRows(s, []))).toEqual({ kind: "unknown" });
  });
});
