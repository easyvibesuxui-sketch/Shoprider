// Loading screen: a Kling-made looping animation plus a real percentage, driven by
// the bytes downloaded for the three GLB models. The markup lives in index.html
// so it shows before this bundle has even arrived.

// Fallback sizes for when the server sends no Content-Length.
const EXPECTED: Record<string, number> = {
  "models/hero.glb": 2293656,
  "models/karen-easy.glb": 1793940,
  "models/karen-hard.glb": 926424,
};

const DOWNLOAD_SHARE = 0.9; // the rest is parsing + seating the clothes

export class Preloader {
  private el = document.getElementById("preloader");
  private num = document.getElementById("pl-num");
  private fill = document.getElementById("pl-fill");
  private note = document.getElementById("pl-note");
  private loaded = new Map<string, number>();
  private totals = new Map<string, number>(Object.entries(EXPECTED));
  private setup = 0;
  private shown = 0;
  private finished = false;
  private resolveDone?: () => void;

  constructor() {
    const tick = () => {
      // ease toward the real value so the counter rolls instead of jumping
      const target = this.target();
      this.shown += (target - this.shown) * 0.12;
      if (target - this.shown < 0.002) this.shown = target;
      this.render();
      if (!this.finished && target >= DOWNLOAD_SHARE - 1e-3) this.status("Dressing up…");
      if (this.finished && this.shown >= 0.999) this.hide();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // onProgress handler for one file
  track(url: string) {
    return (e: { loaded: number; total: number; lengthComputable: boolean }) => {
      if (e.lengthComputable && e.total > 0) this.totals.set(url, e.total);
      this.loaded.set(url, Math.min(e.loaded, this.totals.get(url) ?? e.loaded));
    };
  }

  status(text: string) {
    if (this.note) this.note.textContent = text;
  }

  // setup steps after the downloads (0..1)
  building(f: number) {
    this.setup = Math.max(this.setup, Math.min(1, f));
  }

  done(): Promise<void> {
    this.finished = true;
    this.setup = 1;
    for (const [k, v] of this.totals) this.loaded.set(k, v);
    return new Promise((r) => (this.resolveDone = r));
  }

  private target() {
    let got = 0, all = 0;
    for (const [k, total] of this.totals) {
      all += total;
      got += this.loaded.get(k) ?? 0;
    }
    const dl = all ? got / all : 0;
    return Math.min(1, dl * DOWNLOAD_SHARE + this.setup * (1 - DOWNLOAD_SHARE));
  }

  private render() {
    const pct = Math.floor(this.shown * 100);
    if (this.num) this.num.textContent = String(pct);
    if (this.fill) this.fill.style.transform = `scaleX(${this.shown})`;
  }

  // Loading failed for good: say so and offer a retry instead of hanging.
  fail(message: string) {
    this.finished = false;
    this.status("");
    if (!this.el || this.el.querySelector(".pl-error")) return;
    const box = document.createElement("div");
    box.className = "pl-error";
    box.innerHTML = `<p>Couldn't load the game.</p><small></small><button>Try again</button>`;
    box.querySelector("small")!.textContent = message;
    box.querySelector("button")!.addEventListener("click", () => location.reload());
    this.el.appendChild(box);
  }

  private hide() {
    this.render();
    this.el?.classList.add("out");
    setTimeout(() => {
      this.el?.remove();
      this.resolveDone?.();
    }, 450);
  }
}
