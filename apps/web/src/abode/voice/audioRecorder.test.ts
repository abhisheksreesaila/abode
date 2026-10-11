import { describe, expect, it } from "vite-plus/test";

import {
  describeMicrophoneError,
  INSECURE_CONTEXT_MESSAGE,
  InsecureContextError,
} from "./audioRecorder";

describe("describeMicrophoneError", () => {
  it("explains a blocked microphone in one line", () => {
    expect(describeMicrophoneError(new DOMException("denied", "NotAllowedError"))).toBe(
      "Microphone blocked. Allow it in system settings.",
    );
  });

  it("tells the user voice needs HTTPS on an insecure origin", () => {
    expect(describeMicrophoneError(new InsecureContextError())).toBe(INSECURE_CONTEXT_MESSAGE);
    expect(INSECURE_CONTEXT_MESSAGE).toBe("Voice needs HTTPS (use Tailscale HTTPS or localhost).");
  });

  it("falls back to a generic message", () => {
    expect(describeMicrophoneError(new Error("boom"))).toBe("Couldn't start the microphone.");
  });
});
