import { GLTFLoader, type GLTF, type GLTFParser, type GLTFLoaderPlugin } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

// All models go through here. The GLBs in public/models are Draco + WebP
// compressed (sources in art/models, see HANDOFF). Downloads are fetched by hand
// so a stalled or failed request on a phone network is retried instead of
// leaving the preloader stuck.

const draco = new DRACOLoader().setDecoderPath("draco/");

const STALL_MS = 15000; // no bytes for this long: abort and retry
const TRIES = 4;

export type Progress = (e: { loaded: number; total: number; lengthComputable: boolean }) => void;

async function fetchWithRetry(url: string, onProgress?: Progress): Promise<ArrayBuffer> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(), STALL_MS);
    const poke = () => {
      clearTimeout(timer);
      timer = setTimeout(() => ctrl.abort(), STALL_MS);
    };
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: attempt > 1 ? "reload" : "default" });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const total = Number(res.headers.get("content-length")) || 0;
      if (!res.body) {
        const buf = await res.arrayBuffer();
        onProgress?.({ loaded: buf.byteLength, total: buf.byteLength, lengthComputable: true });
        return buf;
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        poke();
        chunks.push(value);
        loaded += value.byteLength;
        onProgress?.({ loaded, total, lengthComputable: total > 0 });
      }
      const out = new Uint8Array(loaded);
      let o = 0;
      for (const c of chunks) {
        out.set(c, o);
        o += c.byteLength;
      }
      return out.buffer;
    } catch (err) {
      const msg = ctrl.signal.aborted ? "download stalled" : err instanceof Error ? err.message : String(err);
      lastErr = new Error(msg.startsWith(url) ? msg : `${url}: ${msg}`);
      onProgress?.({ loaded: 0, total: 0, lengthComputable: false });
      if (attempt < TRIES) await new Promise((r) => setTimeout(r, 800 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${url}: failed to load`);
}

export async function loadGLTF(
  url: string,
  onProgress?: Progress,
  plugins: ((parser: GLTFParser) => GLTFLoaderPlugin)[] = [],
): Promise<GLTF> {
  const buf = await fetchWithRetry(url, onProgress);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  for (const p of plugins) loader.register(p);
  const base = url.slice(0, url.lastIndexOf("/") + 1);
  return loader.parseAsync(buf, base);
}
