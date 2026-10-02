import { describe, expect, it } from "vite-plus/test";

import {
  EMPTY_TRANSCRIPT_MESSAGE,
  idleState,
  reduceRecording,
  type RecordingState,
} from "./recordingMachine";

function transcribingState(): RecordingState {
  const recording = reduceRecording(idleState, { type: "start" }).state;
  return reduceRecording(recording, { type: "stop" }).state;
}

describe("reduceRecording", () => {
  it("walks idle -> recording -> transcribing -> idle and reports the text to insert", () => {
    const recording = reduceRecording(idleState, { type: "start" });
    expect(recording.state).toEqual({ status: "recording" });

    const transcribing = reduceRecording(recording.state, { type: "stop" });
    expect(transcribing.state).toEqual({ status: "transcribing", downloadProgress: null });

    const done = reduceRecording(transcribing.state, { type: "transcribed", text: "  hello  " });
    expect(done.state).toEqual(idleState);
    expect(done.insert).toBe("hello");
  });

  it("cancel while recording discards the audio", () => {
    const recording = reduceRecording(idleState, { type: "start" }).state;
    const cancelled = reduceRecording(recording, { type: "cancel" });
    expect(cancelled.state).toEqual(idleState);
    expect(cancelled.discardAudio).toBe(true);
  });

  it("cancel while transcribing drops a late transcript", () => {
    const cancelled = reduceRecording(transcribingState(), { type: "cancel" });
    expect(cancelled.state).toEqual(idleState);
    const late = reduceRecording(cancelled.state, { type: "transcribed", text: "late" });
    expect(late.insert).toBeUndefined();
    expect(late.state).toEqual(idleState);
  });

  it("an empty transcript becomes a one-line error and inserts nothing", () => {
    const result = reduceRecording(transcribingState(), { type: "transcribed", text: "   " });
    expect(result.state).toEqual({ status: "error", message: EMPTY_TRANSCRIPT_MESSAGE });
    expect(result.insert).toBeUndefined();
  });

  it("failures surface a message, and the next start or a dismiss recovers", () => {
    const failed = reduceRecording(idleState, { type: "failed", message: "Microphone blocked." });
    expect(failed.state).toEqual({ status: "error", message: "Microphone blocked." });
    expect(reduceRecording(failed.state, { type: "start" }).state).toEqual({
      status: "recording",
    });
    expect(reduceRecording(failed.state, { type: "dismiss" }).state).toEqual(idleState);
  });

  it("records model download progress only while transcribing", () => {
    expect(reduceRecording(transcribingState(), { type: "progress", fraction: 0.4 }).state).toEqual(
      { status: "transcribing", downloadProgress: 0.4 },
    );
    expect(reduceRecording(idleState, { type: "progress", fraction: 0.4 }).state).toEqual(
      idleState,
    );
  });

  it("ignores start while busy and stop when not recording", () => {
    const recording = reduceRecording(idleState, { type: "start" }).state;
    expect(reduceRecording(recording, { type: "start" }).state).toBe(recording);
    expect(reduceRecording(idleState, { type: "stop" }).state).toBe(idleState);
  });
});

describe("live preview", () => {
  function hearing(text: string): RecordingState {
    const recording = reduceRecording(idleState, { type: "start" }).state;
    return reduceRecording(recording, { type: "interim", text }).state;
  }

  it("shows interim text only while recording and replaces it on each update", () => {
    const next = reduceRecording(hearing("add a"), { type: "interim", text: "add a route" });
    expect(next.state).toEqual({ status: "recording", interim: "add a route" });
    expect(next.insert).toBeUndefined();
    expect(reduceRecording(idleState, { type: "interim", text: "x" }).state).toEqual(idleState);
  });

  it("drops the preview on release; only the final transcript is inserted", () => {
    const transcribing = reduceRecording(hearing("add a roo"), { type: "stop" });
    expect(transcribing.state).toEqual({ status: "transcribing", downloadProgress: null });
    const done = reduceRecording(transcribing.state, { type: "transcribed", text: "Add a route" });
    expect(done.insert).toBe("Add a route");
    expect(done.state).toEqual(idleState);
  });

  it("cancel clears the preview and discards the audio", () => {
    const cancelled = reduceRecording(hearing("add a roo"), { type: "cancel" });
    expect(cancelled.state).toEqual(idleState);
    expect(cancelled.discardAudio).toBe(true);
  });

  it("a late interim after release is ignored", () => {
    expect(reduceRecording(transcribingState(), { type: "interim", text: "late" }).state).toEqual({
      status: "transcribing",
      downloadProgress: null,
    });
  });
});
