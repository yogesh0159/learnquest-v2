# LearnQuest reference-inspired explorer characters

This folder ships `boy-explorer.glb` and `girl-explorer.glb`. No paid generator,
external model download, textures, or third-party account is needed at runtime.
Both models use original geometry built from the supplied LearnQuest character
reference package. These are simplified stylized interpretations, not exact
image-to-3D reconstructions or motion capture from the MP4 files.

## Reference details

- Boy: khaki shirt, olive cargo shorts, orange neckerchief, brown swept hair,
  brown backpack, bedroll, fixed side compass, belt pouches and hiking boots.
- Girl: khaki shirt and shorts, auburn ponytail, olive backpack, belt pouches
  and hiking boots.
- B14 is a mirrored motion reference ONLY. Dodge_Right animates joint rotations;
  it never mirrors the mesh, backpack, compass, watch, or material coordinates.
- The reference images/videos remain in the user's original ZIP. They are not
  loaded by the game and are not unnecessarily duplicated in the release.

## Rig and animation

These assets use an **articulated node rig**, not smooth skinned humanoid meshes.
They have separate upper arms/forearms and thighs/shins plus chest, head,
backpack, hair and scarf pivots. They support all current game states. Automatic
Mixamo humanoid retargeting is not promised for this node rig.

14 named clips: Idle, Run, Sprint, Jump, Land, Slide, Dodge_Left, Dodge_Right,
Hit, Fall, Victory, Turn_Left, Turn_Right, Gesture.

Jump is an in-place tuck pose. The runner owns jump height and collision physics;
the lab adds a preview hop. Run and sprint loop; one-shot actions clamp at the end.
Turn and gesture are lab previews; existing gameplay controls are preserved.
Characters face +Z in the asset. Both runners rotate the player toward -Z so the
camera sees the backpack. Character Lab opens with a front view.

## Rebuild

Use Node 24 and install project dependencies, then from the `learnquest` folder:

    node scripts/build-reference-characters.mjs

The source model and motion definitions are in
`frontend/js/game/reference-explorer.mjs`. The controller uses that same builder
as a fallback if a GLB cannot load. No API keys or AI service is involved.

## Preview and testing

Run `npm start`, open `/character-lab.html`, choose Boy or Girl, and try every
move. Front/back buttons and auto-rotation allow inspection of accessories.
Drag rotates; mouse wheel and two-finger pinch zoom. GLBs are fully self-contained.

`npm test` includes binary GLB parsing, clip-target binding, finite transforms,
positive dodge scales, and fallback pose reset checks. The character's gameplay
collider remains independent of its visual rig.
