// @effect-diagnostics nodeBuiltinImport:off - resolves the person's agent folders from the host environment.
/**
 * Where each agent keeps its files, honoring the same overrides everywhere (the customizations
 * list, skill cut/restore, the installer): `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `AGENTS_HOME`.
 */
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { expandHomePath } from "@t3tools/provider-core/server/pathExpansion";

type Env = Readonly<Record<string, string | undefined>>;

const fromEnv = (value: string | undefined, fallback: string, home: string) => {
  const configured = value?.trim() ?? "";
  return configured.length > 0
    ? NodePath.resolve(expandHomePath(configured, home))
    : NodePath.join(home, fallback);
};

/** Claude Code: `CLAUDE_CONFIG_DIR` (used literally, like the Claude driver does), else `~/.claude`. */
export const claudeConfigDir = (env: Env = process.env, home = NodeOS.homedir()): string => {
  const inherited = env.CLAUDE_CONFIG_DIR?.trim() ?? "";
  return NodePath.resolve(inherited.length > 0 ? inherited : NodePath.join(home, ".claude"));
};

/** Codex reads `CODEX_HOME` when set, `~/.codex` otherwise. */
export const codexHomeDir = (env: Env = process.env, home = NodeOS.homedir()): string =>
  fromEnv(env.CODEX_HOME, ".codex", home);

/** The shared skills home (`~/.agents`); `AGENTS_HOME` moves it. */
export const agentsHomeDir = (env: Env = process.env, home = NodeOS.homedir()): string =>
  fromEnv(env.AGENTS_HOME, ".agents", home);

/** The three skill folders, Claude's first: the trash lives under the first. */
export const skillRootDirs = (env: Env = process.env, home = NodeOS.homedir()): string[] => [
  NodePath.join(claudeConfigDir(env, home), "skills"),
  NodePath.join(agentsHomeDir(env, home), "skills"),
  NodePath.join(codexHomeDir(env, home), "skills"),
];
