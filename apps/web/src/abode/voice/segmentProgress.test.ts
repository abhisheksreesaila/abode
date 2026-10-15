import { describe, expect, it } from "vite-plus/test";

import { describeVoiceStatus } from "./ComposerVoiceControl";
import { idleState, reduceRecording, type RecordingState } from "./recordingMachine";

function transcribingState(): RecordingState {
  const recording = reduceRecording(idleState, { type: "start" }).state;
  return reduceRecording(recording, { type: "stop" }).state;
}

describe("segment progress", () => {
  it("reads 'Transcribing 2 of 8…' and ends the download label", () => {
    const downloading = reduceRecording(transcribingState(), {
      type: "progress",
      fraction: 1,
    }).state;
    expect(describeVoiceStatus(downloading)).toBe("Downloading speech model… 100%");
    const second = reduceRecording(downloading, { type: "segment", current: 2, total: 8 }).state;
    expect(second).toEqual({
      status: "transcribing",
      downloadProgress: null,
      segment: { current: 2, total: 8 },
    });
    expect(describeVoiceStatus(second)).toBe("Transcribing 2 of 8…");
  });

  it("keeps plain 'Transcribing…' for a recording that is one segment", () => {
    expect(describeVoiceStatus(transcribingState())).toBe("Transcribing…");
  });

  it("ignores a late segment after the dictation was cancelled", () => {
    expect(reduceRecording(idleState, { type: "segment", current: 2, total: 8 }).state).toEqual(
      idleState,
    );
  });
});
