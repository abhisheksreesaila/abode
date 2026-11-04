import * as Schema from "effect/Schema";
import * as Rpc from "effect/rpc/Rpc";

import { EnvironmentAuthorizationError } from "./auth.ts";

/**
 * The host's Tailscale peers, so "Add a machine" can say which machines already exist.
 * Names, OS, online state and tailnet IPs only; keys never cross the wire.
 */
export const TailnetMachine = Schema.Struct({
  name: Schema.String,
  os: Schema.String,
  online: Schema.Boolean,
});
export type TailnetMachine = typeof TailnetMachine.Type;

export const TailnetPeer = Schema.Struct({
  ...TailnetMachine.fields,
  ips: Schema.Array(Schema.String),
});
export type TailnetPeer = typeof TailnetPeer.Type;

/** `available: false` when Tailscale is missing or signed out; `self` is then empty. */
export const TailnetStatus = Schema.Struct({
  available: Schema.Boolean,
  self: TailnetMachine,
  peers: Schema.Array(TailnetPeer),
});
export type TailnetStatus = typeof TailnetStatus.Type;

export const WsTailnetStatusRpc = Rpc.make("tailnet.status", {
  success: TailnetStatus,
  error: EnvironmentAuthorizationError,
});
