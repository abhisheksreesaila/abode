// @effect-diagnostics nodeBuiltinImport:off - building tar fixtures needs the real filesystem.
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import {
  type Downloader,
  type ModelSpec,
  installModel,
  isModelInstalled,
  isUnsafeArchiveEntry,
} from "./modelInstall.ts";

let sandbox: string;

beforeEach(() => {
  sandbox = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "abode-voice-install-"));
});
afterEach(() => {
  NodeFS.rmSync(sandbox, { recursive: true, force: true });
});

const sha256 = (file: string) =>
  NodeCrypto.createHash("sha256").update(NodeFS.readFileSync(file)).digest("hex");

const tar = (cwd: string, args: ReadonlyArray<string>) =>
  NodeChildProcess.execFileSync("tar", [...args], { cwd, stdio: "pipe" });

/** A model archive holding `files` under a top-level directory called `id`. */
function makeModelArchive(id: string, files: Record<string, string>): string {
  const source = NodePath.join(sandbox, "source", id);
  NodeFS.mkdirSync(source, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    NodeFS.writeFileSync(NodePath.join(source, name), text);
  }
  const archive = NodePath.join(sandbox, `${id}.tar.bz2`);
  tar(NodePath.join(sandbox, "source"), ["-cjf", archive, id]);
  return archive;
}

const specFor = (id: string, archive: string, overrides: Partial<ModelSpec> = {}): ModelSpec => ({
  id,
  url: "https://example.test/model.tar.bz2",
  sha256: sha256(archive),
  archiveBytes: NodeFS.statSync(archive).size,
  requiredFiles: ["encoder.int8.onnx", "tokens.txt"],
  ...overrides,
});

/** "Downloads" by copying a local file, like a server that returned exactly these bytes. */
const copyFrom =
  (archive: string): Downloader =>
  async ({ destination, onBytes }) => {
    NodeFS.copyFileSync(archive, destination);
    onBytes(NodeFS.statSync(archive).size);
  };

const goodFiles = { "encoder.int8.onnx": "encoder-bytes", "tokens.txt": "a 0\nb 1\n" };

