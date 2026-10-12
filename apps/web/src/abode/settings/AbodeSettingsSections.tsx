import { ChatSettingsSection } from "../chat/ChatSettingsSection";
import { VoiceSettingsSection } from "../voice/VoiceSettingsSection";

/** Every abode section in Settings › General, rendered from one upstream hook. */
export function AbodeSettingsSections() {
  return (
    <>
      <ChatSettingsSection />
      <VoiceSettingsSection />
    </>
  );
}
