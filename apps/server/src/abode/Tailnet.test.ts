import { describe, expect, it } from "@effect/vitest";

import { parseTailnetStatus } from "./Tailnet.ts";

const running = JSON.stringify({
  BackendState: "Running",
  AuthURL: "https://login.tailscale.com/a/secret",
  Self: {
    HostName: "linux-box",
    DNSName: "abode-host.tail1234.ts.net.",
    OS: "linux",
    Online: true,
    TailscaleIPs: ["100.64.0.1", "fd7a::1"],
    PublicKey: "nodekey:aaaa",
  },
  Peer: {
    "nodekey:bbbb": {
      HostName: "Abhisheks-iPhone",
      DNSName: "iphone.tail1234.ts.net.",
      OS: "iOS",
      Online: false,
      TailscaleIPs: ["100.64.0.2"],
    },
    "nodekey:cccc": {
      HostName: "MacBook-Pro",
      DNSName: "macbook.tail1234.ts.net.",
      OS: "macOS",
      Online: true,
      TailscaleIPs: ["100.64.0.3", "fd7a::3"],
    },
  },
});

describe("parseTailnetStatus", () => {
  it("lists self and peers by tailnet name, with no keys", () => {
    const result = parseTailnetStatus(running);
    expect(result).toEqual({
      available: true,
      self: { name: "abode-host", os: "linux", online: true },
      peers: [
        { name: "iphone", os: "iOS", online: false, ips: ["100.64.0.2"] },
        { name: "macbook", os: "macOS", online: true, ips: ["100.64.0.3", "fd7a::3"] },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("nodekey");
  });

  it("is unavailable when signed out", () => {
    const signedOut = JSON.stringify({ BackendState: "NeedsLogin", AuthURL: "https://x" });
    expect(parseTailnetStatus(signedOut)).toEqual({
      available: false,
      self: { name: "", os: "", online: false },
      peers: [],
    });
  });

  it("is unavailable when the output is not JSON", () => {
    expect(parseTailnetStatus("tailscale: command not found").available).toBe(false);
  });

  it("handles a tailnet with no peers", () => {
    const alone = JSON.stringify({
      BackendState: "Running",
      Self: { HostName: "solo", OS: "linux" },
    });
    expect(parseTailnetStatus(alone)).toEqual({
      available: true,
      self: { name: "solo", os: "linux", online: false },
      peers: [],
    });
  });
});
