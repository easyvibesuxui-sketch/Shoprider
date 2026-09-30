import { CLOTHES } from "./clothes";
import { LEVELS } from "./levels";

const TOUCH = matchMedia("(pointer: coarse)").matches;

// Controls, shown on the title screen and in the pause menu.
const CONTROLS = `
  <div class="controls">
    <div class="row ${TOUCH ? "dim" : ""}">
      <div class="keys"><kbd>W</kbd><kbd>↑</kbd></div><span>Run forward</span>
      <div class="keys"><kbd>S</kbd><kbd>↓</kbd></div><span>Back up</span>
      <div class="keys"><kbd>A</kbd><kbd>D</kbd><kbd>←</kbd><kbd>→</kbd></div><span>Turn</span>
      <div class="keys"><kbd class="wide">Space</kbd></div><span>Dash</span>
      <div class="keys"><kbd>P</kbd><kbd>Esc</kbd></div><span>Pause</span>
    </div>
    <div class="row ${TOUCH ? "" : "dim"}">
      <div class="keys"><i class="pad">◎</i></div><span>Left half of the screen: drag your thumb to steer</span>
      <div class="keys"><i class="pad">●</i></div><span>Right half: tap to dash</span>
    </div>
  </div>
  <ul class="goal">
    <li>🛍️ Grab every shopping bag</li>
    <li>🟢 Then run through <b>CHECKOUT</b></li>
    <li>🙅‍♀️ Don't bump into a Karen (3 ♥). Dash to slip past her</li>
    <li>👗 Every level adds one piece to her outfit</li>
  </ul>`;

export class Hud {
  private root = document.getElementById("hud")!;
  private bar = el("div", "bar");
  private stat = el("div", "stats");
  private btns = el("div", "btns");
  private card = el("div", "card");
  private toastEl = el("div", "toast");
  private toastTimer = 0;
  onAction?: () => void;
  onPause?: () => void;
  onRestart?: () => void;

  constructor() {
    this.btns.innerHTML = `
      <button class="icon" data-do="pause" aria-label="Pause">⏸</button>
      <button class="icon" data-do="restart" aria-label="Restart level">↻</button>`;
    this.bar.append(this.stat, this.btns);
    this.root.append(this.bar, this.card, this.toastEl);
    this.root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      const act = b.dataset.do;
      if (act === "pause") this.onPause?.();
      else if (act === "restart") this.onRestart?.();
      else this.onAction?.();
    });
    this.buttons(false);
  }

  buttons(on: boolean, paused = false) {
    this.btns.classList.toggle("on", on);
    this.btns.querySelector('[data-do="pause"]')!.textContent = paused ? "▶" : "⏸";
  }

  loading() {
    this.show(`<h1>Boutique Raider</h1><p>Loading the mall…</p>`);
  }

  title(level: number) {
    this.show(`
      <h1>Boutique Raider</h1>
      <h2>How to play</h2>
      ${CONTROLS}
      <button>${level > 1 ? `Start level ${level}` : "Start"}</button>`, true);
  }

  paused() {
    this.show(`
      <h1>Paused</h1>
      ${CONTROLS}
      <div class="row-btns"><button>Resume</button><button class="alt" data-do="restart">Restart level</button></div>`, true);
  }

  play() {
    this.card.classList.remove("on", "big");
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

  private show(html: string, big = false) {
    this.card.innerHTML = html;
    this.card.classList.add("on");
    this.card.classList.toggle("big", big);
  }
}

function el(tag: string, cls: string) {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}
