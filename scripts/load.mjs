// Node helper: load a GLB with three's GLTFLoader (textures stubbed out).
import fs from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
globalThis.self = globalThis;
globalThis.createImageBitmap = undefined;
globalThis.Image = class {};
const origWarn = console.warn;
console.warn = (...a) => { if (!String(a[0]).includes("texture")) origWarn(...a); };
export async function loadGLB(path) {
  const buf = fs.readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, "", res, rej));
}
export { THREE };
