import * as THREE from "three";

// Clothes that ship inside hero.glb. They are skinned to the right bones but
// authored away from the body (beside it, behind it, under the feet). We move
// the vertices, not the mesh: a SkinnedMesh ignores mesh.position.
export interface ClothPiece {
  name: string; // mesh node name in hero.glb
  label: string; // shown in the HUD when unlocked
  unlock: number; // outfit index at which the piece appears
  lockX?: boolean; // keep X (the gloves are a pair; a centre shift stacks them)
}

// Level 1 starts with the minimum (the leotard); each cleared level adds the
// next piece, smallest first, so she is fully dressed by level 6.
export const CLOTHES: ClothPiece[] = [
  { name: "Object_35", label: "Leotard", unlock: 0 },
  { name: "Object_37", label: "Collar", unlock: 1 },
  { name: "Object_19", label: "Gloves", unlock: 2, lockX: true },
  { name: "Object_21", label: "Belt", unlock: 3 },
  { name: "Object_13", label: "Boots", unlock: 4 },
  { name: "Object_15", label: "Stockings", unlock: 5 },
];

const _m = new THREE.Matrix4();
const _blend = new THREE.Matrix4();
const _full = new THREE.Matrix4();
const _v = new THREE.Vector3();

// World matrix that the skinning shader applies to vertex i:
// matrixWorld * bindMatrixInverse * (sum w_k * bone_k.matrixWorld * boneInverse_k) * bindMatrix
function skinMatrix(mesh: THREE.SkinnedMesh, i: number, out: THREE.Matrix4) {
  const si = mesh.geometry.attributes.skinIndex;
  const sw = mesh.geometry.attributes.skinWeight;
  const { bones, boneInverses } = mesh.skeleton;
  const e = _blend.elements;
  e.fill(0);
  for (let k = 0; k < 4; k++) {
    const w = sw.getComponent(i, k);
    if (w === 0) continue;
    const b = si.getComponent(i, k);
    _m.multiplyMatrices(bones[b].matrixWorld, boneInverses[b]);
    for (let j = 0; j < 16; j++) e[j] += w * _m.elements[j];
  }
  return out.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(_blend).multiply(mesh.bindMatrix);
}

// Posed world position of every vertex (setFromObject lies for skinned meshes).
export function skinnedPoints(mesh: THREE.SkinnedMesh, step = 1): THREE.Vector3[] {
  const pos = mesh.geometry.attributes.position;
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i += step) {
    const p = new THREE.Vector3().fromBufferAttribute(pos, i);
    mesh.applyBoneTransform(i, p);
    out.push(p.applyMatrix4(mesh.matrixWorld));
  }
  return out;
}

// Move a skinned mesh by a world-space delta. Per vertex: invert the blended
// skin matrix and write back the bind-space position that lands at world+delta.
export function shiftSkinned(mesh: THREE.SkinnedMesh, delta: THREE.Vector3) {
  const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    skinMatrix(mesh, i, _full);
    _v.fromBufferAttribute(pos, i).applyMatrix4(_full).add(delta);
    _v.applyMatrix4(_full.invert());
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

// Uniform grid over the body's posed vertices for nearest-point queries.
class PointGrid {
  private cells = new Map<string, THREE.Vector3[]>();
  private size: number;
  constructor(points: THREE.Vector3[], size: number) {
    this.size = size;
    for (const p of points) {
      const k = this.key(p.x, p.y, p.z);
      let c = this.cells.get(k);
      if (!c) this.cells.set(k, (c = []));
      c.push(p);
    }
  }
  private key(x: number, y: number, z: number) {
    const s = this.size;
    return `${Math.floor(x / s)},${Math.floor(y / s)},${Math.floor(z / s)}`;
  }
  nearest(p: THREE.Vector3, maxRing = 6): THREE.Vector3 | null {
    const s = this.size;
    const cx = Math.floor(p.x / s), cy = Math.floor(p.y / s), cz = Math.floor(p.z / s);
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (let r = 0; r <= maxRing; r++) {
      for (let x = cx - r; x <= cx + r; x++)
        for (let y = cy - r; y <= cy + r; y++)
          for (let z = cz - r; z <= cz + r; z++) {
            if (Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz)) !== r) continue;
            const c = this.cells.get(`${x},${y},${z}`);
            if (!c) continue;
            for (const q of c) {
              const d = q.distanceToSquared(p);
              if (d < bestD) { bestD = d; best = q; }
            }
          }
      // anything found in ring r is exact once r*s exceeds its distance
      if (best && Math.sqrt(bestD) <= r * s) return best;
    }
    return best;
  }
}

// Where a piece belongs: centroid of body vertices weighted by how much they
// share the piece's bones. Then refine with translation-only ICP onto the skin.
export function fitDelta(cloth: THREE.SkinnedMesh, body: THREE.SkinnedMesh, lockX = false): THREE.Vector3 {
  const hist = new Map<number, number>();
  const csi = cloth.geometry.attributes.skinIndex, csw = cloth.geometry.attributes.skinWeight;
  // both meshes share one skeleton in hero.glb, so bone indices line up
  for (let i = 0; i < csi.count; i++)
    for (let k = 0; k < 4; k++) {
      const w = csw.getComponent(i, k);
      if (w > 0) hist.set(csi.getComponent(i, k), (hist.get(csi.getComponent(i, k)) || 0) + w);
    }
  const bodyPts = skinnedPoints(body);
  const bsi = body.geometry.attributes.skinIndex, bsw = body.geometry.attributes.skinWeight;
  const anchor = new THREE.Vector3();
  let total = 0;
  for (let j = 0; j < bodyPts.length; j++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += bsw.getComponent(j, k) * (hist.get(bsi.getComponent(j, k)) || 0);
    if (s <= 0) continue;
    anchor.addScaledVector(bodyPts[j], s);
    total += s;
  }
  anchor.divideScalar(total);

  const clothPts = skinnedPoints(cloth, Math.max(1, Math.floor(csi.count / 3000)));
  const centroid = clothPts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(clothPts.length);
  const delta = anchor.clone().sub(centroid);

  const grid = new PointGrid(bodyPts, 0.03);
  const p = new THREE.Vector3();
  for (let it = 0; it < 25; it++) {
    const pulls: { d: number; v: THREE.Vector3 }[] = [];
    for (const c of clothPts) {
      p.copy(c).add(delta);
      const q = grid.nearest(p);
      if (q) pulls.push({ d: q.distanceToSquared(p), v: q.clone().sub(p) });
    }
    pulls.sort((a, b) => a.d - b.d);
    const keep = pulls.slice(0, Math.floor(pulls.length * 0.8));
    const step = keep.reduce((a, x) => a.add(x.v), new THREE.Vector3()).divideScalar(keep.length);
    if (lockX) step.x = 0;
    delta.add(step);
    if (step.length() < 1e-4) break;
  }
  if (lockX) delta.x = 0;
  return delta;
}
