import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CLOTHES, fitDelta, shiftSkinned } from "./clothes.ts";

// hero.glb has bones but no animation clips, so every pose here is procedural.
// Face points +Z. Her left side is +X.

interface Joint {
  bone: THREE.Bone;
  rest: THREE.Quaternion; // local rest quaternion (after dropArms for the arms)
  axis: THREE.Vector3; // hero side axis (+X) expressed in the parent's local frame
}

export class Hero {
  readonly group = new THREE.Group();
  private model!: THREE.Object3D;
  private cloth = new Map<string, THREE.SkinnedMesh>();
  private joints: Record<string, Joint> = {};
  private phase = 0;
  outfit = 0;

  async load(url: string, onProgress?: (e: ProgressEvent) => void) {
    const gltf = await new GLTFLoader().loadAsync(url, onProgress);
    this.model = gltf.scene;
    this.model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.frustumCulled = false;
        o.castShadow = true;
      }
    });
    this.group.add(this.model);
    this.model.updateMatrixWorld(true);

    this.seatClothes();
    this.dropArms();
    this.captureJoints();
    // the rig sits ~0.107 m off centre on X
    const pelvis = this.find("bip_pelvis");
    const p = pelvis.getWorldPosition(new THREE.Vector3());
    this.model.position.x -= p.x;
    this.setOutfit(0);
  }

  private find(prefix: string): THREE.Bone {
    let hit: THREE.Bone | undefined;
    this.model.traverse((o) => {
      if (!hit && (o as THREE.Bone).isBone && o.name.startsWith(prefix + "_mirko")) hit = o as THREE.Bone;
    });
    if (!hit) throw new Error(`bone ${prefix} missing`);
    return hit;
  }

  // Bake every file garment onto the body while the bones are still in bind pose.
  private seatClothes() {
    const body = this.model.getObjectByName("Object_43") as THREE.SkinnedMesh;
    for (const piece of CLOTHES) {
      const mesh = this.model.getObjectByName(piece.name) as THREE.SkinnedMesh | undefined;
      if (!mesh?.isSkinnedMesh) continue;
      shiftSkinned(mesh, fitDelta(mesh, body, piece.lockX));
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        // cloth hugs the skin; win the depth tie instead of z-fighting
        m.polygonOffset = true;
        m.polygonOffsetFactor = -2;
        m.polygonOffsetUnits = -2;
      }
      this.cloth.set(piece.name, mesh);
    }
  }

  // Aim the upper arms down along the body instead of the authored A/T pose.
  private dropArms() {
    const root = this.model;
    root.updateMatrixWorld(true);
    const centreX = this.find("bip_pelvis").getWorldPosition(new THREE.Vector3()).x;
    for (const side of ["L", "R"]) {
      const upper = this.find(`bip_upperArm_${side}`);
      const lower = this.find(`bip_lowerArm_${side}`);
      const a = upper.getWorldPosition(new THREE.Vector3());
      const b = lower.getWorldPosition(new THREE.Vector3());
      const cur = b.sub(a).normalize();
      const out = Math.sign(a.x - centreX);
      // wide enough that the hands clear her hips
      const target = new THREE.Vector3(out * 0.25, -1, 0.02).normalize();
      const turn = new THREE.Quaternion().setFromUnitVectors(cur, target);
      const parentQ = upper.parent!.getWorldQuaternion(new THREE.Quaternion());
      // clone(): invert() mutates, and parentQ is needed un-inverted on the right
      const local = parentQ.clone().invert().multiply(turn).multiply(parentQ);
      upper.quaternion.premultiply(local);
      root.updateMatrixWorld(true);
    }
  }

  private captureJoints() {
    this.model.updateMatrixWorld(true);
    const rootQ = this.group.getWorldQuaternion(new THREE.Quaternion());
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(rootQ);
    const names = ["upperArm_L", "upperArm_R", "lowerArm_L", "lowerArm_R", "hip_L", "hip_R", "knee_L", "knee_R", "spine_1"];
    for (const n of names) {
      const bone = this.find(`bip_${n}`);
      const pq = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
      this.joints[n] = { bone, rest: bone.quaternion.clone(), axis: side.clone().applyQuaternion(pq.invert()).normalize() };
    }
  }

  private bend(n: string, angle: number) {
    const j = this.joints[n];
    j.bone.quaternion.setFromAxisAngle(j.axis, angle).multiply(j.rest);
  }

  // speed: signed, 0 idle, 1 full run forward, negative backing up.
  // Positive angle about +X swings a limb backward.
  pose(dt: number, speed: number) {
    const s = THREE.MathUtils.clamp(Math.abs(speed), 0, 1.4);
    const dir = speed < 0 ? -1 : 1;
    this.phase += dt * (2 + 8 * s) * dir;
    const t = this.phase;
    const sw = Math.sin(t);
    const legAmp = 0.6 * Math.min(s, 1.2);

    // Arms: swing from the shoulder in the walking plane, a bit more forward than
    // back, opposite to the legs. Elbows stay bent while running so the hands
    // pump at waist height instead of flying up to the shoulder.
    const armAmp = 0.42 * Math.min(s, 1.2);
    const arm = (x: number) => (x < 0 ? x : x * 0.7) * armAmp; // x<0 forward
    this.bend("upperArm_L", arm(sw));
    this.bend("upperArm_R", arm(-sw));
    const elbow = 0.15 + 0.55 * Math.min(s, 1);
    this.bend("lowerArm_L", -elbow - 0.2 * s * Math.max(0, -sw));
    this.bend("lowerArm_R", -elbow - 0.2 * s * Math.max(0, sw));

    this.bend("hip_L", -legAmp * sw);
    this.bend("hip_R", legAmp * sw);
    this.bend("knee_L", 0.05 + 1.0 * s * Math.max(0, Math.sin(t + 1.4)));
    this.bend("knee_R", 0.05 + 1.0 * s * Math.max(0, Math.sin(t + 1.4 + Math.PI)));
    // idle: a slow breath; running: lean into it
    const breathe = s < 0.02 ? Math.sin(t * 0.35) * 0.015 : 0;
    this.bend("spine_1", -0.08 * Math.min(s, 1) * dir + breathe);
    this.model.position.y = Math.abs(Math.cos(t)) * 0.04 * Math.min(s, 1);
  }

  // Outfit i shows every file piece whose unlock <= i.
  setOutfit(i: number) {
    this.outfit = i;
    for (const piece of CLOTHES) {
      const mesh = this.cloth.get(piece.name);
      if (mesh) mesh.visible = i >= piece.unlock;
    }
  }

  static pieceFor(i: number) {
    return CLOTHES.find((c) => c.unlock === i);
  }
}
