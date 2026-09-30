import { loadGLB, THREE } from "./load.mjs";
for (const f of ["public/models/karen-easy.glb","public/models/karen-hard.glb"]) {
  const g = await loadGLB(f); const s = g.scene; s.updateMatrixWorld(true);
  const box = new THREE.Box3(); const v = new THREE.Vector3();
  s.traverse(o => { if (o.isSkinnedMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 7) { v.fromBufferAttribute(p, i); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld); box.expandByPoint(v); } } });
  console.log(f, "box", box.min.toArray().map(x=>x.toFixed(2)), box.max.toArray().map(x=>x.toFixed(2)));
  console.log(" anims", g.animations.map(a => a.name + " " + a.duration.toFixed(2) + "s tracks " + a.tracks.length));
  const hips = g.animations[0].tracks.filter(t => /Hips.*position/i.test(t.name)).map(t => t.name + " first " + [...t.values.slice(0,3)].map(x=>x.toFixed(1)) + " last " + [...t.values.slice(-3)].map(x=>x.toFixed(1)));
  console.log(" ", hips);
  let chain = []; s.traverse(o => { if (o.scale.x !== 1 || o.rotation.x !== 0) chain.push(o.name + " s" + o.scale.x.toFixed(3) + " rx" + o.rotation.x.toFixed(2)); }); console.log(" ", chain.slice(0, 8));
}
