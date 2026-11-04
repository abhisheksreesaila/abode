/** Reads the host's Tailscale peers for "Add a machine". Only names, OS, state and IPs are kept. */
import type { TailnetPeer, TailnetStatus } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const UNAVAILABLE: TailnetStatus = {
  available: false,
  self: { name: "", os: "", online: false },
  peers: [],
};

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const toNode = (raw: unknown) => {
  const node = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const dnsLabel = text(node.DNSName).split(".")[0] ?? "";
  return {
    name: dnsLabel || text(node.HostName),
    os: text(node.OS),
    online: node.Online === true,
    ips: Array.isArray(node.TailscaleIPs)
      ? node.TailscaleIPs.filter((ip): ip is string => typeof ip === "string")
      : [],
  };
};

/** `tailscale status --json` -> peers. Signed out, stopped or unreadable output is `available: false`. */
export const parseTailnetStatus = (rawJson: string): TailnetStatus => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return UNAVAILABLE;
  }
  if (typeof parsed !== "object" || parsed === null) return UNAVAILABLE;
  const status = parsed as Record<string, unknown>;
  if (status.BackendState !== "Running" || typeof status.Self !== "object") return UNAVAILABLE;
  const { ips: _selfIps, ...self } = toNode(status.Self);
  const peerRecord =
    typeof status.Peer === "object" && status.Peer !== null
      ? (status.Peer as Record<string, unknown>)
      : {};
  const peers: TailnetPeer[] = Object.values(peerRecord)
    .map(toNode)
    .filter((peer) => peer.name !== "");
  return { available: true, self, peers };
};

export const status = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const command = ChildProcess.make("tailscale", ["status", "--json"]);
  return yield* Effect.gen(function* () {
    const child = yield* spawner.spawn(command);
    const stdout = yield* child.stdout.pipe(
      Stream.decodeText(),
      Stream.runFold(
        () => "",
        (acc, chunk) => acc + chunk,
      ),
    );
    yield* child.exitCode;
    return parseTailnetStatus(stdout);
  }).pipe(Effect.scoped, Effect.timeout("5 seconds"));
}).pipe(Effect.catchCause(() => Effect.succeed(UNAVAILABLE)));
