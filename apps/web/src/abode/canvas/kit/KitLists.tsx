import { displayCustomizationPath } from "../../customizations/customizationsModel";
import { HOOK_EVENT_COLOR, type KitHook, type KitMcp, type KitPlugin } from "./kitModel";

const AGENT_NAME = { claude: "Claude Code", codex: "Codex" } as const;
const EVENT_WORD: Record<KitHook["event"], string> = {
  before: "before",
  after: "after",
  start: "start",
  stop: "stop",
  other: "on",
};

function Loading() {
  return <div data-cvk-empty="">Reading…</div>;
}

export function McpTab(props: { readonly rows: ReadonlyArray<KitMcp>; readonly cwd: string }) {
  return (
    <div data-cvk-wide="">
      <div data-cvk-card="">
        <h2>MCP servers give agents new tools. Each one costs context in every session.</h2>
        {props.rows.length === 0 ? (
          <div data-cvk-empty="">No MCP servers are set up for this workspace or for you.</div>
        ) : (
          <div data-cvk-list="">
            {props.rows.map((row) => (
              <div key={row.name} data-cvk-li="">
                <span data-cvk-kd="" style={{ background: "#4dd4c6" }} />
                <div data-cvk-nm="">
                  <b>{row.name}</b>
                  <small>{row.scopes.join(" · ")}</small>
                </div>
                <div data-cvk-ds="">
                  <span>
                    Declared in{" "}
                    {row.paths.map((path) => displayCustomizationPath(path, props.cwd)).join(", ")}
                  </span>
                </div>
                <div data-cvk-tk="" />
                <div data-cvk-ac="">{row.agents.map((agent) => AGENT_NAME[agent]).join(" · ")}</div>
              </div>
            ))}
          </div>
        )}
        <div data-cvk-hint="">
          Tool counts and an on/off switch aren't available yet; servers are listed from your config
          files.
        </div>
      </div>
    </div>
  );
}

export function PluginsTab(props: { readonly rows: ReadonlyArray<KitPlugin> | null }) {
  return (
    <div data-cvk-wide="">
      <div data-cvk-card="">
        <h2>Plugins bundle skills, MCP servers and hooks together.</h2>
        {props.rows === null ? <Loading /> : null}
        {props.rows?.length === 0 ? (
          <div data-cvk-empty="">No plugins are set up in ~/.claude/settings.json.</div>
        ) : null}
        <div data-cvk-list="">
          {props.rows?.map((plugin) => (
            <div
              key={`${plugin.name}@${plugin.marketplace}`}
              data-cvk-li=""
              data-off={plugin.enabled ? undefined : ""}
            >
              <span data-cvk-kd="" style={{ background: "#b18cff" }} />
              <div data-cvk-nm="">
                <b>{plugin.name}</b>
                <small>{plugin.marketplace}</small>
              </div>
              <div data-cvk-ds="" />
              <div data-cvk-tk="" />
              <div data-cvk-ac="">
                <span data-cvk-sw={plugin.enabled ? "on" : "off"}>
                  {plugin.enabled ? "on" : "off"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HooksTab(props: { readonly rows: ReadonlyArray<KitHook> | null }) {
  return (
    <div data-cvk-wide="">
      <div data-cvk-card="">
        <h2>Hooks run on their own, at a moment. Here they are as sentences.</h2>
        {props.rows === null ? <Loading /> : null}
        {props.rows?.length === 0 ? (
          <div data-cvk-empty="">No hooks are set up in ~/.claude/settings.json.</div>
        ) : null}
        <div data-cvk-hooks="">
          {props.rows?.map((hook, index) => (
            <div
              // oxlint-disable-next-line react/no-array-index-key -- hooks have no identity beyond their position in the file
              key={index}
              data-cvk-hk=""
              style={{ "--ec": HOOK_EVENT_COLOR[hook.event] } as React.CSSProperties}
            >
              <span data-cvk-ev="">{EVENT_WORD[hook.event]}</span>
              <div>
                <b>
                  {hook.event === "other"
                    ? hook.eventName
                    : `${hook.eventName}${hook.matcher ? ` · ${hook.matcher}` : ""}`}
                </b>
                {hook.event === "other" && hook.matcher ? ` · ${hook.matcher}` : ""} →{" "}
                <code>{hook.command}</code>
              </div>
              <span data-cvk-hint="">settings.json</span>
            </div>
          ))}
        </div>
        <div data-cvk-hint="">Read-only here: change hooks in ~/.claude/settings.json.</div>
      </div>
    </div>
  );
}
