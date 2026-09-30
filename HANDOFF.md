# Boutique Raider — handoff

A mall runner built with Three.js, one hero GLB and two Karen GLBs. `./startup.sh` runs Vite on `:8080`. Vite hot-reloads source edits, so the dev server does not need a restart.

The player is Nick. He writes Georgian. He has rejected primitive "clothes" several times. Read this before touching `src/game/hero.ts` or `src/game/clothes.ts`.

## What he wants (done, verified by screenshot)

- She wears clothes that already exist **inside** `public/models/hero.glb`, one piece unlocked per cleared level.
- Arms hang down at rest and swing when she walks. The file has bones and **no** clips, so every pose is procedural.
- The code draws no spheres, boxes or ovals as clothing.

## Files

| File | Role |
|---|---|
| `src/game/clothes.ts` | `CLOTHES` table, `fitDelta` (finds where a piece belongs), `shiftSkinned` (moves it there) |
| `src/game/hero.ts` | load, `seatClothes` → `dropArms` → `captureJoints`, `pose()`, `setOutfit()` |
| `src/game/foes.ts` | Karen loading and scaling, spec-gloss material plugin |
| `src/game/game.ts` | loop, levels, bags, checkout, chase and showcase camera |
| `src/game/mall.ts`, `levels.ts`, `hud.ts`, `input.ts` | environment, tuning, UI, keys and touch |
| `scripts/*.mjs` | node checks over the GLBs (`node scripts/fit.mjs` prints each cloth box before and after the fit) |

## Clothes

All pieces are skinned to the **correct** body bones (checked: the top is on spine and breast bones, the pants on hip, knee and foot bones). They are only authored off the body. `fitDelta` does the following:

1. Anchor = centroid of the body (`Object_43`) vertices, weighted by how much each shares the piece's bone histogram.
2. Translation-only ICP onto the posed body vertices (trimmed mean, 25 iterations).
3. `shiftSkinned` applies the delta per vertex through the inverse blended skin matrix. This runs before `dropArms`, while the bones are still in the bind pose.

Order is smallest first ("minimal at the start, then more clothes"):

| Mesh | Label | Unlock | Delta found (m) |
|---|---|---|---|
| `Object_35` | Leotard | 0 (level 1) | (-0.89, 0, 0) |
| `Object_37` | Collar | 1 | (0.38, -0.07, 0.04) |
| `Object_19` | Gloves (`lockX`) | 2 | (0, 0.14, 0) |
| `Object_21` | Belt | 3 | (0.75, -0.03, 0) |
| `Object_13` | Boots | 4 | (0, 0.23, -0.05) |
| `Object_15` | Stockings (torn thigh-highs) | 5 | (0, -0.03, 0.45) |

`buildLevel` sets outfit = level index, so level N wears the first N pieces (levels 6 and 7 wear all six). Restarting a level keeps that level's outfit. The clear screen previews the next piece. Cloth materials use `polygonOffset` so they win depth ties with the skin.

## Still true, do not repeat

- `mesh.position` on a `SkinnedMesh` does nothing useful. `geometry.translate` is in the wrong space.
- Never call `calculateInverses()` + `bind()` on the hero or the Karens.
- `parentQ.clone().invert()`: `invert()` mutates.
- `Box3.setFromObject` is wrong for skinned meshes. Use `skinnedPoints()`.

## Pose

`dropArms` aims `upperArm_L/R` at `(±0.25, -1, 0.02)`, which keeps the hands clear of her hips. `captureJoints` stores each animated bone's rest quaternion plus the hero side axis (+X) in that bone's parent frame. `pose()` sets `q = axisAngle(axis, a) * rest`, where positive `a` swings a limb backward. Knees bend only backward and elbows only forward. When running, the upper arm swings ±0.42 rad (less going back than forward) and the elbow holds about 0.7 rad, so the forward hand reaches waist height (`node scripts/arms.mjs` prints the joint positions). Earlier versions swung the hand up to shoulder height.

Face is **+Z** and `group.rotation.y = yaw`. The chase cam sits behind her. The title and level-clear screens swing the camera round to her face.

## Karens

Both files are Mixamo rigs about 3.4 m tall in their own units. A wrapper group scales them to 1.72 m; the rig is never rebound.

- L1–L2 `easy` → `karen-easy.glb` (uploaded as `karen_easy_medium.glb`)
- L3–L4 `mid` → alternates between both files
- L5–L7 `hard` → `karen-hard.glb` (uploaded as `karen_medium_hard.glb`, the catwalk walk). It uses `KHR_materials_pbrSpecularGlossiness`, which current three.js ignores, so `foes.ts` registers a small plugin that maps the diffuse texture. Its built-in spotlights are removed.

`karen-easy`'s walk has root motion: the hips travel about 4.5 m over the 15 s clip and snap back on loop, which looked like Karens teleporting. `stripRootMotion` pins the hips' X/Z. Playback rate is movement speed ÷ the clip's own walk speed (`CLIP_SPEED`, measured by `scripts/karen-stride.mjs`), so the feet don't skate. A Karen that stands still freezes mid-stride.

AI (`Game.updateFoes`): chase inside `chase` range, otherwise stroll mostly along the corridor. She steers around kiosks, stays off walls and away from other Karens, turns at a limited rate, and picks a new direction when stuck. Karens stroll on the title and clear screens and freeze on pause.

