// @effect-diagnostics nodeBuiltinImport:off - streaming a 450 MB download and calling tar are not in the Effect FileSystem.
/**
 * Downloads and installs the speech model. Plain async functions (no framework in them) so the
 * checksum and archive rules are testable with local fixtures; `Voice` wraps them in a service.
 *
 * The archive is untrusted until proven otherwise: HTTPS only (every redirect hop too), a pinned
 * SHA-256, a bounded size, entry names checked before anything is extracted, extraction into a
 * scratch directory next to the final one, and a walk of what came out (regular files only)
 * before one atomic rename puts it in place.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface ModelSpec {
  /** Directory name inside the archive and inside the models folder. */
  readonly id: string;
  readonly url: string;
  readonly sha256: string;
  /** Size of the archive; the download is refused beyond this plus a small margin. */
  readonly archiveBytes: number;
  /** Files the recognizer needs, relative to the model directory. */
  readonly requiredFiles: ReadonlyArray<string>;
}

/**
 * NVIDIA Nemotron 3.5 ASR streaming (0.6b, 560 ms chunks, int8) as built by k2-fsa for
 * sherpa-onnx. Weights are OpenMDW-1.1; the checksum was computed from the spike's download.
 */
export const NEMOTRON_560_INT8: ModelSpec = {
  id: "sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11",
  url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11.tar.bz2",
  sha256: "c6bf5e0df765f9d5b43bc9e0536d4b4b3e7d40bdf5ecf13e45f134c51c05ae3a",
  archiveBytes: 475_271_763,
  requiredFiles: ["encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"],
};

export type ModelInstallFailure =
  | "insecure_url"
  | "download"
  | "too_large"
  | "checksum"
  | "unsafe_archive"
  | "extract"
  | "incomplete";

export class ModelInstallFailed extends Error {
  readonly failure: ModelInstallFailure;
  constructor(failure: ModelInstallFailure, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ModelInstallFailed";
    this.failure = failure;
  }
}

/** Writes `url` to `destination`, reporting bytes received so far. */
export type Downloader = (input: {
  readonly url: string;
  readonly destination: string;
  readonly maxBytes: number;
  readonly onBytes: (received: number) => void;
}) => Promise<void>;

const MAX_REDIRECTS = 5;
const SIZE_MARGIN = 1.02;

/** HTTPS only, on every redirect hop; the body is cut off if it outgrows `maxBytes`. */
export const downloadOverHttps: Downloader = async ({ url, destination, maxBytes, onBytes }) => {
  let target = new URL(url);
  let response: Response | undefined;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (target.protocol !== "https:") {
      throw new ModelInstallFailed("insecure_url", "The model must be downloaded over HTTPS.");
    }
    const current = await fetch(target, { redirect: "manual" }).catch((cause: unknown) => {
      throw new ModelInstallFailed("download", "Couldn't reach the download server.", { cause });
    });
    const location = current.headers.get("location");
    if (current.status >= 300 && current.status < 400 && location) {
      target = new URL(location, target);
      continue;
    }
    response = current;
    break;
  }
  if (!response?.ok || !response.body) {
    throw new ModelInstallFailed("download", "The download server refused the request.");
  }
  let received = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > maxBytes) {
        callback(new ModelInstallFailed("too_large", "The download is larger than expected."));
        return;
      }
      onBytes(received);
      callback(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    counter,
    NodeFS.createWriteStream(destination),
  ).catch((cause: unknown) => {
    if (cause instanceof ModelInstallFailed) throw cause;
    throw new ModelInstallFailed("download", "The download was interrupted.", { cause });
  });
};

async function sha256Of(file: string): Promise<string> {
  const hash = NodeCrypto.createHash("sha256");
  await pipeline(NodeFS.createReadStream(file), hash);
  return hash.digest("hex");
}

function runTar(args: ReadonlyArray<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    NodeChildProcess.execFile(
      "tar",
      [...args],
      { maxBuffer: 16 * 1024 * 1024, encoding: "utf8" },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      },
    );
  });
}

