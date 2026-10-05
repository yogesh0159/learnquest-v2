import * as THREE from 'three';

// Original, lightweight geometry inspired by the user's B/G01 and B/G02 references.
// Articulated node rig: deliberately not advertised as reconstructed/scanned anatomy.
export function buildReferenceExplorer({ gender = 'boy' } = {}) {
  const girl = gender === 'girl';
  const root = new THREE.Group(); root.name = girl ? 'GirlExplorer' : 'BoyExplorer';
  const mat = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
  const m = { skin: mat(0xe8ae87), blush: mat(0xd69073), shirt: mat(0xc9c19b), trim: mat(0xa49d78),
    shorts: mat(girl ? 0x8c8861 : 0x66734e), leather: mat(girl ? 0x686b44 : 0x6a4129), darkLeather: mat(0x473326),
    sole: mat(0x302e27), soleEdge: mat(0xbca87f), sock: mat(0xc8c4ac), scarf: mat(0xd96822),
    hair: mat(girl ? 0x8a4825 : 0x57321d), hairLight: mat(girl ? 0xa96132 : 0x704323),
    white: mat(0xfff5e2,.48), iris: mat(0x754922,.42), pupil: mat(0x211914,.32), buckle: mat(0xb0aaa0,.36,.65), green:mat(0x78958a) };
  let id = 0;
  function mesh(parent, geo, material, pos, scale, name) {
    const o = new THREE.Mesh(geo, material); o.name = name || `detail_${id++}`;
    if(pos)o.position.set(...pos); if(scale)o.scale.set(...scale);
    o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  const sph = (p, ma, pos, sc, name) => mesh(p,new THREE.SphereGeometry(1,16,12),ma,pos,sc,name);
  const box = (p,ma,pos,sc,name) => mesh(p,new THREE.BoxGeometry(1,1,1),ma,pos,sc,name);
  const capsule = (p,ma,pos,r,len,name) => mesh(p,new THREE.CapsuleGeometry(r,len,4,10),ma,pos,null,name);
  function joint(parent,name,pos){ const j=new THREE.Group(); j.name=name; j.position.set(...pos); parent.add(j); return j; }
  function tube(parent,material,points,r=.018){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),12,r,5,false),material);}
  function buckle(parent,x,y,z,w=.09,h=.1){
    box(parent,m.buckle,[x-w/2,y,z],[.015,h,.015]);box(parent,m.buckle,[x+w/2,y,z],[.015,h,.015]);
    box(parent,m.buckle,[x,y-h/2,z],[w,.015,.015]);box(parent,m.buckle,[x,y+h/2,z],[w,.015,.015]);
  }
  const hips=joint(root,'Hips',[0,1.1,0]);
  sph(hips,m.shorts,[0,0,0],[.31,.19,.20],'Pelvis');
  const chest=joint(hips,'Chest',[0,.16,0]);
  sph(chest,m.shirt,[0,.29,0],[girl?.31:.34,.43,.22],'Shirt');
  box(chest,m.trim,[0,.30,.217],[.035,.55,.016]);
  for(let i=0;i<4;i++)sph(chest,m.darkLeather,[0,.09+i*.13,.232],[.018,.018,.008]);
  for(const side of [-1,1]){
    box(chest,m.shirt,[side*.17,.30,.206],[.19,.18,.032]);
    const flap=box(chest,m.trim,[side*.17,.40,.227],[.2,.05,.025]);flap.rotation.z=side*.06;
    sph(chest,m.darkLeather,[side*.17,.385,.246],[.015,.015,.009]);
    const collar=box(chest,m.shirt,[side*.095,.62,.14],[.14,.20,.035]); collar.rotation.z=side*.43;collar.rotation.x=-.3;
  }
  capsule(chest,m.skin,[0,.66,0],.105,.15,'Neck');
  box(hips,m.darkLeather,[0,.04,.195],[.57,.10,.035],'Belt');buckle(hips,0,.045,.227,.13,.09);
  for(const side of [-1,1]){
    sph(hips,m.leather,[side*.335,-.01,0],[.083,.14,.12],'BeltPouch'+side);
    box(hips,m.darkLeather,[side*.34,.035,.09],[.12,.04,.025]);
  }
  const head=joint(chest,'Head',[0,.97,0]);
  sph(head,m.skin,[0,0,0],[.365,.415,.32],'Face');
  sph(head,m.skin,[0,-.18,.015],[.235,.17,.22],'Jaw');
  for(const side of [-1,1]){
    sph(head,m.skin,[side*.36,-.01,0],[.075,.125,.07],'Ear'+side);
    sph(head,m.blush,[side*.39,-.01,.037],[.036,.07,.019]);
    sph(head,m.white,[side*.137,.03,.28],[.103,.115,.043]);
    sph(head,m.iris,[side*.137,.026,.320],[.061,.078,.017]);
    sph(head,m.pupil,[side*.137,.027,.335],[.032,.054,.008]);
    sph(head,m.white,[side*.119,.061,.344],[.017,.021,.006]);
    tube(head,m.hair,[[side*.067,.17,.29],[side*.139,.188,.295],[side*.217,.153,.27]],.018);
    sph(head,m.blush,[side*.232,-.1,.25],[.055,.028,.006]);
    if(girl)for(let k=0;k<3;k++)tube(head,m.hair,[[side*(.204+k*.005),.07+k*.012,.303],[side*(.235+k*.008),.084+k*.021,.305]],.008);
  }
  sph(head,m.skin,[0,-.065,.323],[.052,.06,.063],'Nose');
  tube(head,m.darkLeather,[[-.108,-.182,.293],[0,-.203,.32],[.108,-.182,.293]],.009);
  mesh(head,new THREE.SphereGeometry(.375,18,10,0,Math.PI*2,0,Math.PI*.40),m.hair,[0,.06,-.018],[1,1.07,1]);
  mesh(head,new THREE.SphereGeometry(.374,18,12,Math.PI,Math.PI,0,Math.PI*.80),m.hair,[0,.015,-.012],[1,1.02,1]);
  // Swept locks, not spikes; asymmetric hair stays fixed when dodging.
  for(let i=0;i<5;i++){
    const lock=sph(head,i%2?m.hair:m.hairLight,[-.22+i*.10,.32+Math.sin(i*.6)*.10,.13],[.11,.23,.105],'HairLock'+i);
    lock.rotation.z=-.85+i*.08; lock.rotation.x=-.38;
  }
  const hair=joint(head,'HairTail',[0,.17,-.24]);
  if(girl){
    sph(hair,m.green,[0,0,-.04],[.12,.085,.095],'HairTie');
    for(let i=0;i<4;i++)sph(hair,i%2?m.hair:m.hairLight,[(i-1.5)*.055,-.21,-.12],[.10,.32,.115],'Ponytail'+i);
    for(const side of [-1,1])sph(head,m.hair,[side*.31,-.10,-.06],[.056,.23,.08]);
  }
  const scarf=joint(chest,'Scarf',[0,.53,.24]);
  if(!girl){
    tube(chest,m.scarf,[[-.13,.67,.04],[-.14,.60,.19],[0,.51,.27],[.14,.60,.19],[.13,.67,.04]],.039);
    sph(scarf,m.scarf,[0,0,0],[.06,.055,.043]);
    for(const side of [-1,1]){const end=sph(scarf,m.scarf,[side*.034,-.14,.015],[.036,.15,.025]);end.rotation.z=-side*.2;}
  }
  // Backpack and bedroll are geometry, including fixed side compass (never mirror).
  const pack=joint(chest,'Backpack',[0,.30,-.30]);
  sph(pack,m.leather,[0,0,-.09],[.29,.36,.15],'BackpackBody');
  box(pack,m.leather,[0,.19,-.207],[.52,.15,.075],'BackpackFlap');
  sph(pack,m.leather,[0,-.16,-.23],[.21,.14,.07],'BackPocket');
  for(const side of [-1,1]){
    box(pack,m.darkLeather,[side*.15,0,-.254],[.045,.48,.025]);buckle(pack,side*.15,.05,-.278,.06,.07);
    tube(chest,m.leather,[[side*.23,.65,-.18],[side*.27,.65,.03],[side*.25,.37,.24],[side*.25,.0,.14]],.035);
    buckle(chest,side*.25,.33,.281,.055,.07);
  }
  const roll=mesh(pack,new THREE.CylinderGeometry(.095,.095,.65,14),m.shirt,[0,.34,-.045]);roll.rotation.z=Math.PI/2;
  for(const side of [-1,1]){
    const seam=mesh(pack,new THREE.TorusGeometry(.073,.009,5,16),m.trim,[side*.328,.34,-.045]);seam.rotation.y=Math.PI/2;
  }
  const compass=mesh(pack,new THREE.CylinderGeometry(.065,.065,.025,16),m.buckle,[.32,-.13,-.12]);compass.rotation.z=Math.PI/2;
  const arms=[], elbows=[],legs=[],knees=[];
  for(const side of [-1,1]){
    const suffix=side===-1?'L':'R';
    const arm=joint(chest,'UpperArm'+suffix,[side*.36,.50,0]); arms.push(arm);
    const sleeve=capsule(arm,m.shirt,[0,-.115,0],.114,.18);sleeve.scale.z=.88;
    mesh(arm,new THREE.CylinderGeometry(.112,.115,.055,12),m.trim,[0,-.23,0]);
    capsule(arm,m.skin,[0,-.285,0],.073,.09);
    const elbow=joint(arm,'Forearm'+suffix,[0,-.34,0]);elbows.push(elbow);
    capsule(elbow,m.skin,[0,-.13,0],.066,.19);
    sph(elbow,m.skin,[0,-.285,.013],[.076,.10,.055],'Hand'+suffix);
    sph(elbow,m.skin,[-side*.065,-.257,.04],[.032,.059,.032]);
    if(side===1){capsule(elbow,m.darkLeather,[0,-.22,0],.069,.018,'WatchBand');box(elbow,m.buckle,[.066,-.22,.01],[.025,.06,.065]);}
    const leg=joint(hips,'Thigh'+suffix,[side*.17,-.05,0]);legs.push(leg);
    const shorts=capsule(leg,m.shorts,[0,-.18,0],.142,.26);shorts.scale.z=.94;
    mesh(leg,new THREE.CylinderGeometry(.14,.144,.055,12),m.trim,[0,-.34,0]);
    box(leg,m.shorts,[side*.13,-.20,.03],[.035,.17,.18]);
    capsule(leg,m.skin,[0,-.405,0],.088,.08);
    const knee=joint(leg,'Shin'+suffix,[0,-.45,0]);knees.push(knee);
    capsule(knee,m.skin,[0,-.13,0],.078,.17);
    mesh(knee,new THREE.CylinderGeometry(.091,.083,.15,12),m.sock,[0,-.275,0]);
    sph(knee,m.darkLeather,[0,-.405,.085],[.125,.14,.205],'Boot'+suffix);
    sph(knee,m.soleEdge,[0,-.485,.096],[.134,.052,.224]);
    box(knee,m.sole,[0,-.51,.09],[.26,.045,.39]);
    for(let k=0;k<3;k++)tube(knee,girl?m.soleEdge:m.scarf,[[-.075,-.35-k*.024,.16+k*.026],[.075,-.35-k*.024,.16+k*.026]],.008);
  }
  const rig={hips,chest,head,hair,scarf,pack,arms,elbows,legs,knees};
  root.userData.referenceExplorer=true;
  root.userData.assetVersion='reference-v1';
  // Non-enumerable avoids exporting circular Three.js objects as glTF extras.
  Object.defineProperty(root.userData,'referenceRig',{value:rig});
  poseReferenceExplorer(root,'idle',0);
  return root;
}

