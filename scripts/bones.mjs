import { loadGLB, THREE } from "./load.mjs";
const g = await loadGLB("public/models/hero.glb"); const s = g.scene; s.updateMatrixWorld(true);
const want = /upperArm|lowerArm|hand_L|hand_R|collar|hip_|knee|foot_|pelvis|spine|neck|head_|rootJoint/;
s.traverse(o => { if (o.isBone && want.test(o.name)) { const p = o.getWorldPosition(new THREE.Vector3()); console.log(o.name.replace(/_mirko_ARM.*/,"").padEnd(22), "<-", (o.parent.name||"").replace(/_mirko_ARM.*/,"").padEnd(20), p.toArray().map(x=>x.toFixed(3)).join(",")); } });
let o = s.getObjectByName("Object_43"); const chain=[]; while (o) { chain.push(o.name+"("+o.type+" s"+o.scale.x.toFixed(4)+")"); o = o.parent; } console.log(chain.join(" <- "));
