import * as THREE from "three";
import { GLTFLoader, type GLTF, type GLTFParser } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

// Karens. The files are Mixamo rigs ~3.4 m tall in their own units. We scale a
// wrapper group, never the rig itself, and never rebind.
export type FoeKind = "easy" | "mid" | "hard";

const FILES = {
  easy: "models/karen-easy.glb",
  hard: "models/karen-hard.glb",
} as const;

const HEIGHT = 1.72;

// Walk speed (m/s at 1.72 m) the clip's feet were animated for, measured with
// scripts/karen-stride.mjs. Playback rate = actual speed / this, so feet don't skate.
const CLIP_SPEED: Record<string, number> = {
  [FILES.easy]: 1.3,
  [FILES.hard]: 1.0,
};

interface Template {
  gltf: GLTF;
  scale: number;
  lift: number;
  clipSpeed: number;
}

// karen-easy's walk carries root motion: the hips travel ~4.5 m forward over the
// 15 s clip, then snap back when it loops. We move the Karen ourselves, so pin the
// hips' X/Z to their first key and keep only the vertical bob.
function stripRootMotion(clip: THREE.AnimationClip) {
  for (const t of clip.tracks) {
    if (!/Hips[^.]*\.position$/.test(t.name)) continue;
    const v = t.values;
    for (let i = 3; i < v.length; i += 3) {
      v[i] = v[0];
      v[i + 2] = v[2];
    }
  }
}

const templates = new Map<string, Promise<Template>>();

// karen-hard.glb uses KHR_materials_pbrSpecularGlossiness, which three.js dropped.
// Map its diffuse colour/texture onto a standard material so she isn't grey.
const SPEC_GLOSS = "KHR_materials_pbrSpecularGlossiness";
function specGloss(parser: GLTFParser) {
  const ext = (i: number) => parser.json.materials?.[i]?.extensions?.[SPEC_GLOSS];
  return {
    name: SPEC_GLOSS,
    extendMaterialParams(i: number, params: Record<string, unknown>) {
      const e = ext(i);
      if (!e) return Promise.resolve();
      const f = e.diffuseFactor ?? [1, 1, 1, 1];
      params.color = new THREE.Color().setRGB(f[0], f[1], f[2], THREE.LinearSRGBColorSpace);
      params.opacity = f[3];
      params.metalness = 0;
      params.roughness = 1 - (e.glossinessFactor ?? 0.5) * 0.6;
      return e.diffuseTexture ? parser.assignTexture(params, "map", e.diffuseTexture, THREE.SRGBColorSpace) : Promise.resolve();
    },
  };
}

function template(file: string, onProgress?: (e: ProgressEvent) => void): Promise<Template> {
  let t = templates.get(file);
  if (!t) {
    t = new GLTFLoader().register(specGloss).loadAsync(file, onProgress).then((gltf) => {
      // the catwalk file ships its own spotlights; the mall lights itself
      const lights: THREE.Object3D[] = [];
      gltf.scene.traverse((o) => {
        if ((o as THREE.Light).isLight) lights.push(o);
        if ((o as THREE.Mesh).isMesh) {
          o.frustumCulled = false;
          o.castShadow = true;
        }
      });
      lights.forEach((l) => l.removeFromParent());
      gltf.animations.forEach(stripRootMotion);
      // measure the posed height from the first animation frame
      const probe = cloneSkinned(gltf.scene);
      const mixer = new THREE.AnimationMixer(probe);
      if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
      mixer.update(0);
      probe.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const v = new THREE.Vector3();
      probe.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (!m.isSkinnedMesh) return;
        const pos = m.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 5) {
          v.fromBufferAttribute(pos, i);
          m.applyBoneTransform(i, v);
          box.expandByPoint(v.applyMatrix4(m.matrixWorld));
        }
      });
      const scale = HEIGHT / (box.max.y - box.min.y);
      return { gltf, scale, lift: -box.min.y * scale, clipSpeed: CLIP_SPEED[file] ?? 1.2 };
    });
    templates.set(file, t);
  }
  return t;
}

// L1–L2 easy, L3–L4 mid (a mix of both files), L5–L7 hard.
function fileFor(kind: FoeKind, n: number) {
  if (kind === "easy") return FILES.easy;
  if (kind === "hard") return FILES.hard;
  return n % 2 === 0 ? FILES.easy : FILES.hard;
}

export function preloadFoes(track?: (url: string) => (e: ProgressEvent) => void) {
  return Promise.all(Object.values(FILES).map((f) => template(f, track?.(f))));
}

export class Karen {
  readonly group = new THREE.Group();
  private mixer!: THREE.AnimationMixer;
  private action?: THREE.AnimationAction;
  private clipSpeed = 1.2;
  heading = 0; // current facing, eased toward `want`
  want = 0;
  wanderT = 0;
  stun = 0;
  stuckT = 0;

  constructor(readonly kind: FoeKind, readonly speed: number) {}

  async spawn(n: number) {
    const t = await template(fileFor(this.kind, n));
    const inst = cloneSkinned(t.gltf.scene);
    inst.scale.setScalar(t.scale);
    inst.position.y = t.lift;
    this.group.add(inst);
    this.clipSpeed = t.clipSpeed;
    this.mixer = new THREE.AnimationMixer(inst);
    const clip = t.gltf.animations[0];
    if (clip) {
      this.action = this.mixer.clipAction(clip);
      this.action.time = Math.random() * clip.duration;
      this.action.play();
    }
    return this;
  }

  // Turn toward `want` at a human rate; returns how aligned she is (0..1).
  turn(dt: number, rate = 5) {
    const d = Math.atan2(Math.sin(this.want - this.heading), Math.cos(this.want - this.heading));
    this.heading += THREE.MathUtils.clamp(d, -rate * dt, rate * dt);
    return Math.max(0, Math.cos(d));
  }

  // v: metres per second she actually moved this frame. Standing still freezes the
  // walk mid-stride instead of marching in place.
  update(dt: number, v: number) {
    if (this.action) this.action.timeScale = v > 0.05 ? THREE.MathUtils.clamp(v / this.clipSpeed, 0.5, 3) : 0;
    this.mixer?.update(dt);
    // Mixamo faces +Z
    this.group.rotation.y = this.heading;
  }
}
