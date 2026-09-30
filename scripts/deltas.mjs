// Prints the per-piece seat deltas that fitDelta finds, for pasting into CLOTHES.
import { loadGLB } from "./load.mjs";
import { CLOTHES, fitDelta } from "../src/game/clothes.ts";
const g = await loadGLB("public/models/hero.glb"); g.scene.updateMatrixWorld(true);
const body = g.scene.getObjectByName("Object_43");
for (const c of CLOTHES) {
  const d = fitDelta(g.scene.getObjectByName(c.name), body, c.lockX);
  console.log(`${c.name}: [${d.toArray().map((x) => x.toFixed(4)).join(", ")}]`);
}
