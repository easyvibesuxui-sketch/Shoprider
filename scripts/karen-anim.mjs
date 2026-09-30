import { loadGLB, THREE } from "./load.mjs";
for (const f of ["art/models/karen-easy.glb","art/models/karen-hard.glb"]) {
  const g = await loadGLB(f); const clip = g.animations[0];
  console.log(f, clip.duration.toFixed(2), "tracks", clip.tracks.length);
  for (const t of clip.tracks.filter(t => /position/.test(t.name))) {
    const v = t.values, mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
    for (let i=0;i<v.length;i+=3) for (let k=0;k<3;k++){mn[k]=Math.min(mn[k],v[i+k]);mx[k]=Math.max(mx[k],v[i+k]);}
    if (Math.max(...mx.map((x,k)=>x-mn[k]))>1) console.log("  ", t.name, "range", mx.map((x,k)=>(x-mn[k]).toFixed(1)).join(","), "keys", t.times.length);
  }
  // sample the hip world pos + foot heights over time
  const s = g.scene; const mixer = new THREE.AnimationMixer(s); mixer.clipAction(clip).play();
  const hips = s.getObjectByProperty("isBone", true);
  const rows=[];
  for (let t=0;t<clip.duration;t+=clip.duration/12){ mixer.setTime(t); s.updateMatrixWorld(true); const p=hips.getWorldPosition(new THREE.Vector3()); rows.push(t.toFixed(1)+":"+p.toArray().map(x=>x.toFixed(2)).join(",")); }
  console.log("  root bone", hips.name, rows.join("  "));
}
