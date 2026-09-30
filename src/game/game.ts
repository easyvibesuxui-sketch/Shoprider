import * as THREE from "three";
import { Hero } from "./hero";
import { Karen, preloadFoes } from "./foes";
import { HALF_W, Mall, mulberry } from "./mall";
import { LEVELS } from "./levels";
import { CLOTHES } from "./clothes";
import { Input } from "./input";
import { Hud } from "./hud";
import { playFinale } from "./finale";

type State = "loading" | "title" | "play" | "paused" | "clear" | "finale" | "over" | "win";

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
    this.hud.onPause = () => this.togglePause();
    this.hud.onRestart = () => this.restart();
    this.input.onAction = () => this.action();
    this.input.onPause = () => this.togglePause();
    // leaving the tab mid-run pauses instead of letting the Karens catch her
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "play") this.togglePause();
    });
  }

  async start() {
    this.hud.loading();
    await Promise.all([this.hero.load("models/hero.glb"), preloadFoes()]);
    const lv = Number(this.params.get("level"));
    this.level = Number.isFinite(lv) && lv >= 1 && lv <= LEVELS.length ? lv - 1 : 0;
    await this.buildLevel();
    const outfit = this.params.get("outfit");
    if (outfit !== null) this.hero.setOutfit(Number(outfit)); // debug override
    this.refreshStats();
    this.state = "title";
    this.hud.title(this.level + 1);
    this.hud.buttons(false);
    if (this.params.has("shot")) this.hud.play(); // clean frame for screenshots
    if (this.params.has("play")) this.action();
    if (this.params.has("finale")) this.finale();
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
      this.go();
    } else if (this.state === "paused") {
      this.togglePause();
    } else if (this.state === "clear") {
      this.level++;
      this.buildLevel().then(() => this.go());
    } else if (this.state === "over") {
      this.restart();
    } else if (this.state === "win") {
      this.level = 0;
      this.lives = 3;
      this.buildLevel().then(() => {
        this.state = "title";
        this.hud.title(1);
        this.hud.buttons(false);
      });
    } else if (this.state === "play") {
      this.dash();
    }
  }

  private go() {
    this.state = "play";
    this.input.clear();
    this.hud.play();
    this.hud.buttons(true);
  }

  private togglePause() {
    if (this.state === "play") {
      this.state = "paused";
      this.input.clear();
      this.hud.paused();
      this.hud.buttons(true, true);
    } else if (this.state === "paused") {
      this.go();
    }
  }

  // Restart the current level from scratch: full hearts, the level's own outfit.
  private restart() {
    if (this.state === "loading") return;
    this.lives = 3;
    this.buildLevel().then(() => this.go());
  }

  private refreshStats() {
    this.hud.stats(this.level + 1, this.collected, LEVELS[this.level].bags, this.lives, this.hero.outfit);
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
        k.heading = k.want = Math.PI;
        this.scene.add(k.group);
        return k;
      }),
    );

    this.yaw = 0;
    this.speed = 0;
    this.hurtT = 0;
    this.hero.group.position.set(0, 0, 0);
    this.hero.group.rotation.y = 0;
    this.camYaw = Math.PI;
    // level N wears the first N pieces of the file outfit
    this.hero.setOutfit(this.level);
    this.refreshStats();
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
          this.refreshStats();
          if (this.collected === L.bags) {
            this.mall!.openGate();
            this.hud.toast("All bags! Run to CHECKOUT");
          }
        }
      }

      // Karens
      this.hurtT -= dt;
      this.updateFoes(dt, true);

      // checkout
      if (this.collected === L.bags && heroPos.z > L.length - 1 && Math.abs(heroPos.x) < 2.4) this.clearLevel();
    } else if (this.state !== "paused") {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, 1 - Math.exp(-dt * 8));
      this.updateFoes(dt, false); // stroll around, no chasing
    }

    if (this.state === "paused") {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.hero.group.rotation.y = this.yaw;
    this.hero.pose(dt, this.speed / RUN);
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

  // Karen AI. Chase when she's close (only while playing), otherwise stroll.
  // Steering: seek the target, bend around kiosks, keep off the walls and each
  // other, and turn at a human rate instead of snapping.
  private updateFoes(dt: number, chase: boolean) {
    const L = LEVELS[this.level];
    const heroPos = this.hero.group.position;
    const desire = new THREE.Vector3();
    for (const k of this.foes) {
      const kp = k.group.position;
      const to = new THREE.Vector3(heroPos.x - kp.x, 0, heroPos.z - kp.z);
      const dist = to.length();
      k.stun -= dt;
      let base = 0;
      if (k.stun > 0) {
        base = 0;
      } else if (chase && dist < L.chase) {
        desire.copy(to).normalize();
        base = L.speed;
      } else {
        k.wanderT -= dt;
        if (k.wanderT <= 0) {
          // mostly along the corridor, which is where the room is
          const a = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.6;
          k.want = a;
          k.wanderT = 2.5 + Math.random() * 3;
        }
        desire.set(Math.sin(k.want), 0, Math.cos(k.want));
        base = 1.1;
      }

      if (base > 0) {
        // bend around blockers ahead: push away from the part of the blocker
        // that sits across her path
        for (const b of this.mall!.blockers) {
          const bx = b.x - kp.x, bz = b.z - kp.z;
          const len = Math.hypot(desire.x, desire.z) || 1;
          const ax = desire.x / len, az = desire.z / len;
          const ahead = bx * ax + bz * az;
          if (ahead <= 0 || ahead > b.r + 2.2) continue;
          let ox = bx - ahead * ax, oz = bz - ahead * az; // path -> blocker centre
          let off = Math.hypot(ox, oz);
          if (off > b.r + FOE_R + 0.3) continue;
          if (off < 1e-3) { ox = az; oz = -ax; off = 1; } // dead centre: pick a side
          const push = (1 - ahead / (b.r + 2.2)) * 1.8;
          desire.x -= (ox / off) * push;
          desire.z -= (oz / off) * push;
        }
        // keep off the side walls and the ends
        const edge = HALF_W - 1.4;
        if (kp.x > edge) desire.x -= (kp.x - edge) * 1.5;
        if (kp.x < -edge) desire.x += (-edge - kp.x) * 1.5;
        if (kp.z < 2) desire.z += 1;
        if (kp.z > L.length - 1) desire.z -= 1;
        // personal space
        for (const o of this.foes) {
          if (o === k) continue;
          const dx = kp.x - o.group.position.x, dz = kp.z - o.group.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 1.6 && d > 1e-4) {
            desire.x += (dx / d) * (1.6 - d);
            desire.z += (dz / d) * (1.6 - d);
          }
        }
        if (desire.lengthSq() > 1e-6) k.want = Math.atan2(desire.x, desire.z);
      }
      const aligned = k.turn(dt, chase ? 6 : 3);
      const v = base * (0.25 + 0.75 * aligned);
      const px = kp.x, pz = kp.z;
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
      const moved = Math.hypot(kp.x - px, kp.z - pz) / Math.max(dt, 1e-4);
      // wedged against something while strolling: pick a new direction
      k.stuckT = base > 0 && moved < v * 0.3 ? k.stuckT + dt : 0;
      if (k.stuckT > 0.4 && !(chase && dist < L.chase)) {
        k.wanderT = 0;
        k.want += Math.PI * (0.6 + Math.random() * 0.8);
        k.stuckT = 0;
      }
      k.update(dt, moved);

      if (!chase) continue;
      if (dist < HERO_R + FOE_R + 0.1 && this.hurtT <= 0 && k.stun <= 0) {
        if (this.dashT > 0) {
          k.stun = 2; // dashed past her
          this.hud.toast("Excuse me!");
        } else {
          this.lives--;
          this.hurtT = 1.5;
          k.stun = 1.2;
          to.normalize();
          heroPos.x += to.x * 1.2;
          heroPos.z += to.z * 1.2;
          this.collide(heroPos, HERO_R);
          this.hud.toast("A Karen wants your manager!");
          this.refreshStats();
          if (this.lives <= 0) {
            this.state = "over";
            this.hud.over(this.level + 1);
            this.hud.buttons(false);
          }
        }
      }
    }
  }

  // Last level cleared: the date cutscene, then the win screen.
  private finale() {
    this.state = "finale";
    this.hud.play();
    this.hud.buttons(false);
    this.input.clear();
    playFinale("video/finale.mp4").then(() => {
      this.state = "win";
      this.hud.win();
    });
  }

  private clearLevel() {
    // turn her back toward the mall so the showcase camera has room in front
    this.yaw = Math.PI;
    this.showT = 0;
    this.hud.buttons(false);
    if (this.level + 1 >= LEVELS.length) {
      this.hero.setOutfit(CLOTHES.length);
      this.finale();
    } else {
      // preview the piece the next level adds
      this.hero.setOutfit(this.level + 1);
      this.state = "clear";
      this.hud.clear(this.level + 1, Hero.pieceFor(this.level + 1)?.label);
    }
    this.refreshStats();
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
