import * as THREE from "three";

// Phones get a lighter renderer: no MSAA, a lower pixel-ratio cap, no shadow map
// (blob shadows instead) and the low-poly Karen body. ?q=low / ?q=high override.
const q = new URLSearchParams(location.search).get("q");
export const MOBILE =
  q === "low" || (q !== "high" && (matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)));

export const QUALITY = {
  antialias: !MOBILE,
  maxPixelRatio: MOBILE ? 1.5 : 2,
  minPixelRatio: MOBILE ? 0.75 : 1,
  shadows: !MOBILE,
  // karen-hard ships the same body twice (Body_Mid and Body_Low); draw only one
  karenBody: MOBILE ? "Body_Low" : "Body_Mid",
  // beyond this, tiny Karen parts (eyes, lashes, jewellery) are skipped
  detailDistance: MOBILE ? 9 : 14,
  // beyond this a Karen is lost in the fog anyway
  farDistance: 55,
};

// Soft round contact shadow: one shared texture, material and quad.
let blobTex: THREE.Texture | undefined;
let blobMat: THREE.MeshBasicMaterial | undefined;
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export function blobShadow(size: number) {
  if (!blobMat) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(0,0,0,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
    blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  }
  const m = new THREE.Mesh(blobGeo, blobMat);
  m.scale.set(size, 1, size * 0.8);
  m.position.y = 0.01;
  m.renderOrder = -1;
  return m;
}