/** An entry name that could land outside the extraction directory. */
export function isUnsafeArchiveEntry(name: string): boolean {
  if (name.length === 0 || name.includes("\0") || name.includes("\\")) return true;
  if (name.startsWith("/") || /^[A-Za-z]:/.test(name)) return true;
  return name.split("/").some((part) => part === "..");
}

async function collectEntries(directory: string, found: string[] = []): Promise<string[]> {
  for (const entry of await NodeFS.promises.readdir(directory, { withFileTypes: true })) {
    const full = NodePath.join(directory, entry.name);
    if (entry.isDirectory()) await collectEntries(full, found);
    else if (entry.isFile()) found.push(full);
    else throw new ModelInstallFailed("unsafe_archive", "The archive holds a link or device file.");
  }
  return found;
}

export async function isModelInstalled(spec: ModelSpec, modelsRoot: string): Promise<boolean> {
  try {
    for (const file of spec.requiredFiles) {
      const stat = await NodeFS.promises.stat(NodePath.join(modelsRoot, spec.id, file));
      if (!stat.isFile() || stat.size === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Bytes the installed model occupies on disk. */
export async function installedModelBytes(spec: ModelSpec, modelsRoot: string): Promise<number> {
  const files = await collectEntries(NodePath.join(modelsRoot, spec.id));
  let total = 0;
  for (const file of files) total += (await NodeFS.promises.stat(file)).size;
  return total;
}

export async function installModel(input: {
  readonly spec: ModelSpec;
  readonly modelsRoot: string;
  readonly onProgress: (fraction: number) => void;
  readonly download?: Downloader;
}): Promise<void> {
  const { spec, modelsRoot, onProgress } = input;
  const download = input.download ?? downloadOverHttps;
  if (!spec.url.startsWith("https://")) {
    throw new ModelInstallFailed("insecure_url", "The model must be downloaded over HTTPS.");
  }
  await NodeFS.promises.mkdir(modelsRoot, { recursive: true });
  const work = await NodeFS.promises.mkdtemp(NodePath.join(modelsRoot, ".install-"));
  try {
    const archive = NodePath.join(work, "model.tar.bz2");
    await download({
      url: spec.url,
      destination: archive,
      maxBytes: Math.ceil(spec.archiveBytes * SIZE_MARGIN),
      // Leave the last slice of the bar for checking and unpacking.
      onBytes: (received) => onProgress(Math.min(0.95, (received / spec.archiveBytes) * 0.95)),
    });

    if ((await sha256Of(archive)) !== spec.sha256) {
      throw new ModelInstallFailed("checksum", "The downloaded model does not match its checksum.");
    }

    const names = (
      await runTar(["-tjf", archive]).catch((cause: unknown) => {
        throw new ModelInstallFailed("extract", "The model archive could not be read.", { cause });
      })
    )
      .split("\n")
      .filter((name) => name.length > 0);
    if (names.length === 0 || names.some(isUnsafeArchiveEntry)) {
      throw new ModelInstallFailed("unsafe_archive", "The archive has unsafe file names.");
    }
    if (names.some((name) => name.split("/")[0] !== spec.id)) {
      throw new ModelInstallFailed("unsafe_archive", "The archive has unexpected contents.");
    }

    const extractDir = NodePath.join(work, "extract");
    await NodeFS.promises.mkdir(extractDir);
    await runTar(["-xjf", archive, "-C", extractDir, "--no-same-owner"]).catch((cause: unknown) => {
      throw new ModelInstallFailed("extract", "The model archive could not be unpacked.", {
        cause,
      });
    });
    await collectEntries(extractDir);
    const extractedModel = NodePath.join(extractDir, spec.id);
    if (!(await isModelInstalled(spec, extractDir))) {
      throw new ModelInstallFailed("incomplete", "The model archive is missing files.");
    }

    const finalDir = NodePath.join(modelsRoot, spec.id);
    await NodeFS.promises.rm(finalDir, { recursive: true, force: true });
    await NodeFS.promises.rename(extractedModel, finalDir);
    onProgress(1);
  } finally {
    await NodeFS.promises.rm(work, { recursive: true, force: true });
  }
}