export const REFERENCE_STATES = Object.freeze({Idle:2,Run:.72,Sprint:.56,Jump:.8,Land:.24,Slide:.8,Dodge_Left:.55,Dodge_Right:.55,Hit:.55,Fall:1.1,Victory:2,Turn_Left:.6,Turn_Right:.6,Gesture:1.6});
const stateName = s => ({Dodge_Left:'dodgeLeft',Dodge_Right:'dodgeRight',Turn_Left:'turnLeft',Turn_Right:'turnRight'}[s] || s.toLowerCase());
export function poseReferenceExplorer(root,state,time,{speed=1,lateral=0}={}){
  const r=root?.userData?.referenceRig; if(!r)return;
  const s=stateName(state), t=Math.max(0,time), run=['run','sprint','dodgeLeft','dodgeRight','turnLeft','turnRight'].includes(s);
  for(const j of [r.hips,r.chest,r.head,r.hair,r.scarf,r.pack,...r.arms,...r.elbows,...r.legs,...r.knees])j.rotation.set(0,0,0);
  r.hips.position.set(0,1.1,0);
  r.arms[0].rotation.z=-.07;r.arms[1].rotation.z=.07;
  const phase=t*Math.PI*2/(s==='sprint'?.56:.72)*speed, a=Math.sin(phase), b=Math.cos(phase);
  if(run){
    r.hips.position.y+=.025*(1-Math.cos(phase*2));r.chest.rotation.x=.08;r.chest.rotation.y=a*.07;
    r.arms[0].rotation.x=a*.65;r.arms[1].rotation.x=-a*.65;
    r.elbows[0].rotation.x=-.7-.2*b;r.elbows[1].rotation.x=-.7+.2*b;
    r.legs[0].rotation.x=-a*.65;r.legs[1].rotation.x=a*.65;
    r.knees[0].rotation.x=Math.max(0,b)*.95;r.knees[1].rotation.x=Math.max(0,-b)*.95;
    r.hair.rotation.x=Math.sin(phase-.4)*.13;r.scarf.rotation.x=-.15+Math.sin(phase)*.1;
    r.pack.rotation.x=Math.sin(phase*2)*.035;
  }else{r.chest.scale.y=1+Math.sin(t*Math.PI)*.008;r.head.rotation.y=Math.sin(t*Math.PI)*.025;}
  if(run)r.chest.scale.y=1;
  if(s==='jump'){
    // Translation remains owned by game physics; clip is a tuck pose only.
    const p=Math.sin(Math.min(1,t/.8)*Math.PI);
    r.legs[0].rotation.x=-.55*p;r.legs[1].rotation.x=-.25*p;r.knees.forEach(j=>j.rotation.x=.8*p);
    r.arms.forEach(j=>j.rotation.x=-1.0*p);r.elbows.forEach(j=>j.rotation.x=-.5*p);
  }
  if(s==='land'){const p=Math.sin(Math.min(1,t/.24)*Math.PI);r.hips.position.y-=.16*p;r.legs.forEach(j=>j.rotation.x=-.4*p);r.knees.forEach(j=>j.rotation.x=.75*p);}
  if(s==='slide'){
    r.hips.position.y=.50;r.hips.rotation.x=-.35;
    r.legs[0].rotation.x=-1.35;r.legs[1].rotation.x=-1.15;r.knees[0].rotation.x=.25;r.knees[1].rotation.x=.4;
    r.arms.forEach(j=>j.rotation.x=.5);r.elbows.forEach(j=>j.rotation.x=-.4);
  }
  if(s==='dodgeLeft'||s==='dodgeRight')r.hips.rotation.z=(s==='dodgeLeft'?1:-1)*.23*Math.sin(Math.min(1,t/.55)*Math.PI);
  if(s==='turnLeft'||s==='turnRight')r.chest.rotation.y=(s==='turnLeft'?1:-1)*.45*Math.sin(Math.min(1,t/.6)*Math.PI);
  if(s==='hit'){const p=Math.sin(Math.min(1,t/.55)*Math.PI);r.chest.rotation.x=-.3*p;r.head.rotation.x=.2*p;r.arms.forEach(j=>j.rotation.x=-.6*p);}
  if(s==='fall'){const p=Math.min(1,t/.8);r.hips.rotation.x=-1.4*p;r.hips.position.y-=.82*p;r.arms.forEach(j=>j.rotation.x=-.8*p);r.knees.forEach(j=>j.rotation.x=.25*p);}
  if(s==='victory'){const p=Math.min(1,t/.3);r.arms[0].rotation.z=-2.5*p;r.arms[1].rotation.z=2.5*p;r.elbows.forEach(j=>j.rotation.x=-.4);r.hips.position.y+=Math.sin(t*Math.PI*4)**2*.08;r.head.rotation.z=Math.sin(t*4)*.08;}
  if(s==='gesture'){r.arms[1].rotation.z=1.25;r.elbows[1].rotation.x=-1.25;r.elbows[1].rotation.z=Math.sin(t*10)*.18;}
  r.chest.rotation.z-=THREE.MathUtils.clamp(lateral,-1,1)*.08;
}

