# LearnQuest Jungle Run — Local Structured Implementation

This upgrade is deliberately **local-first**. It does not require GitHub, Railway, the production API, or a database to inspect the new jungle path.

## What is implemented now

- Real Meshy GLB path included at `frontend/assets/jungle/path/Path_Straight_01.glb`.
- Exact track dimensions: **6.6m W × 0.4m H × 12m L**.
- Three lane centers: **-2.2 / 0 / +2.2m**.
- Endless tile recycling system in `frontend/js/game/jungle/endless-path.js`.
- GLB caching / clone support in `gltf-cache.js`.
- Future prop loader in `prop-library.js`.
- Local asset manifest and reserved names for trees, bushes, plants, torch, rock, collectible and math gate.
- Standalone local preview page: `jungle-local-preview.html`.
- Existing `jungle-game.html` now uses the real modular path with a procedural fallback if the GLB is unavailable.

## Run only the local jungle lab

From the `learnquest` folder:

```bash
npm install
npm run jungle:local
```

Then open:

```text
http://localhost:5177/jungle-local-preview.html
```

The local lab does **not** initialize the database and does **not** require login.

## Next asset drop-in workflow

Create/approve one asset at a time in Meshy, download GLB, then copy it into the reserved slot:

1. `foliage/Jungle_Tree_01.glb`
2. `foliage/Jungle_Bush_01.glb`
3. `foliage/Jungle_Plant_01.glb`
4. `props/Jungle_Torch_01.glb`
5. `obstacles/Jungle_Rock_01.glb`
6. `collectibles/Question_Coin_01.glb`
7. `gates/Math_Gate_01.glb`

After the file is ready, set its `enabled` flag to `true` in `frontend/js/game/jungle/jungle-config.js`. The prop library will load it and preserve procedural fallback when an optional file is missing.

## Planned path variants (structure already reserved)

- `Path_Straight_02.glb`
- `Path_Straight_03.glb`
- `Path_Left_90_01.glb`
- `Path_Right_90_01.glb`
- `Path_Broken_01.glb`
- `Path_Question_Zone_01.glb`

Do not create one giant jungle GLB. Keep the environment modular so tiles and props can be recycled, randomized and optimized for web/mobile.

## Performance rules

- Repeated path: about 20K–35K triangles is acceptable for the current test asset.
- Repeated tree/bush/rock: aim for roughly 5K–20K triangles per asset where possible.
- Use embedded GLB textures for testing; texture compression can be done after visuals are approved.
- Keep collision simple and separate from render geometry.
- World movement remains controlled by the runner; avoid baked root movement in environment assets.
