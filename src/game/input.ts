// Keyboard plus a touch stick (left half of the screen) and tap-to-dash (right half).
export class Input {
  private keys = new Set<string>();
  private stick = { id: -1, x0: 0, y0: 0, x: 0, y: 0 };
  onAction?: () => void;

  constructor(el: HTMLElement) {
    addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!e.repeat) this.onAction?.();
      }
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());

    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      if (e.clientX < innerWidth / 2 && this.stick.id < 0) {
        this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      } else {
        this.onAction?.();
      }
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.x = e.clientX;
      this.stick.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.stick.id) this.stick.id = -1;
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  // turn: +1 right, forward: +1 ahead
  axes() {
    const k = (c: string) => (this.keys.has(c) ? 1 : 0);
    let turn = k("KeyD") + k("ArrowRight") - k("KeyA") - k("ArrowLeft");
    let forward = k("KeyW") + k("ArrowUp") - k("KeyS") - k("ArrowDown");
    if (this.stick.id >= 0) {
      const dx = (this.stick.x - this.stick.x0) / 60;
      const dy = (this.stick.y - this.stick.y0) / 60;
      turn = Math.max(-1, Math.min(1, dx));
      forward = Math.max(-1, Math.min(1, -dy));
    }
    return { turn, forward };
  }
}
