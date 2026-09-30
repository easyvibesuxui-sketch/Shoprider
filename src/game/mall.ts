import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The mall corridor: storefronts along both walls, kiosks down the middle,
// checkout at the far end. Props are simple shapes; the hero's clothes are not.

export const HALF_W = 9;

export interface Blocker {
  x: number;
  z: number;
  r: number;
}

const SHOPS = [
  ["LUXE", "#e8c07a"], ["GLAM", "#ff6fa8"], ["VOGUE", "#9ad7ff"], ["BOUTIQUE", "#ffd166"],
  ["CHIC", "#b78cff"], ["DIVA", "#ff8a5b"], ["SILK", "#7ee0b5"], ["ATELIER", "#f4f1de"],
  ["COUTURE", "#ff5d73"], ["BIJOU", "#6ec3ff"],
];

function signTexture(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#15121c";
  g.fillRect(0, 0, 512, 128);
  g.font = "bold 76px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.fillStyle = color;
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function floorTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? "#d9d2c5" : "#efe9de";
      g.fillRect(x * 128, y * 128, 128, 128);
    }
  g.strokeStyle = "rgba(0,0,0,0.08)";
  g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Mall {
  readonly group = new THREE.Group();
  readonly blockers: Blocker[] = [];
  private gateMat = new THREE.MeshStandardMaterial({ color: 0xd33a4a, emissive: 0x551018 });
  private gateSign!: THREE.Mesh;

  constructor(readonly length: number, seed: number) {
    const rnd = mulberry(seed);
    const L = length;

    const floorTex = floorTexture();
    floorTex.repeat.set(HALF_W, (L + 20) / 2);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, L + 20),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, L / 2);
    floor.receiveShadow = true;
    this.group.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, L + 20),
      new THREE.MeshStandardMaterial({ color: 0xf6f1ea, roughness: 0.9 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 7, L / 2);
    this.group.add(ceiling);

    // light strips
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xfff6e0 });
    for (let z = -6; z < L + 8; z += 6) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 0.5), stripMat);
      s.position.set(0, 6.95, z);
      this.group.add(s);
    }

    // storefronts
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2433, roughness: 0.6 });
    let shop = Math.floor(rnd() * SHOPS.length);
    // one sign / glass / stand material per shop name, so merging can batch them
    const shopMats = new Map<string, { sign: THREE.Material; glass: THREE.Material; stand: THREE.Material }>();
    const matsFor = (name: string, color: string) => {
      let m = shopMats.get(name);
      if (!m) {
        m = {
          sign: new THREE.MeshBasicMaterial({ map: signTexture(name, color) }),
          glass: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.35), emissive: new THREE.Color(color).multiplyScalar(0.18), roughness: 0.1, metalness: 0.6 }),
          stand: new THREE.MeshStandardMaterial({ color }),
        };
        shopMats.set(name, m);
      }
      return m;
    };
    for (const side of [-1, 1]) {
      for (let z = -8; z < L + 8; z += 8) {
        const [name, color] = SHOPS[shop++ % SHOPS.length];
        const mats = matsFor(name, color);
        const front = new THREE.Group();
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 8), wallMat);
        wall.position.y = 3.5;
        front.add(wall);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.6), mats.glass);
        glass.position.set(-side * 0.21, 2.1, 0);
        glass.rotation.y = -side * Math.PI / 2;
        front.add(glass);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.2), mats.sign);
        sign.position.set(-side * 0.22, 4.7, 0);
        sign.rotation.y = -side * Math.PI / 2;
        front.add(sign);
        // mannequin stands in the window
        for (const dz of [-1.8, 1.8]) {
          const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.6, 12), mats.stand);
          stand.position.set(-side * 0.6, 0.8, dz);
          front.add(stand);
        }
        front.position.set(side * (HALF_W + 0.2), 0, z + 4);
        this.group.add(front);
      }
    }

    // kiosks and planters down the middle
    const kioskMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const plantMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 0.8 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0x8a6f5a, roughness: 0.7 });
    for (let z = 12; z < L - 6; z += 9 + rnd() * 5) {
      const x = (rnd() * 2 - 1) * (HALF_W - 3);
      if (rnd() < 0.5) {
        const k = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.1, 20), kioskMat);
        k.position.set(x, 0.55, z);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 20), new THREE.MeshStandardMaterial({ color: SHOPS[Math.floor(rnd() * SHOPS.length)][1] }));
        top.position.set(x, 1.15, z);
        this.group.add(k, top);
        this.blockers.push({ x, z, r: 1.2 });
      } else {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.55, 0.8, 16), potMat);
        pot.position.set(x, 0.4, z);
        const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), plantMat);
        bush.position.set(x, 1.4, z);
        this.group.add(pot, bush);
        this.blockers.push({ x, z, r: 0.8 });
      }
    }

    // checkout gate
    const gate = new THREE.Group();
    for (const sx of [-2.4, 2.4]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 0.4), this.gateMat);
      post.position.set(sx, 1.6, 0);
      gate.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 0.4), this.gateMat);
    beam.position.set(0, 3.2, 0);
    gate.add(beam);
    this.gateSign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: signTexture("CHECKOUT", "#ff5d73") }));
    this.gateSign.position.set(0, 3.9, 0);
    this.gateSign.rotation.y = Math.PI;
    gate.add(this.gateSign);
    gate.position.set(0, 0, L);
    this.group.add(gate);
    this.mergeStatic();
  }

  // Bake every static mesh into one geometry per material: a few dozen draw
  // calls instead of several hundred, which is what phones choke on.
  private mergeStatic() {
    this.group.updateMatrixWorld(true);
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const old: THREE.Mesh[] = [];
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      let g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material)!.push(g);
      old.push(m);
    });
    for (const m of old) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    this.group.clear();
    for (const [mat, geos] of byMat) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
  }

  openGate() {
    this.gateMat.color.set(0x35c46a);
    this.gateMat.emissive.set(0x0f4d25);
    (this.gateSign.material as THREE.MeshBasicMaterial).map = signTexture("CHECKOUT", "#7ee0b5");
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((x) => {
          (x as THREE.MeshBasicMaterial).map?.dispose();
          x.dispose();
        });
      }
    });
  }
}

export function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
