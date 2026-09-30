import { loadGLB, THREE } from "./load.mjs";
import { CLOTHES, fitDelta, shiftSkinned, skinnedPoints } from "../src/game/clothes.ts";
const g = await loadGLB("public/models/hero.glb"); const s = g.scene; s.updateMatrixWorld(true);
const body = s.getObjectByName("Object_43");
const bb = new THREE.Box3().setFromPoints(skinnedPoints(body));
const box = m => new THREE.Box3().setFromPoints(skinnedPoints(m));
const f = a => a.toArray().map(x => x.toFixed(3)).join(",");
for (const c of CLOTHES) {
  const m = s.getObjectByName(c.name);
  const before = box(m).getCenter(new THREE.Vector3());
  const t = performance.now();
  const d = fitDelta(m, body, c.lockX);
  shiftSkinned(m, d);
  const b = box(m);
  const after = b.getCenter(new THREE.Vector3());
  console.log(c.label.padEnd(8), "before", f(before), "delta", f(d), "after", f(after), "size", f(b.getSize(new THREE.Vector3())), "inBody", bb.containsPoint(after), (performance.now()-t).toFixed(0)+"ms");
}
console.log("body", f(bb.min), f(bb.max));
