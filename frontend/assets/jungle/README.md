# LearnQuest Jungle Asset Library

This folder is the local-first 3D environment pipeline. Keep Meshy exports in the exact slots below so later code changes are minimal.

## Ready now

- `path/Path_Straight_01.glb` — exact world dimensions **6.6 m wide × 0.4 m total height × 12 m long**.
- Lane centers: **X = -2.2, 0, +2.2 m**.
- The runtime treats **Z** as the forward/back track axis and **Y** as up.

## Next Meshy files

Use these exact names when each asset is approved:

- `foliage/Jungle_Tree_01.glb`
- `foliage/Jungle_Bush_01.glb`
- `foliage/Jungle_Plant_01.glb`
- `props/Jungle_Torch_01.glb`
- `obstacles/Jungle_Rock_01.glb`
- `collectibles/Question_Coin_01.glb`
- `gates/Math_Gate_01.glb`

Future track variants already have reserved names in `manifest.json`.

## Rules for Meshy environment assets

1. Keep the object centered and upright before export.
2. Use GLB with embedded textures.
3. Environment props do **not** need rigging.
4. Prefer 10K–30K triangles for repeated props; large hero props may use more if needed.
5. Do not bake world-space placement into the model; the runtime places every asset.
6. Test locally first using `npm run jungle:local`. Do not upload to GitHub until the local scene is accepted.
