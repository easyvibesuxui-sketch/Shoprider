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

| Mesh | Label | Unlock | Delta found (m) |
|---|---|---|---|
| `Object_35` | Leotard | 0 (level 1) | (-0.89, 0, 0) |
| `Object_15` | Pants (torn thigh-highs) | 1 | (0, -0.03, 0.45) |
| `Object_21` | Belt | 2 | (0.75, -0.03, 0) |
| `Object_37` | Collar | 3 | (0.38, -0.07, 0.04) |
| `Object_19` | Gloves (`lockX`) | 4 | (0, 0.14, 0) |
| `Object_13` | Boots | 5 | (0, 0.23, -0.05) |

Level N starts with outfit N-1. Clearing a level adds one piece, and the win screen shows all six. Cloth materials use `polygonOffset` so they win depth ties with the skin.

## Still true, do not repeat

- `mesh.position` on a `SkinnedMesh` does nothing useful. `geometry.translate` is in the wrong space.
- Never call `calculateInverses()` + `bind()` on the hero or the Karens.
- `parentQ.clone().invert()`: `invert()` mutates.
- `Box3.setFromObject` is wrong for skinned meshes. Use `skinnedPoints()`.

## Pose

`dropArms` aims `upperArm_L/R` at `(±0.18, -1, 0.04)`. `captureJoints` stores each animated bone's rest quaternion plus the hero side axis (+X) in that bone's parent frame. `pose()` sets `q = axisAngle(axis, a) * rest`, where positive `a` swings a limb backward. Knees bend only backward and elbows only forward.

Face is **+Z** and `group.rotation.y = yaw`. The chase cam sits behind her. The title and level-clear screens swing the camera round to her face.

## Karens

Both files are Mixamo rigs about 3.4 m tall in their own units. A wrapper group scales them to 1.72 m; the rig is never rebound.

- L1–L2 `easy` → `karen-easy.glb` (uploaded as `karen_easy_medium.glb`)
- L3–L4 `mid` → alternates between both files
- L5–L7 `hard` → `karen-hard.glb` (uploaded as `karen_medium_hard.glb`, the catwalk walk). It uses `KHR_materials_pbrSpecularGlossiness`, which current three.js ignores, so `foes.ts` registers a small plugin that maps the diffuse texture. Its built-in spotlights are removed.

`capoeira.glb` and `dancer_girl.glb` stay deleted.

## Debug URL params

`?level=1..7`, `?outfit=0..6`, `?shot=front|back|side` (fixed close camera, hides the card), `?play` (skip the title). `window.game` is exposed.
