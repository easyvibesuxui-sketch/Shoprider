import { loadGLB, THREE } from "./load.mjs";
for (const f of ["public/models/karen-easy.glb","public/models/karen-hard.glb"]) {
  const g = await loadGLB(f); const clip = g.animations[0]; const s = g.scene;
  const mixer = new THREE.AnimationMixer(s); mixer.clipAction(clip).play();
  let hips, foot, head; s.traverse(o => { if (!o.isBone) return; if (!hips && /Hips/.test(o.name)) hips = o; if (/LeftFoot/.test(o.name) && !foot) foot = o; if (/HeadTop|Head_/.test(o.name) && !head) head = o; });
  const zs = []; let top = -1e9, bot = 1e9;
  for (let i = 0; i <= 300; i++) { mixer.setTime(clip.duration * i / 300); s.updateMatrixWorld(true);
    const h = hips.getWorldPosition(new THREE.Vector3()), fp = foot.getWorldPosition(new THREE.Vector3());
    zs.push(fp.z - h.z); top = Math.max(top, head.getWorldPosition(new THREE.Vector3()).y); bot = Math.min(bot, fp.y); }
  // count foot cycles by zero crossings of (z - mean)
  const m = zs.reduce((a,b)=>a+b)/zs.length; let cross = 0; for (let i=1;i<zs.length;i++) if ((zs[i-1]-m)<0 && (zs[i]-m)>=0) cross++;
  const range = Math.max(...zs) - Math.min(...zs); const height = top - bot;
  const cycles = Math.max(1, cross), cyclesT = clip.duration / cycles;
  const speedRel = (2 * range / height) / cyclesT; // stride per cycle ≈ 2*range, in body heights per second
  console.log(f, "cycles", cycles, "cycle", cyclesT.toFixed(2)+"s", "footRange/height", (range/height).toFixed(2), "speed m/s at 1.72m", (speedRel*1.72).toFixed(2));
}