export function createReferenceClips(root){
 const rig=root.userData.referenceRig;
 const nodes=[rig.hips,rig.chest,rig.head,rig.hair,rig.scarf,rig.pack,...rig.arms,...rig.elbows,...rig.legs,...rig.knees];
 return Object.entries(REFERENCE_STATES).map(([name,duration])=>{
   const times=[], values=nodes.map(()=>({p:[],q:[],s:[]})); const frames=Math.round(duration*30);
   for(let i=0;i<=frames;i++){
     const t=duration*i/frames; times.push(t);poseReferenceExplorer(root,name,t);
     nodes.forEach((n,j)=>{values[j].p.push(...n.position.toArray());values[j].q.push(...n.quaternion.toArray());values[j].s.push(...n.scale.toArray());});
   }
   const tracks=[];
   nodes.forEach((n,j)=>{
     tracks.push(new THREE.VectorKeyframeTrack(`${n.name}.position`,times,values[j].p));
     tracks.push(new THREE.QuaternionKeyframeTrack(`${n.name}.quaternion`,times,values[j].q));
     tracks.push(new THREE.VectorKeyframeTrack(`${n.name}.scale`,times,values[j].s));
   });
   poseReferenceExplorer(root,'idle',0);
   return new THREE.AnimationClip(name,duration,tracks).optimize();
 });
}
