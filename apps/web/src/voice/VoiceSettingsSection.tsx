import { useCallback, useEffect, useState, type KeyboardEvent } from "react";

import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { SettingsRow, SettingsSection } from "../components/settings/settingsLayout";
import { DEFAULT_VOICE_SHORTCUT, voiceShortcutLabel } from "./shortcut";
import { captureVoiceShortcut, findVoiceShortcutConflict } from "./shortcutCapture";
import { resetTranscriber } from "./transcriberClient";
import { deleteVoiceModelFiles, formatModelSize, readVoiceModelBytes } from "./voiceModel";
import { useVoiceSettings } from "./voiceSettings";

function ShortcutRecorder() {
  const { settings, update } = useVoiceSettings();
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording || event.key === "Tab") return;
    event.preventDefault();
    event.stopPropagation();
    const capture = captureVoiceShortcut(event, navigator.platform);
    if (capture.kind === "ignore") return;
    setRecording(false);
    if (capture.kind === "cancel") return;
    update({ shortcut: capture.value });
    setConflict(findVoiceShortcutConflict(capture.value, navigator.platform));
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {settings.shortcut !== DEFAULT_VOICE_SHORTCUT ? (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              update({ shortcut: DEFAULT_VOICE_SHORTCUT });
              setConflict(null);
            }}
          >
            Reset
          </Button>
        ) : null}
        <Button
          type="button"
          size="xs"
          variant={recording ? "secondary" : "outline"}
          disabled={!settings.enabled}
          aria-pressed={recording}
          aria-label={`Hold-to-talk key, currently ${voiceShortcutLabel(settings.shortcut)}`}
          data-keybinding-capture=""
          onClick={() => setRecording(true)}
          onKeyDown={onKeyDown}
          onBlur={() => setRecording(false)}
        >
          {recording ? "Press shortcut…" : voiceShortcutLabel(settings.shortcut)}
        </Button>
      </div>
      {recording ? (
        <p role="status" className="text-xs text-muted-foreground">
          Hold a modifier and press a key. Esc cancels.
        </p>
      ) : null}
      {conflict ? (
        <p role="status" className="text-xs text-muted-foreground">
          Also used by {conflict}. Voice takes priority while it is on.
        </p>
      ) : null}
    </div>
  );
}

function ModelRow() {
  const [bytes, setBytes] = useState<number | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(() => {
    void readVoiceModelBytes().then(setBytes, () => setBytes(null));
  }, []);
  useEffect(refresh, [refresh]);

  const remove = () => {
    setDeleting(true);
    // The worker keeps the model in memory; drop it so the next use downloads again.
    resetTranscriber();
    void deleteVoiceModelFiles()
      .catch(() => undefined)
      .finally(() => {
        setDeleting(false);
        refresh();
      });
  };

  return (
    <SettingsRow
      title="Speech model"
      description={
        bytes === undefined
          ? "Checking…"
          : bytes === null
            ? "Not downloaded. It downloads the first time you dictate."
            : `Downloaded, ${formatModelSize(bytes)}. Works offline.`
      }
      control={
        <Button
          size="xs"
          variant="outline"
          disabled={bytes === undefined || bytes === null || deleting}
          onClick={remove}
        >
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      }
    />
  );
}

/** Voice dictation preferences: on/off, hold-to-talk key and the downloaded model. */
export function VoiceSettingsSection() {
  const { settings, update } = useVoiceSettings();
  return (
    <SettingsSection id="voice" title="Voice">
      <SettingsRow
        title="Voice dictation"
        description="Hold the key or tap the mic in the composer and speak. Transcribed on this device; nothing is sent until you press Enter."
        control={
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => update({ enabled: Boolean(checked) })}
            aria-label="Voice dictation"
          />
        }
      />
      <SettingsRow
        title="Hold-to-talk key"
        description="Hold to record, release to transcribe. Esc cancels."
        control={<ShortcutRecorder />}
      />
      <ModelRow />
    </SettingsSection>
  );
}
