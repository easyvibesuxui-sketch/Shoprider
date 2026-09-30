import { loadGLB, THREE } from "./load.mjs";
const g = await loadGLB(process.argv[2]);
const s = g.scene; s.updateMatrixWorld(true);
const v = new THREE.Vector3();
s.traverse(o => {
  if (!o.isMesh) return;
  const box = new THREE.Box3(); const pos = o.geometry.attributes.position;
  const bones = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (o.isSkinnedMesh) o.applyBoneTransform(i, v);
    v.applyMatrix4(o.matrixWorld); box.expandByPoint(v);
    if (o.isSkinnedMesh) for (let k = 0; k < 4; k++) { const w = o.geometry.attributes.skinWeight.getComponent(i, k); if (w > 0.2) { const b = o.skeleton.bones[o.geometry.attributes.skinIndex.getComponent(i, k)].name.replace(/_mirko_ARM.*/, ""); bones.set(b, (bones.get(b) || 0) + 1); } }
  }
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const top = [...bones].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([b, n]) => b + ":" + n).join(" ");
  console.log(o.name.padEnd(10), (o.material.name || "").padEnd(12), "c", c.toArray().map(x => x.toFixed(2)).join(","), "size", sz.toArray().map(x => x.toFixed(2)).join(","), "|", top);
});
