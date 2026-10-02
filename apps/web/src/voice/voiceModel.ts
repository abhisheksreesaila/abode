/** Moonshine base, 8-bit: about 64 MB, chosen in docs/research/voice-spike.md. */
export const VOICE_MODEL_ID = "onnx-community/moonshine-base-ONNX";
export const VOICE_MODEL_DTYPE = "q8";
/** transformers.js stores model files in this Cache API bucket (its default `env.cacheKey`). */
export const VOICE_CACHE_NAME = "transformers-cache";

export interface DownloadProgressEvent {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
}

/**
 * Folds transformers.js per-file progress events into one 0..1 fraction.
 * Returns null until at least one file reports a size, and for cached loads.
 */
export function createDownloadProgress(): (event: DownloadProgressEvent) => number | null {
  const files = new Map<string, { loaded: number; total: number }>();
  return (event) => {
    if (event.status !== "progress" && event.status !== "done") return null;
    if (event.file === undefined) return null;
    const previous = files.get(event.file);
    const total = event.total ?? previous?.total ?? 0;
    const loaded = event.status === "done" ? total : (event.loaded ?? previous?.loaded ?? 0);
    files.set(event.file, { loaded, total });
    let sumLoaded = 0;
    let sumTotal = 0;
    for (const file of files.values()) {
      sumLoaded += file.loaded;
      sumTotal += file.total;
    }
    return sumTotal === 0 ? null : Math.min(1, sumLoaded / sumTotal);
  };
}

function isModelRequest(request: Request): boolean {
  return request.url.includes(`/${VOICE_MODEL_ID}/`);
}

async function openVoiceCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  return (await caches.has(VOICE_CACHE_NAME)) ? caches.open(VOICE_CACHE_NAME) : null;
}

/** Bytes of the downloaded model, or null when it is not on this device. */
export async function readVoiceModelBytes(): Promise<number | null> {
  const cache = await openVoiceCache();
  if (!cache) return null;
  let bytes = 0;
  let found = false;
  for (const request of await cache.keys()) {
    if (!isModelRequest(request)) continue;
    const response = await cache.match(request);
    if (!response) continue;
    found = true;
    const length = Number(response.headers.get("content-length"));
    bytes += Number.isFinite(length) && length > 0 ? length : (await response.blob()).size;
  }
  return found ? bytes : null;
}

/** Removes only the model files; the cached ONNX runtime stays so a re-download is smaller. */
export async function deleteVoiceModelFiles(): Promise<void> {
  const cache = await openVoiceCache();
  if (!cache) return;
  for (const request of await cache.keys()) {
    if (isModelRequest(request)) await cache.delete(request);
  }
}

export function formatModelSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
