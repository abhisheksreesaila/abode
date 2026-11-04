import type { TailnetStatus } from "@t3tools/contracts";

export interface TailnetRow {
  readonly name: string;
  readonly os: string;
  readonly online: boolean;
  readonly inAbode: boolean;
  readonly isMac: boolean;
}

export type MacState =
  | { readonly kind: "unknown" }
  | { readonly kind: "none" }
  | { readonly kind: "found"; readonly name: string }
  | { readonly kind: "connected"; readonly name: string };

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/gu, "");

/** Loose on purpose: "Abheshek's MacBook Pro" in abode should match the tailnet name "macbook-pro". */
const sameMachine = (tailnetName: string, label: string) => {
  const a = squash(tailnetName);
  const b = squash(label);
  return a !== "" && b !== "" && (a.includes(b) || b.includes(a));
};

export function tailnetRows(
  status: TailnetStatus,
  environmentLabels: ReadonlyArray<string>,
): ReadonlyArray<TailnetRow> {
  const toRow = (
    machine: { name: string; os: string; online: boolean },
    isSelf: boolean,
  ): TailnetRow => ({
    name: machine.name,
    os: machine.os,
    online: machine.online,
    inAbode: isSelf || environmentLabels.some((label) => sameMachine(machine.name, label)),
    isMac: /^(macos|darwin)$/iu.test(machine.os),
  });
  return [toRow(status.self, true), ...status.peers.map((peer) => toRow(peer, false))];
}

export function macState(status: TailnetStatus, rows: ReadonlyArray<TailnetRow>): MacState {
  if (!status.available) return { kind: "unknown" };
  const macs = rows.filter((row) => row.isMac);
  const missing = macs.find((mac) => !mac.inAbode);
  if (missing) return { kind: "found", name: missing.name };
  const connected = macs[0];
  return connected ? { kind: "connected", name: connected.name } : { kind: "none" };
}
