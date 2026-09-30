import { CLOTHES } from "./clothes";
import { LEVELS } from "./levels";

const TOUCH = matchMedia("(pointer: coarse)").matches;

// Controls, shown on the title screen and in the pause menu.
const CONTROLS = `
  <div class="controls">
    <div class="row ${TOUCH ? "dim" : ""}">
      <div class="keys"><kbd>W</kbd><kbd>↑</kbd></div><span>წინ სირბილი</span>
      <div class="keys"><kbd>S</kbd><kbd>↓</kbd></div><span>უკან</span>
      <div class="keys"><kbd>A</kbd><kbd>D</kbd><kbd>←</kbd><kbd>→</kbd></div><span>მოტრიალება</span>
      <div class="keys"><kbd class="wide">Space</kbd></div><span>ნახტომი წინ (dash)</span>
      <div class="keys"><kbd>P</kbd><kbd>Esc</kbd></div><span>პაუზა</span>
    </div>
    <div class="row ${TOUCH ? "" : "dim"}">
      <div class="keys"><i class="pad">◎</i></div><span>ეკრანის მარცხენა ნახევარი: თითი გაასრიალე, მიმართულება</span>
      <div class="keys"><i class="pad">●</i></div><span>მარჯვენა ნახევარი: შეხება, ნახტომი (dash)</span>
    </div>
  </div>
  <ul class="goal">
    <li>🛍️ შეაგროვე ყველა ჩანთა</li>
    <li>🟢 მერე მიირბინე <b>CHECKOUT</b>-მდე</li>
    <li>🙅‍♀️ კარენს არ დაეჯახო (3 ♥). Dash-ით მის გვერდით გაძვრები</li>
    <li>👗 ყოველ დონეზე ჩაცმულობას ერთი ნივთი ემატება</li>
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
      <button class="icon" data-do="pause" aria-label="პაუზა">⏸</button>
      <button class="icon" data-do="restart" aria-label="თავიდან">↻</button>`;
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
    this.show(`<h1>Boutique Raider</h1><p>მოლი იტვირთება…</p>`);
  }

  title(level: number) {
    this.show(`
      <h1>Boutique Raider</h1>
      <h2>როგორ ვითამაშოთ</h2>
      ${CONTROLS}
      <button>${level > 1 ? `დაწყება, დონე ${level}` : "დაწყება"}</button>`, true);
  }

  paused() {
    this.show(`
      <h1>პაუზა</h1>
      ${CONTROLS}
      <div class="row-btns"><button>გაგრძელება</button><button class="alt" data-do="restart">დონე თავიდან</button></div>`, true);
  }

  play() {
    this.card.classList.remove("on", "big");
  }

  clear(level: number, piece?: string) {
    this.show(`
      <h1>დონე ${level} გავლილია</h1>
      ${piece ? `<p class="unlock">ახალი ტანსაცმელი: <b>${piece}</b></p>` : ""}
      <button>დონე ${level + 1}</button>`);
  }

  over(level: number) {
    this.show(`<h1>დაგიჭირეს!</h1><p>კარენებმა დონე ${level}-ზე დაგიჭირეს.</p><button>თავიდან ცდა</button>`);
  }

  win() {
    this.show(`<h1>მოლი დაპყრობილია</h1><p>${LEVELS.length}-ივე დონე გავლილია, სრული კოსტიუმი გახსნილია.</p><button>ხელახლა თამაში</button>`);
  }

  stats(level: number, got: number, need: number, lives: number, outfit: number) {
    const pieces = CLOTHES.map((c) => `<span class="${outfit >= c.unlock ? "on" : ""}">${c.label}</span>`).join("");
    this.stat.innerHTML = `
      <div>დონე <b>${level}</b>/${LEVELS.length}</div>
      <div>ჩანთები <b>${got}</b>/${need}</div>
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
