import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Claude Code customizations (skills, agents, MCP servers, instruction files)
 * that a workspace can see. Listing exposes names and file paths only; MCP
 * server values (env, headers, args, urls) never cross the wire.
 */
export const CustomizationKind = Schema.Literals(["skill", "agent", "mcp", "instructions"]);
export type CustomizationKind = typeof CustomizationKind.Type;

export const CustomizationScope = Schema.Literals(["user", "workspace"]);
export type CustomizationScope = typeof CustomizationScope.Type;

export const CustomizationItem = Schema.Struct({
  kind: CustomizationKind,
  name: TrimmedNonEmptyString,
  description: Schema.optional(Schema.String),
  /** Absolute host path of the file to open. */
  path: TrimmedNonEmptyString,
  scope: CustomizationScope,
  /** True when the file can be read but never written back (`~/.claude.json`). */
  readOnly: Schema.Boolean,
});
export type CustomizationItem = typeof CustomizationItem.Type;

export const CustomizationsListInput = Schema.Struct({
  /** A registered project's workspace root. */
  cwd: TrimmedNonEmptyString,
});
export type CustomizationsListInput = typeof CustomizationsListInput.Type;

export const CustomizationsListResult = Schema.Struct({
  items: Schema.Array(CustomizationItem),
});
export type CustomizationsListResult = typeof CustomizationsListResult.Type;

export const CustomizationsReadFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  path: TrimmedNonEmptyString,
});
export type CustomizationsReadFileInput = typeof CustomizationsReadFileInput.Type;

export const CustomizationsReadFileResult = Schema.Struct({
  path: TrimmedNonEmptyString,
  contents: Schema.String,
  readOnly: Schema.Boolean,
});
export type CustomizationsReadFileResult = typeof CustomizationsReadFileResult.Type;

export const CustomizationsWriteFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  path: TrimmedNonEmptyString,
  contents: Schema.String,
});
export type CustomizationsWriteFileInput = typeof CustomizationsWriteFileInput.Type;

export const CustomizationsWriteFileResult = Schema.Struct({
  path: TrimmedNonEmptyString,
  byteLength: Schema.Number,
});
export type CustomizationsWriteFileResult = typeof CustomizationsWriteFileResult.Type;

export const CustomizationsFailure = Schema.Literals([
  "cwd_not_registered",
  "path_not_allowed",
  "read_only",
  "file_too_large",
  "operation_failed",
]);
export type CustomizationsFailure = typeof CustomizationsFailure.Type;

export class CustomizationsError extends Schema.TaggedError<CustomizationsError>()(
  "CustomizationsError",
  {
    failure: CustomizationsFailure,
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {}
