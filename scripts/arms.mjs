// Print shoulder/elbow/hand positions (hero space, metres) through a run cycle.
import { loadGLB, THREE } from "./load.mjs";
import { Hero } from "../src/game/hero.ts";
const g = await loadGLB("art/models/hero.glb");
const h = new Hero(); h.model = g.scene; h.group.add(g.scene); g.scene.updateMatrixWorld(true);
h.dropArms(); h.captureJoints();
const f = v => v.toArray().map(x => x.toFixed(2)).join(",");
const at = n => h.find(n).getWorldPosition(new THREE.Vector3());
for (const [ph, sp] of [[0, 0], [0, 1], [1.57, 1], [4.71, 1]]) {
  h.phase = ph; h.pose(0, sp); h.phase = ph; h.group.updateMatrixWorld(true);
  const row = ["L", "R"].map(s => `${s}: sh ${f(at("bip_upperArm_" + s))} el ${f(at("bip_lowerArm_" + s))} hand ${f(at("bip_hand_" + s))}`);
  console.log(`phase ${ph} speed ${sp}\n  ${row.join("\n  ")}`);
}
