# Boy Explorer — M02.1 modeling reference v1

## Status and reference hierarchy
Supporting 2D sheet created; actual final Boy mesh NOT built yet.
1. User's original learnquest-target.png is the visual authority.
2. boy-turnaround-v1.png clarifies four views but is an AI-generated art draft.
3. Current khaki GLB is only a gameplay proxy and is not a modeling reference.

Never claim the sheet is an exported mesh or technically exact orthographic
projection. Perspective, subtle fabric and shape differences must be reconciled
in the 3D source. M02 is not complete until the real mesh is reviewed.

## Identity and wardrobe
- Stylized child, large expressive brown eyes, rounded cheeks, small nose.
- Asymmetrical swept dark-brown layered hair, preserve volume from all sides.
- Blue zip hoodie with hood down, orange zipper/drawstrings and pocket trim.
- Light undershirt; beige cuffed cargo trousers, side pockets and seam detail.
- Red/black/white sneakers with laces and visible sole construction.
- Navy backpack, orange straps/piping/zippers, small LQ badge on the back.
- Wrist accessory stays on anatomical LEFT wrist. Do not mirror the model to
  produce the opposite profile or a right dodge.

## Pose and modeling conventions
- Same neutral relaxed A-pose in front/back; side drawings show the silhouette.
- Front looks toward viewer. Left profile shows anatomical left side, facing
  image-right. Right profile shows anatomical right side, facing image-left.
- Use crown, chin, shoulder, waist, knee and sole levels as comparison guides.
- Start around 4–4.5 head heights as a working proportion, then refine by original
  reference overlays; this is a proposal, not a measured dimension from a mesh.
- Set world up +Y, forward +Z and sole origin y=0. Runner owns movement and yaw.
- Use one actual 3D model to generate future four-view renders; do not rely on
  independently generated 2D views to establish perfect geometric consistency.

## Mesh construction sequence (M02.2 onward)
1. Establish head/body silhouette in neutral clay; orthographic front/side/back.
2. Sculpt face/ears/nose and separate eyes; match face before clothing details.
3. Build hair volumes with a coherent silhouette; avoid disconnected primitive
   spikes as final art.
4. Build hoodie, trousers, shoes, straps and backpack with appropriate thickness.
5. Retopologize for elbows, knees, shoulders, neck and hands; avoid intersections.
6. UV unwrap and texture with consistent palette/roughness; bake detail as needed.
7. Export real inspection GLB; retain editable source. Review the rendered mesh
   alongside the original concept before proceeding to M03 skinning/animation.

## Acceptance before M02 complete
- Correct identity and outfit, not merely recolored khaki geometry.
- Front, side and back are renders of one consistent mesh.
- Close-up face, profile nose/chin, hair, hands, backpack and shoes reviewed.
- No clipping, broken normals, missing back surfaces or mirrored accessories.
- Mobile geometry/material budgets recorded; final performance measured later.
- Girl must receive her own identity/modeling pass, not a recolored Boy face.

## Generation provenance
Mode: built-in ImageGen, stylized-concept, reference-guided.
Input: learnquest-target.png. Output: boy-turnaround-v1.png.
Prompt specification: four equal-scale full-body views of the original Boy in
neutral A-pose on grey, preserving identity and blue/orange/beige/red wardrobe;
labels FRONT, LEFT PROFILE, BACK, RIGHT PROFILE and alignment guides; explicitly
label as art reference, not 3D model. No gameplay environment or other characters.
Correction prompt: redraw only the fourth view facing image-left, backpack behind
to image-right, with left-wrist accessory on the far side; preserve other views.
Generated guide lines are illustrative, not a dimensional engineering drawing.
