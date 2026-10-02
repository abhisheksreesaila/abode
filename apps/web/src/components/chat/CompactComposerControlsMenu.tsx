import {
  ProviderInteractionMode,
  RuntimeMode,
  type ThreadAutonomousState,
} from "@t3tools/contracts";
import { createContext, memo, use, useCallback, useRef, type ReactNode } from "react";
import { EllipsisIcon } from "lucide-react";
import {
  Menu,
  MenuCheckboxItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator as MenuDivider,
  MenuTrigger,
} from "../ui/menu";
import { ComposerControl, ComposerControlIcon } from "./ComposerControl";
import { useComposerMenuProps } from "./composerEventScope";
import { resolveAutonomousChip } from "./autonomousChip.logic";
import { useComposerMenuState } from "./useComposerMenuState";

const RunAfterCloseContext = createContext<((run: () => void) => void) | null>(null);

/**
 * Runs `run` once the more menu has finished closing, so a popup opened by a
 * menu entry is not dismissed by the closing menu. Runs immediately outside
 * the menu.
 */
export function useRunAfterComposerMenuClose(): (run: () => void) => void {
  const register = use(RunAfterCloseContext);
  return register ?? ((run) => run());
}

export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  interactionMode: ProviderInteractionMode;
  runtimeMode: RuntimeMode;
  showInteractionModeToggle: boolean;
  /** The agent picker's list, when its chip moved into this menu. */
  agentMenuContent?: ReactNode;
  traitsMenuContent?: ReactNode;
  /** The workspace, environment and branch entries, when their chips moved into this menu. */
  contextMenuContent?: ReactNode;
  /** Which of `composer.host` and `composer.workspace` the context entries actually offer. */
  contextShortcuts?: string | undefined;
  /** The Access group; off while the runtime-mode chip is still inline. Defaults to on. */
  showRuntimeMode?: boolean;
  size?: "sm" | "xs";
  /**
   * The resting strip keeps this menu mounted out of flow while every block
   * fits inline. Its portaled popup would outlive that transition, so an
   * open menu closes when its trigger hides.
   */
  hidden?: boolean;
  onToggleInteractionMode: () => void;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
  autonomous?: ThreadAutonomousState | null | undefined;
  onAutonomousChange?: ((enabled: boolean) => void) | undefined;
}) {
  const composerFloatingLayerProps = useComposerMenuProps();
  const size = props.size ?? "sm";
  const [open, setOpen] = useComposerMenuState(props.hidden);
  const afterCloseRef = useRef<(() => void) | null>(null);
  const runAfterClose = useCallback((run: () => void) => {
    afterCloseRef.current = run;
  }, []);

  return (
    <RunAfterCloseContext value={runAfterClose}>
      <Menu
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(isOpen) => {
          if (isOpen) return;
          const run = afterCloseRef.current;
          afterCloseRef.current = null;
          run?.();
        }}
      >
        <MenuTrigger
          render={
            <ComposerControl
              size={size}
              className="shrink-0"
              aria-label="More composer controls"
              data-composer-more-trigger="true"
              data-composer-shortcut={[
                props.showRuntimeMode !== false || props.showInteractionModeToggle
                  ? "composer.mode"
                  : "",
                props.traitsMenuContent ? "composer.effort" : "",
                props.contextMenuContent ? (props.contextShortcuts ?? "") : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
          }
        >
          <ComposerControlIcon icon={EllipsisIcon} size={size} />
        </MenuTrigger>
        <MenuPopup align="start" {...composerFloatingLayerProps}>
          {props.agentMenuContent ? (
            <>
              {props.agentMenuContent}
              <MenuDivider />
            </>
          ) : null}
          {props.traitsMenuContent ? (
            <>
              {props.traitsMenuContent}
              <MenuDivider />
            </>
          ) : null}
          {props.showInteractionModeToggle ? (
            <>
              <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Mode</div>
              <MenuRadioGroup
                value={props.interactionMode}
                onValueChange={(value) => {
                  if (!value || value === props.interactionMode) return;
                  props.onToggleInteractionMode();
                }}
              >
                <MenuRadioItem value="default">Chat</MenuRadioItem>
                <MenuRadioItem value="plan">Plan</MenuRadioItem>
              </MenuRadioGroup>
              <MenuDivider />
            </>
          ) : null}
          {props.showRuntimeMode === false ? null : (
            <>
              <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Access</div>
              <MenuRadioGroup
                value={props.runtimeMode}
                onValueChange={(value) => {
                  if (!value || value === props.runtimeMode) return;
                  props.onRuntimeModeChange(value as RuntimeMode);
                }}
              >
                <MenuRadioItem value="approval-required">Supervised</MenuRadioItem>
                <MenuRadioItem value="auto-accept-edits">Auto-accept edits</MenuRadioItem>
                <MenuRadioItem value="auto">Auto</MenuRadioItem>
                <MenuRadioItem value="full-access">Full access</MenuRadioItem>
              </MenuRadioGroup>
            </>
          )}
          {props.onAutonomousChange ? (
            <>
              <MenuDivider />
              <MenuCheckboxItem
                checked={props.autonomous?.enabled === true}
                onCheckedChange={(checked) => props.onAutonomousChange?.(checked)}
              >
                {resolveAutonomousChip(props.autonomous, props.runtimeMode).label}
              </MenuCheckboxItem>
            </>
          ) : null}
          {props.contextMenuContent ? (
            <>
              {props.showRuntimeMode === false ? null : <MenuDivider />}
              {props.contextMenuContent}
            </>
          ) : null}
        </MenuPopup>
      </Menu>
    </RunAfterCloseContext>
  );
});
