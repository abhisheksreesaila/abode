import { Switch } from "../../components/ui/switch";
import { SettingsRow, SettingsSection } from "../../components/settings/settingsLayout";
import { useCanvasStore } from "./canvasStore";
import { useSessionModeStore } from "./sessionModeStore";

/** The One Window switch (Settings › General). */
export function CanvasSettingsSection() {
  const enabled = useCanvasStore((state) => state.enabled);
  const setEnabled = useCanvasStore((state) => state.setEnabled);
  const serious = useSessionModeStore((state) => state.serious);
  const setSerious = useSessionModeStore((state) => state.setSerious);
  return (
    <SettingsSection id="one-window" title="One window">
      <SettingsRow
        title="One window"
        description="Replaces the Control room with one canvas: a rail of your workspaces, the selected workspace and an omnibox. Early preview. Off keeps abode as it was."
        control={
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(Boolean(checked))}
            aria-label="One window"
          />
        }
      />
      <SettingsRow
        title="Serious mode"
        description="Hides the one-liners from Ember and Pip on the canvas."
        control={
          <Switch
            checked={serious}
            onCheckedChange={(checked) => setSerious(Boolean(checked))}
            aria-label="Serious mode"
          />
        }
      />
    </SettingsSection>
  );
}
