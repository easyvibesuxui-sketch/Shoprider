import * as THREE from "three";
import { Hero } from "./hero";
import { Karen, preloadFoes } from "./foes";
import { HALF_W, Mall, mulberry } from "./mall";
import { LEVELS } from "./levels";
import { CLOTHES } from "./clothes";
import { Input } from "./input";
import { Hud } from "./hud";

type State = "loading" | "title" | "play" | "clear" | "over" | "win";

const RUN = 4.8; // m/s
const DASH = 11;
const TURN = 2.6; // rad/s
const HERO_R = 0.35;
const FOE_R = 0.4;

interface Bag {
  mesh: THREE.Group;
  taken: boolean;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  private sun = new THREE.DirectionalLight(0xffffff, 1.6);
  private timer = new THREE.Timer();
  private hero = new Hero();
  private input: Input;
  private hud = new Hud();

  private state: State = "loading";
  level = 0;
  private lives = 3;
  private mall?: Mall;
  private foes: Karen[] = [];
  private bags: Bag[] = [];
  private collected = 0;
  private yaw = 0;
  private speed = 0;
  private dashT = 0;
  private dashCd = 0;
  private hurtT = 0;
  private showT = 0;
  private camYaw = 0;
  private params = new URLSearchParams(location.search);

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);
    this.input = new Input(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x1c1724);
    this.scene.fog = new THREE.Fog(0x1c1724, 30, 70);
    this.scene.add(new THREE.HemisphereLight(0xfff4e8, 0x3a3040, 1.1));
    this.sun.position.set(4, 10, -3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.hero.group);

    addEventListener("resize", () => this.resize());
    this.resize();
    this.hud.onAction = () => this.action();
    this.input.onAction = () => this.action();
  }

  async start() {
    this.hud.loading();
    await Promise.all([this.hero.load("models/hero.glb"), preloadFoes()]);
    const lv = Number(this.params.get("level"));
    this.level = Number.isFinite(lv) && lv >= 1 && lv <= LEVELS.length ? lv - 1 : 0;
    await this.buildLevel();
    const outfit = this.params.get("outfit");
    this.hero.setOutfit(outfit !== null ? Number(outfit) : this.level);
    this.hud.stats(this.level + 1, 0, LEVELS[this.level].bags, this.lives, this.hero.outfit);
    this.state = "title";
    this.hud.title(this.level + 1);
    if (this.params.has("shot")) this.hud.play(); // clean frame for screenshots
    if (this.params.has("play")) this.action();
    this.renderer.setAnimationLoop(() => this.frame());
    (window as unknown as { game: Game }).game = this;
  }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 72 : 60;
    this.camera.updateProjectionMatrix();
  }

  private action() {
    if (this.state === "title") {
      this.state = "play";
      this.hud.play();
    } else if (this.state === "clear") {
      this.level++;
      this.buildLevel().then(() => {
        this.state = "play";
        this.hud.play();
      });
    } else if (this.state === "over") {
      this.lives = 3;
      this.buildLevel().then(() => {
        this.state = "play";
        this.hud.play();
      });
    } else if (this.state === "win") {
      this.level = 0;
      this.lives = 3;
      this.hero.setOutfit(0);
      this.buildLevel().then(() => {
        this.state = "title";
        this.hud.title(1);
      });
    } else if (this.state === "play") {
      this.dash();
    }
  }

  private async buildLevel() {
    const L = LEVELS[this.level];
    if (this.mall) {
      this.scene.remove(this.mall.group);
      this.mall.dispose();
    }
    this.foes.forEach((f) => this.scene.remove(f.group));
    this.bags.forEach((b) => this.scene.remove(b.mesh));
    const rnd = mulberry(1000 + this.level * 77);
    this.mall = new Mall(L.length, 7 + this.level);
    this.scene.add(this.mall.group);

    this.bags = [];
    for (let i = 0; i < L.bags; i++) {
      const p = this.freeSpot(rnd, 6, L.length - 3);
      const mesh = makeBag(i);
      mesh.position.set(p.x, 0, p.z);
      this.scene.add(mesh);
      this.bags.push({ mesh, taken: false });
    }
    this.collected = 0;

    const spots: { x: number; z: number }[] = [];
    for (let i = 0; i < L.foes; i++) spots.push(this.freeSpot(rnd, 14, L.length - 4, spots));
    this.foes = await Promise.all(
      spots.map(async (p, i) => {
        const k = await new Karen(L.foe, L.speed).spawn(i);
        k.group.position.set(p.x, 0, p.z);
        k.heading = Math.PI;
        this.scene.add(k.group);
        return k;
      }),
    );

    this.yaw = 0;
    this.speed = 0;
    this.hurtT = 0;
    this.hero.group.position.set(0, 0, 0);
    this.hero.group.rotation.y = 0;
    this.camYaw = 0;
    this.hud.stats(this.level + 1, this.collected, L.bags, this.lives, this.hero.outfit);
  }

  private freeSpot(rnd: () => number, z0: number, z1: number, avoid: { x: number; z: number }[] = []) {
    for (let t = 0; t < 50; t++) {
      const x = (rnd() * 2 - 1) * (HALF_W - 1.5);
      const z = z0 + rnd() * (z1 - z0);
      const clear = this.mall!.blockers.every((b) => Math.hypot(b.x - x, b.z - z) > b.r + 1);
      if (clear && avoid.every((a) => Math.hypot(a.x - x, a.z - z) > 4)) return { x, z };
    }
    return { x: 0, z: (z0 + z1) / 2 };
  }

  private dash() {
    if (this.dashCd > 0) return;
    this.dashT = 0.22;
    this.dashCd = 1.6;
  }

  private collide(pos: THREE.Vector3, r: number) {
    for (const b of this.mall!.blockers) {
      const dx = pos.x - b.x, dz = pos.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d < b.r + r && d > 1e-4) {
        pos.x = b.x + (dx / d) * (b.r + r);
        pos.z = b.z + (dz / d) * (b.r + r);
      }
    }
    const L = LEVELS[this.level].length;
    pos.x = THREE.MathUtils.clamp(pos.x, -HALF_W + r + 0.3, HALF_W - r - 0.3);
    pos.z = THREE.MathUtils.clamp(pos.z, -4, L + 3);
  }

  private frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 1 / 20);
    const t = this.timer.getElapsed();
    const L = LEVELS[this.level];
    const heroPos = this.hero.group.position;

    if (this.state === "play") {
      const { turn, forward } = this.input.axes();
      this.yaw -= turn * TURN * dt;
      this.dashT -= dt;
      this.dashCd -= dt;
      const target = this.dashT > 0 ? DASH : forward * RUN * (forward < 0 ? 0.55 : 1);
      this.speed = THREE.MathUtils.lerp(this.speed, target, 1 - Math.exp(-dt * 10));
      heroPos.x += Math.sin(this.yaw) * this.speed * dt;
      heroPos.z += Math.cos(this.yaw) * this.speed * dt;
      this.collide(heroPos, HERO_R);

      // bags
      for (const b of this.bags) {
        if (b.taken) continue;
        if (Math.hypot(b.mesh.position.x - heroPos.x, b.mesh.position.z - heroPos.z) < 0.9) {
          b.taken = true;
          b.mesh.visible = false;
          this.collected++;
          this.hud.stats(this.level + 1, this.collected, L.bags, this.lives, this.hero.outfit);
          if (this.collected === L.bags) {
            this.mall!.openGate();
            this.hud.toast("All bags! Run to CHECKOUT");
          }
        }
      }

      // Karens
      this.hurtT -= dt;
      for (const k of this.foes) {
        const kp = k.group.position;
        const to = new THREE.Vector3(heroPos.x - kp.x, 0, heroPos.z - kp.z);
        const dist = to.length();
        let v = 0;
        k.stun -= dt;
        if (k.stun > 0) {
          v = 0;
        } else if (dist < L.chase) {
          to.normalize();
          k.heading = Math.atan2(to.x, to.z);
          v = L.speed;
        } else {
          k.wanderT -= dt;
          if (k.wanderT <= 0) {
            const a = Math.random() * Math.PI * 2;
            k.wanderDir.set(Math.sin(a), 0, Math.cos(a));
            k.wanderT = 2 + Math.random() * 3;
          }
          k.heading = Math.atan2(k.wanderDir.x, k.wanderDir.z);
          v = L.speed * 0.4;
        }
        kp.x += Math.sin(k.heading) * v * dt;
        kp.z += Math.cos(k.heading) * v * dt;
        for (const o of this.foes) {
          if (o === k) continue;
          const dx = kp.x - o.group.position.x, dz = kp.z - o.group.position.z;
          const d = Math.hypot(dx, dz);
          if (d < FOE_R * 2 && d > 1e-4) {
            kp.x += (dx / d) * (FOE_R * 2 - d) * 0.5;
            kp.z += (dz / d) * (FOE_R * 2 - d) * 0.5;
          }
        }
        this.collide(kp, FOE_R);
        k.update(dt, v / 3);

        if (dist < HERO_R + FOE_R + 0.1 && this.hurtT <= 0 && k.stun <= 0) {
          if (this.dashT > 0) {
            k.stun = 2; // dashed through her
            this.hud.toast("Excuse me!");
          } else {
            this.lives--;
            this.hurtT = 1.5;
            k.stun = 1.2;
            heroPos.x -= to.x * 1.2;
            heroPos.z -= to.z * 1.2;
            this.collide(heroPos, HERO_R);
            this.hud.toast("A Karen wants your manager!");
            this.hud.stats(this.level + 1, this.collected, L.bags, this.lives, this.hero.outfit);
            if (this.lives <= 0) {
              this.state = "over";
              this.hud.over(this.level + 1);
            }
          }
        }
      }

      // checkout
      if (this.collected === L.bags && heroPos.z > L.length - 1 && Math.abs(heroPos.x) < 2.4) this.clearLevel();
    } else {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, 1 - Math.exp(-dt * 8));
      for (const k of this.foes) k.update(dt, 0);
    }

    this.hero.group.rotation.y = this.yaw;
    this.hero.pose(dt, Math.abs(this.speed) / RUN);
    this.hero.group.visible = this.hurtT <= 0 || Math.floor(t * 12) % 2 === 0;

    for (const b of this.bags) {
      b.mesh.rotation.y = t * 1.5;
      b.mesh.position.y = 0.15 + Math.sin(t * 3 + b.mesh.id) * 0.08;
    }

    this.updateCamera(dt);
    this.sun.position.set(heroPos.x + 4, 10, heroPos.z - 3);
    this.sun.target.position.copy(heroPos);
    this.renderer.render(this.scene, this.camera);
  }

  private clearLevel() {
    // turn her back toward the mall so the showcase camera has room in front
    this.yaw = Math.PI;
    this.showT = 0;
    const L = LEVELS[this.level];
    if (this.level + 1 >= LEVELS.length) {
      this.hero.setOutfit(CLOTHES.length);
      this.state = "win";
      this.hud.win();
    } else {
      this.hero.setOutfit(this.hero.outfit + 1);
      this.state = "clear";
      this.hud.clear(this.level + 1, Hero.pieceFor(this.hero.outfit)?.label);
    }
    this.hud.stats(this.level + 1, this.collected, L.bags, this.lives, this.hero.outfit);
  }

  private updateCamera(dt: number) {
    const p = this.hero.group.position;
    const shot = this.params.get("shot");
    // showcase: after a level (and for ?shot=front) the camera comes round to her face
    const front = shot === "front" || this.state === "clear" || this.state === "win" || this.state === "title";
    const side = shot === "side";
    this.showT += dt;
    let want: number;
    if (shot === "back") want = this.yaw + Math.PI;
    else if (side) want = this.yaw + Math.PI / 2;
    else if (front) want = this.yaw + (this.state === "clear" || this.state === "win" ? Math.sin(this.showT * 0.6) * 0.6 : 0.35);
    else want = this.yaw + Math.PI;
    this.camYaw += angleDiff(want, this.camYaw) * (1 - Math.exp(-dt * (shot ? 60 : 4)));
    const close = front || side || shot === "back";
    const dist = close ? 3.0 : 4.4;
    const height = close ? 1.35 : 2.4;
    this.camera.position.set(p.x + Math.sin(this.camYaw) * dist, height, p.z + Math.cos(this.camYaw) * dist);
    this.camera.lookAt(p.x, close ? 1.05 : 1.3, p.z);
  }
}

function angleDiff(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

const BAG_COLORS = [0xff6fa8, 0x9ad7ff, 0xffd166, 0xb78cff, 0x7ee0b5, 0xff8a5b];
function makeBag(i: number) {
  const g = new THREE.Group();
  const color = BAG_COLORS[i % BAG_COLORS.length];
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.18), new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.15 }));
  body.position.y = 0.25;
  body.castShadow = true;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  handle.position.y = 0.5;
  g.add(body, handle);
  return g;
}