describe("installModel", () => {
  it("unpacks a verified archive into the models folder and reports full progress", async () => {
    const archive = makeModelArchive("model-a", goodFiles);
    const spec = specFor("model-a", archive);
    const modelsRoot = NodePath.join(sandbox, "models");
    const progress: number[] = [];

    await installModel({
      spec,
      modelsRoot,
      onProgress: (fraction) => progress.push(fraction),
      download: copyFrom(archive),
    });

    expect(NodeFS.readFileSync(NodePath.join(modelsRoot, "model-a", "tokens.txt"), "utf8")).toBe(
      "a 0\nb 1\n",
    );
    expect(await isModelInstalled(spec, modelsRoot)).toBe(true);
    expect(progress.at(-1)).toBe(1);
    expect(Math.max(...progress.slice(0, -1))).toBeLessThanOrEqual(0.95);
    // Nothing is left behind next to the model.
    expect(NodeFS.readdirSync(modelsRoot)).toEqual(["model-a"]);
  });

  it("clears scratch directories left by an interrupted download", async () => {
    const archive = makeModelArchive("model-g", goodFiles);
    const modelsRoot = NodePath.join(sandbox, "models");
    NodeFS.mkdirSync(NodePath.join(modelsRoot, ".install-old"), { recursive: true });
    NodeFS.writeFileSync(NodePath.join(modelsRoot, ".install-old", "model.tar.bz2"), "partial");

    await installModel({
      spec: specFor("model-g", archive),
      modelsRoot,
      onProgress: () => {},
      download: copyFrom(archive),
    });

    expect(NodeFS.readdirSync(modelsRoot)).toEqual(["model-g"]);
  });

  it("rejects an archive whose checksum differs and installs nothing", async () => {
    const archive = makeModelArchive("model-b", goodFiles);
    const spec = specFor("model-b", archive, { sha256: "0".repeat(64) });
    const modelsRoot = NodePath.join(sandbox, "models");

    await expect(
      installModel({ spec, modelsRoot, onProgress: () => {}, download: copyFrom(archive) }),
    ).rejects.toMatchObject({ failure: "checksum" });

    expect(NodeFS.readdirSync(modelsRoot)).toEqual([]);
  });

  it("rejects an archive with a path that climbs out of the folder, even with a valid checksum", async () => {
    const outside = NodePath.join(sandbox, "work");
    NodeFS.mkdirSync(NodePath.join(outside, "inner"), { recursive: true });
    NodeFS.writeFileSync(NodePath.join(outside, "evil.txt"), "owned");
    const archive = NodePath.join(sandbox, "evil.tar.bz2");
    tar(NodePath.join(outside, "inner"), ["-cjPf", archive, "../evil.txt"]);
    const spec = specFor("model-c", archive);
    const modelsRoot = NodePath.join(sandbox, "models");

    await expect(
      installModel({ spec, modelsRoot, onProgress: () => {}, download: copyFrom(archive) }),
    ).rejects.toMatchObject({ failure: "unsafe_archive" });

    expect(NodeFS.readdirSync(modelsRoot)).toEqual([]);
    expect(NodeFS.existsSync(NodePath.join(modelsRoot, "evil.txt"))).toBe(false);
  });

  it("rejects an archive that smuggles in a symlink", async () => {
    const source = NodePath.join(sandbox, "source", "model-d");
    NodeFS.mkdirSync(source, { recursive: true });
    NodeFS.writeFileSync(NodePath.join(source, "tokens.txt"), "a 0\n");
    NodeFS.symlinkSync("/etc/passwd", NodePath.join(source, "encoder.int8.onnx"));
    const archive = NodePath.join(sandbox, "link.tar.bz2");
    tar(NodePath.join(sandbox, "source"), ["-cjf", archive, "model-d"]);
    const spec = specFor("model-d", archive);
    const modelsRoot = NodePath.join(sandbox, "models");

    await expect(
      installModel({ spec, modelsRoot, onProgress: () => {}, download: copyFrom(archive) }),
    ).rejects.toMatchObject({ failure: "unsafe_archive" });
    expect(NodeFS.readdirSync(modelsRoot)).toEqual([]);
  });

  it("rejects an archive that is missing a required file", async () => {
    const archive = makeModelArchive("model-e", { "tokens.txt": "a 0\n" });
    const spec = specFor("model-e", archive);
    const modelsRoot = NodePath.join(sandbox, "models");

    await expect(
      installModel({ spec, modelsRoot, onProgress: () => {}, download: copyFrom(archive) }),
    ).rejects.toMatchObject({ failure: "incomplete" });
    expect(NodeFS.readdirSync(modelsRoot)).toEqual([]);
  });

  it("refuses a plain http url before downloading anything", async () => {
    const archive = makeModelArchive("model-f", goodFiles);
    const spec = specFor("model-f", archive, { url: "http://example.test/model.tar.bz2" });
    let downloads = 0;

    await expect(
      installModel({
        spec,
        modelsRoot: NodePath.join(sandbox, "models"),
        onProgress: () => {},
        download: async () => {
          downloads += 1;
        },
      }),
    ).rejects.toMatchObject({ failure: "insecure_url" });
    expect(downloads).toBe(0);
  });
});

describe("isUnsafeArchiveEntry", () => {
  it.each([
    ["model/encoder.onnx", false],
    ["model/", false],
    ["model/sub/dir/file.txt", false],
    ["../evil", true],
    ["model/../../evil", true],
    ["/etc/passwd", true],
    ["C:/Windows/x", true],
    ["model\\..\\evil", true],
    ["", true],
  ])("%s -> %s", (name, unsafe) => {
    expect(isUnsafeArchiveEntry(name)).toBe(unsafe);
  });
});
