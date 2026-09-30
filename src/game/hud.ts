import { CLOTHES } from "./clothes";
import { LEVELS } from "./levels";

export class Hud {
  private root = document.getElementById("hud")!;
  private stat = el("div", "stats");
  private card = el("div", "card");
  private toastEl = el("div", "toast");
  private toastTimer = 0;
  onAction?: () => void;

  constructor() {
    this.root.append(this.stat, this.card, this.toastEl);
    this.card.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).tagName === "BUTTON") this.onAction?.();
    });
  }

  loading() {
    this.show(`<h1>Boutique Raider</h1><p>Loading the mall…</p>`);
  }

  title(level: number) {
    this.show(`
      <h1>Boutique Raider</h1>
      <p>Grab every shopping bag, then reach <b>CHECKOUT</b>. Don't let a Karen catch you.</p>
      <p class="keys">W/↑ run · A/D turn · Space dash<br>Touch: left thumb steers, tap right to dash</p>
      <p>Every cleared level unlocks one piece of her outfit.</p>
      <button>${level > 1 ? `Start level ${level}` : "Start"}</button>`);
  }

  play() {
    this.card.classList.remove("on");
  }

  clear(level: number, piece?: string) {
    this.show(`
      <h1>Level ${level} cleared</h1>
      ${piece ? `<p class="unlock">New outfit piece: <b>${piece}</b></p>` : ""}
      <button>Level ${level + 1}</button>`);
  }

  over(level: number) {
    this.show(`<h1>Caught!</h1><p>The Karens got you on level ${level}.</p><button>Try again</button>`);
  }

  win() {
    this.show(`<h1>Mall conquered</h1><p>All ${LEVELS.length} levels cleared, full outfit unlocked.</p><button>Play again</button>`);
  }

  stats(level: number, got: number, need: number, lives: number, outfit: number) {
    const pieces = CLOTHES.map((c) => `<span class="${outfit >= c.unlock ? "on" : ""}">${c.label}</span>`).join("");
    this.stat.innerHTML = `
      <div>Level <b>${level}</b>/${LEVELS.length}</div>
      <div>Bags <b>${got}</b>/${need}</div>
      <div class="lives">${"♥".repeat(Math.max(0, lives))}<i>${"♥".repeat(Math.max(0, 3 - lives))}</i></div>
      <div class="outfit">${pieces}</div>`;
  }

  toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add("on");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove("on"), 1800);
  }

  private show(html: string) {
    this.card.innerHTML = html;
    this.card.classList.add("on");
  }
}

function el(tag: string, cls: string) {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}
