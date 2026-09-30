import "./style.css";
import { Game } from "./game/game";

// Surface runtime errors on screen (a phone has no console), so a bug report
// can be a screenshot. Tap to dismiss.
function report(msg: string) {
  let bar = document.querySelector<HTMLDivElement>(".errbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "errbar";
    bar.addEventListener("click", () => bar!.remove());
    document.body.appendChild(bar);
  }
  bar.textContent = `⚠ ${msg}`.slice(0, 300);
}
addEventListener("error", (e) => report(e.message || "script error"));
addEventListener("unhandledrejection", (e) => report(e.reason instanceof Error ? e.reason.message : String(e.reason)));

new Game(document.getElementById("app")!).start();
