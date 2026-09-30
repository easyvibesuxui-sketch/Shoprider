// End-of-game cutscene: her date, ruined by a Karen. The clip was generated with
// Kling from renders of the game's own hero and Karen (public/finale/*-ref.png).
export function playFinale(src: string): Promise<void> {
  return new Promise((done) => {
    const wrap = document.createElement("div");
    wrap.className = "finale";
    wrap.innerHTML = `
      <video playsinline preload="auto"></video>
      <button class="skip">Skip ▶</button>
      <button class="sound">🔊 Tap for sound</button>`;
    const video = wrap.querySelector("video")!;
    const sound = wrap.querySelector(".sound") as HTMLButtonElement;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      video.pause();
      wrap.classList.add("out");
      setTimeout(() => wrap.remove(), 400);
      done();
    };
    video.src = src;
    video.addEventListener("ended", finish);
    video.addEventListener("error", finish); // no clip shipped: skip straight to the win screen
    wrap.querySelector(".skip")!.addEventListener("click", finish);
    sound.addEventListener("click", () => {
      video.muted = false;
      sound.remove();
    });
    document.body.appendChild(wrap);
    // With sound if the browser allows it; otherwise muted with a sound button.
    video.play().then(() => sound.remove()).catch(() => {
      video.muted = true;
      video.play().catch(finish);
      sound.classList.add("on");
    });
  });
}