`capoeira.glb` and `dancer_girl.glb` stay deleted.

## UI

All in-game text is English (Nick asked for it; he writes to us in Georgian). The title screen and the pause menu show the controls: keyboard rows on desktop, touch rows on a coarse pointer. The top-right ⏸ and ↻ buttons (and P/Esc) pause and restart the level. Switching tabs pauses the game. On touch, the left thumb stick draws a visible ring.

## Preloader

The markup and CSS are inline in `index.html`, so the loading screen paints before the game bundle arrives. `src/game/preloader.ts` computes the percentage from the GLB download bytes (`GLTFLoader` onProgress, Content-Length, with the known file sizes as fallback), which covers 0–90%. The last 10% is parsing, seating the clothes and the first render ("Dressing up…"). The shown number eases toward the real value, then the screen fades out.

The art is from Kling:
- `art/loader/key.png`: image-to-image (Nano Banana 2 via Kling) from `public/finale/hero-face.png`. She runs with shopping bags, wears a tracksuit, on the game's plum background.
- `art/loader/loop-raw.mp4`: `kling-video-v3_0`, 5 s, with the key image as both first and tail frame, so the clip loops seamlessly.
- `public/loader/loader.mp4`: that clip cropped square, 480 px, H.264 CRF 28, no audio, faststart, about 108 KB.
- `public/loader/loader.jpg`: the poster, shown until the video plays or if it can't.

## Finale

Clearing level 7 plays `public/video/finale.mp4` fullscreen (`src/game/finale.ts`), then the win screen. There is a Skip button, and if the browser blocks unmuted autoplay the clip plays muted with a "Tap for sound" button. A missing or undecodable clip goes straight to the win screen. Playwright's Chromium has no H.264, so in headless tests the clip always takes that fallback path.

The clip is a 10 s, 720p, multi-shot Kling generation (`kling-video-v3_0_omni`, with audio): she is on a restaurant date in an evening gown, a Karen barges in pointing and asking for the manager, the date leaves, and she facepalms. It uses two references: `public/finale/hero-face.png` (head and shoulders) and `public/finale/karen-ref.png`. Kling's moderation rejected the first attempt, which used a full-body leotard reference (credits refunded).

Plumbing, because this sandbox can reach neither kling.ai uploads nor the Kling CDN:
- References are passed to Kling as GitHub Pages URLs. `raw.githubusercontent.com` URLs got an HTTP 445 from Kling's firewall.
- Results are copied into the repo by the `fetch-finale` workflow ("Fetch Kling asset": manual dispatch, `url` plus `path` under `public/` or `art/`), because Kling URLs expire after 24 h. Its commit is made with `GITHUB_TOKEN`, so it does not trigger Pages. The next push, or a manual run of the Pages workflow, deploys it.

## Performance (phones)

`src/game/quality.ts` detects a phone (coarse pointer or mobile user agent; `?q=low` and `?q=high` force it). On a phone:
- no MSAA and no shadow map
- the pixel ratio is capped at 1.5, and `Game.adaptResolution` lowers it to 0.75 when fps drops below 45, raising it again above 58

Everywhere:
- Only the hero casts a real shadow, and only on desktop. Karens (and the hero on phones) get a shared blob-shadow quad.
- `karen-hard` contains the same body twice (`Body_Mid` and `Body_Low`, both drawn before). Now only one is drawn: Mid on desktop, Low on phones.
- Karens are frustum-culled with padded skinned bounding spheres. Parts under 400 vertices hide beyond `detailDistance`, and the whole Karen (plus her mixer) is skipped beyond 55 m.
- `Mall.mergeStatic` bakes the corridor into one mesh per material, with shop materials shared per shop name.
- Clothes seat deltas are hardcoded in `CLOTHES` (`node scripts/deltas.mjs` regenerates them). The ICP fit took about 2.5 s on desktop and far longer on phones.
- `renderer.compile` runs behind the preloader.

Measured on a 390×844 @3x mobile emulation, before → after: draw calls 312–416 → 91–115, triangles 375–555k → 175–207k, and a 780×1688 buffer → ≤585×1266. The hero (134k triangles) is now most of what's left.

## Loading robustness

- `public/models/*.glb` are compressed: WebP textures (q82) plus Draco geometry via `@gltf-transform/cli` (`gltf-transform webp`, then `draco --method edgebreaker`). Total size went from 25.4 MB to 5.0 MB. The uncompressed sources live in `art/models/`, and the node scripts read those, since Draco needs Workers. Re-run both steps when a source changes. The decoder is in `public/draco/`.
- `src/game/loader.ts` fetches each GLB by hand. A request that sends no bytes for 15 s is aborted, and every file gets up to 4 attempts, then `GLTFLoader.parseAsync`. A failed Karen template is not cached.
- If boot still fails, the preloader shows the error and a "Try again" button (`Preloader.fail`).
- On `webglcontextlost` (phones under memory pressure or after app switches), the game pauses and shows a Reload overlay.
- Uncaught errors and rejections show as a red bar at the bottom (tap to dismiss), so a phone bug report can be a screenshot.

## Debug URL params

`?level=1..7`, `?outfit=0..6`, `?shot=front|back|side` (fixed close camera, hides the card), `?play` (skip the title), `?finale` (play the ending now), `?q=low|high` (force phone or desktop quality). `window.game` is exposed.
