import type { VoiceStatus } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { describeHostModel, describeVoiceEngine, pickVoiceEngine } from "./hostVoiceStatus";

const status = (patch: Partial<VoiceStatus>): VoiceStatus => ({
  engine: "nemotron",
  model: "ready",
  loaded: false,
  ...patch,
});

describe("pickVoiceEngine", () => {
  it("uses the host only when it reports a ready model", () => {
    expect(pickVoiceEngine(status({ model: "ready" }))).toBe("host");
  });

  it.each(["missing", "downloading", "failed", "unsupported"] as const)(
    "uses the browser while the host model is %s",
    (model) => {
      expect(pickVoiceEngine(status({ model }))).toBe("browser");
    },
  );

  it("uses the browser when the host has no voice or has not answered", () => {
    expect(pickVoiceEngine(null)).toBe("browser");
  });
});

describe("describeVoiceEngine", () => {
  it("names the engine and where it runs", () => {
    expect(describeVoiceEngine("host")).toBe("On this computer: Nemotron");
    expect(describeVoiceEngine("browser")).toBe("In the browser: Moonshine");
  });
});

describe("describeHostModel", () => {
  it("offers the download when the model is missing", () => {
    expect(describeHostModel(status({ model: "missing", sizeBytes: 475_271_763 }))).toEqual({
      description: "Not downloaded, 453 MB. It downloads the first time you dictate, or now.",
      action: "download",
    });
  });

  it("shows progress while downloading", () => {
    expect(describeHostModel(status({ model: "downloading", progress: 0.376 }))).toEqual({
      description: "Downloading… 38%",
      action: null,
    });
  });

  it("shows the reason and a retry when the model failed", () => {
    expect(
      describeHostModel(
        status({ model: "failed", message: "The downloaded speech model was damaged. Try again." }),
      ),
    ).toEqual({
      description: "The downloaded speech model was damaged. Try again.",
      action: "retry",
    });
  });

  it("says when it is ready, and whether it is in memory", () => {
    expect(describeHostModel(status({ model: "ready", sizeBytes: 650 * 1024 * 1024 }))).toEqual({
      description: "Ready, 650 MB. Loads when you dictate and unloads after a few idle minutes.",
      action: null,
    });
    expect(
      describeHostModel(status({ model: "ready", sizeBytes: 650 * 1024 * 1024, loaded: true }))
        .description,
    ).toBe("Ready, 650 MB. Loaded in memory.");
  });

  it("explains an unsupported host and an older server", () => {
    expect(
      describeHostModel(
        status({
          model: "unsupported",
          message: "Speech recognition is not available on freebsd-x64.",
        }),
      ),
    ).toEqual({ description: "Speech recognition is not available on freebsd-x64.", action: null });
    expect(describeHostModel(null).description).toBe(
      "This server has no host voice. Dictation runs in the browser.",
    );
  });
});
