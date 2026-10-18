import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Para trocar o personagem depois, substitua o GLB e, se necessário,
// ajuste MODEL_FACE_OFFSET para corrigir a direção do rosto.
const CHARACTER_FILE = './tio-urso.glb';
const MODEL_FACE_OFFSET = 0; // 0 = personagem olha para +Z.
const PLAYER_SPEED = 3.2;
const RUN_SPEED = 6.2;
const LIMIT = 48;

const el = id => document.getElementById(id);
const mount = el('view');
let renderer, scene, camera, clock, player, characterModel;
let started = false, ready = false, ignorePortrait = false;
let xp = 0, talked = new Set(), toastUntil = 0;
let walking = false, runHeld = false, camYaw = Math.PI;
let introButton = el('start');
let citizenNodes = [];
let obstacles = [];
const pressedKeys = new Set();
let joyX = 0, joyY = 0;
const camPosWanted = new THREE.Vector3();
const playerPos = new THREE.Vector3(0,0,-13);
const targetPos = new THREE.Vector3();
const motion = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const mini = el('minimap');
const miniCtx = mini.getContext('2d');
let animationTime = 0;
let modelBaseY = 0;

try {
  const saved = JSON.parse(localStorage.getItem('tio-urso-patrulha-demo-v01') || '{}');
  xp = Math.max(0, Number(saved.xp) || 0);
  talked = new Set(Array.isArray(saved.talked) ? saved.talked : []);
} catch (e) { /* storage not available */ }
function persist() {
  try { localStorage.setItem('tio-urso-patrulha-demo-v01', JSON.stringify({ xp, talked: [...talked] })); } catch (e) { /* optional */ }
}
function updateHud(){
  const level = 1 + Math.floor(xp / 100);
  el('level').textContent = `NÍVEL ${level}`;
  el('xp-label').textContent = `${xp} XP`;
  el('xp-fill').style.width = `${xp % 100}%`;
  el('mission-count').textContent = `${Math.min(3,talked.size)}/3`;
  el('mission-status').textContent = talked.size >= 3 ? 'Concluída ✓' : 'Em andamento';
  el('interact').querySelector('small').textContent = 'FALAR';
}
updateHud();

function notify(message, duration = 2600) {
  el('toast').textContent = message;
  el('toast').classList.add('show');
  toastUntil = performance.now() + duration;
}
function standard(color, roughness=0.9){return new THREE.MeshStandardMaterial({color, roughness});}
function box(w,h,d,color,x,y,z){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), standard(color));
  mesh.position.set(x,y,z);scene.add(mesh);return mesh;
}
function road(x,z,w,d){box(w,.025,d,0x39444c,x,.025,z);}
function labelSprite(text, color='#ffffff', background='#122a43', scaleX=3.7, scaleY=.62){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=88;
  const c=canvas.getContext('2d');c.fillStyle=background;c.fillRect(0,0,512,88);
  c.fillStyle=color;c.font='bold 43px system-ui, Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,44);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));
  sprite.scale.set(scaleX,scaleY,1);return sprite;
}
function tree(x,z){
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.11,.15,1.15,7),standard(0x7e583b));trunk.position.set(x,.63,z);scene.add(trunk);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.7,0),standard(0x388259));crown.position.set(x,1.68,z);scene.add(crown);
}
function addBuilding(x,z,w,d,h,color,sign=''){
  box(w,h,d,color,x,h/2,z);
  box(w+.3,.22,d+.3,0xdbe3db,x,h+.1,z);
  // Fachadas com janelas voltadas para a avenida; apenas cenário ilustrativo.
  const windowMat=standard(0x83b4b9);
  for(let y=1.9;y<h-.4;y+=1.6){
    for(let dx=-w/2+1;dx<w/2-.2;dx+=1.35){
      const win=new THREE.Mesh(new THREE.PlaneGeometry(.74,.7),windowMat);
      win.position.set(x+dx,y,z+(z<0?d/2+.016:d/2+.016));scene.add(win);
    }
  }
  if(sign){const p=labelSprite(sign);p.position.set(x,Math.min(h-.6,2.45),z+d/2+.05);scene.add(p);}
  obstacles.push({x1:x-w/2-.45,x2:x+w/2+.45,z1:z-d/2-.45,z2:z+d/2+.45});
}
function makeCitizen(name, x,z,shirtColor,id) {
  const citizen = new THREE.Group();
  const skin = standard(0xb98e70); const shirt=standard(shirtColor);const pants=standard(0x313f50);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.23,.28,.72,9),shirt);body.position.y=1.12;citizen.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.23,12,10),skin);head.position.y=1.66;citizen.add(head);
  for(let s of [-1,1]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.10,.11,.73,8),pants);leg.position.set(s*.13,.38,0);citizen.add(leg);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(.085,.09,.62,8),skin);arm.position.set(s*.34,1.04,0);citizen.add(arm);
  }
  citizen.position.set(x,.1,z);scene.add(citizen);
  const flag=labelSprite(talked.has(id)?'✓ OBRIGADO!':'💬 CONVERSAR','#f8f7e9','#234e67',2.0,.42);
  flag.position.y=2.35;citizen.add(flag);
  citizenNodes.push({id,name,citizen,flag});
}
function fakeBear(){
  const group=new THREE.Group();
  const blue=standard(0x1b385d),brown=standard(0x955b32);
  let torso =new THREE.Mesh(new THREE.CapsuleGeometry(.38,.68,4,12),blue);torso.position.y=1.15;group.add(torso);
  let head=new THREE.Mesh(new THREE.SphereGeometry(.40,18,12),brown);head.position.y=1.85;group.add(head);
  for(let side of [-1,1]){
    let ear=new THREE.Mesh(new THREE.SphereGeometry(.13,12,10),brown);ear.position.set(side*.3,2.14,0);group.add(ear);
    let leg=new THREE.Mesh(new THREE.CapsuleGeometry(.17,.5,4,8),blue);leg.position.set(side*.2,.44,0);group.add(leg);
    let arm=new THREE.Mesh(new THREE.CapsuleGeometry(.15,.46,4,8),brown);arm.position.set(side*.49,1.22,0);group.add(arm);
  }
  return group;
}
function buildScene(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x91c8e1);scene.fog=new THREE.Fog(0x91c8e1,34,92);
  camera=new THREE.PerspectiveCamera(64,1,.1,180);
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  mount.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xe7f4ff,0x778062,2.15));
  const sun=new THREE.DirectionalLight(0xffefcd,2.4);sun.position.set(-12,25,-10);scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(125,125),standard(0x779b78));floor.rotation.x=-Math.PI/2;floor.position.y=-.018;scene.add(floor);
  road(0,0,7.8,111);road(0,13.5,111,7.5);road(0,-29,111,6.5);
  box(2.4,.05,111,0xc7c4b7,-5.1,.06,0);box(2.4,.05,111,0xc7c4b7,5.1,.06,0);
  // Centro de faixa da rua e marcações de pedestres.
  for(let z=-51;z<=52;z+=5)box(.13,.03,2.15,0xeae2a7,0,.055,z);
  for(let x=-3.6;x<=3.6;x+=1.03)box(.5,.026,1.45,0xe5ded1,x,.058,7.9);
  for(let i=-3;i<=3;i++)box(.12,.025,3.2,0xeae2a7,i*4,.05,13.5);
  for(let z=-44;z<=48;z+=14){
    if(Math.abs(z-13.5)<8||Math.abs(z+29)<7)continue;
    for(let side of [-1,1]){
      let x=side*(12.5+(Math.abs(z)%5)*.45);
      addBuilding(x,z,6.4,8.4,4.5+(Math.abs(z*13)%5),[0xd6bc9a,0xa5b9bf,0xe5cbad,0xb6a9aa][Math.abs(z)%4]);
    }
  }
  addBuilding(-12,-13,6.6,7.2,4.3,0x91a6bf,'CENTRAL OPERACIONAL');
  addBuilding(12,-13,6.7,7.2,6.2,0xe8d9b6,'PRAÇA / MATRIZ');
  for(let z=-48;z<49;z+=9){tree(-6.6,z+1);tree(6.6,z-1);}
  for(let i=0;i<10;i++){
    const side = i%2===0?1:-1;
    const z=-40+i*9;
    const streetLamp=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,4.1,8),standard(0x4c5f6b));pole.position.y=2.05;streetLamp.add(pole);
    const light=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),standard(0xffebaa));light.position.set(side*.45,4.08,0);streetLamp.add(light);
    streetLamp.position.set(side*6.8,0,z);scene.add(streetLamp);
  }
  makeCitizen('Dona Maria',4.7,-3.5,0x52a47d,'maria');
  makeCitizen('Sr. Carlos',-4.7,3.8,0xe1ad6d,'carlos');
  makeCitizen('Ana',4.7,23.5,0x7b94cc,'ana');
  player=new THREE.Group();player.position.copy(playerPos);scene.add(player);
  clock=new THREE.Clock();
  onResize();window.addEventListener('resize',onResize);
  camera.position.set(0,4.2,-20.5);
  return new Promise(resolve=>{
    const loader=new GLTFLoader();
    loader.load(CHARACTER_FILE,gltf=>{
      characterModel=gltf.scene;
      const bounds=new THREE.Box3().setFromObject(characterModel);
      const height=Math.max(bounds.max.y-bounds.min.y,.01);
      const uniformScale=1.92/height;
      characterModel.scale.setScalar(uniformScale);
      characterModel.position.set(-((bounds.min.x+bounds.max.x)/2)*uniformScale,-bounds.min.y*uniformScale,-((bounds.min.z+bounds.max.z)/2)*uniformScale);
      characterModel.rotation.y=MODEL_FACE_OFFSET;
      modelBaseY = characterModel.position.y;
      player.add(characterModel);
      console.info('Tio Urso GLB carregado corretamente');
      resolve(true);
    },undefined,error=>{
      console.warn('Erro ao carregar GLB; exibe personagem reserva',error);
      characterModel=fakeBear();player.add(characterModel);resolve(false);
    });
  });
}
function onResize(){if(!renderer)return;let w=window.innerWidth,h=window.innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);}
function isBlocked(x,z){
  if(Math.abs(x)>LIMIT||Math.abs(z)>LIMIT)return true;
  for(const b of obstacles)if(x>b.x1&&x<b.x2&&z>b.z1&&z<b.z2)return true;
  return false;
}
function nearbyCitizen(){
  let nearest=null,dist=2.3;
  for(const c of citizenNodes){const d=player.position.distanceTo(c.citizen.position);if(d<dist){nearest=c;dist=d;}}
  return nearest;
}
function interact(){
  if(!started)return;
  const c=nearbyCitizen();
  if(!c){notify('Aproxime-se de um cidadão para conversar.');return;}
  if(talked.has(c.id)){notify(`${c.name}: Obrigado pela presença, Tio Urso!`);return;}
  talked.add(c.id);xp+=40;persist();updateHud();
  c.flag.material.map.dispose();c.citizen.remove(c.flag);
  const newFlag=labelSprite('✓ OBRIGADO!','#f8f7e9','#28543d',2,.42);newFlag.position.y=2.35;c.citizen.add(newFlag);c.flag=newFlag;
  notify(`${c.name}: Obrigado pela atenção!  +40 XP`,3200);
  if(talked.size===3)setTimeout(()=>notify('MISSÃO CONCLUÍDA! 🏅 Patrulhamento comunitário',4200),3400);
}
function update(dt){
  let vx=joyX,vy=joyY;
  if(pressedKeys.has('KeyA')||pressedKeys.has('ArrowLeft'))vx-=1;
  if(pressedKeys.has('KeyD')||pressedKeys.has('ArrowRight'))vx+=1;
  if(pressedKeys.has('KeyW')||pressedKeys.has('ArrowUp'))vy-=1;
  if(pressedKeys.has('KeyS')||pressedKeys.has('ArrowDown'))vy+=1;
  forward.set(-Math.sin(camYaw),0,-Math.cos(camYaw));
  right.set(-forward.z,0,forward.x);
  motion.copy(forward).multiplyScalar(-vy).addScaledVector(right,vx);
  walking=motion.lengthSq()>.005;
  if(walking){
    motion.normalize();
    const run=runHeld||pressedKeys.has('ShiftLeft')||pressedKeys.has('ShiftRight');
    const velocity=(run?RUN_SPEED:PLAYER_SPEED)*dt;
    const x=player.position.x+motion.x*velocity;
    const z=player.position.z+motion.z*velocity;
    if(!isBlocked(x,player.position.z))player.position.x=x;
    if(!isBlocked(player.position.x,z))player.position.z=z;
    const wantedRot=Math.atan2(motion.x,motion.z);
    let angle=Math.atan2(Math.sin(wantedRot-player.rotation.y),Math.cos(wantedRot-player.rotation.y));
    player.rotation.y+=angle*Math.min(1,dt*12);
    animationTime+=dt*(run?14:9);
    characterModel.position.y=modelBaseY+.035*Math.abs(Math.sin(animationTime));
  }else if(characterModel){characterModel.position.y+=(modelBaseY-characterModel.position.y)*Math.min(1,dt*6);}
  const behindX=Math.sin(camYaw),behindZ=Math.cos(camYaw);
  const camDist=7.6;
  camPosWanted.set(player.position.x+behindX*camDist,player.position.y+3.8,player.position.z+behindZ*camDist);
  camera.position.lerp(camPosWanted,Math.min(1,dt*5));
  targetPos.set(player.position.x,1.35,player.position.z);
  camera.lookAt(targetPos);
  const c=nearbyCitizen();
  const hint=el('action-hint');
  if(c){hint.classList.add('visible');hint.textContent=talked.has(c.id)?`✓ ${c.name} já foi atendido`:`✋ FALAR com ${c.name}`;}
  else hint.classList.remove('visible');
  for(const n of citizenNodes)n.flag.visible=player.position.distanceTo(n.citizen.position)<14;
  drawMap();
  if(performance.now()>toastUntil)el('toast').classList.remove('show');
}
function drawMap(){
  const c=miniCtx,w=mini.width,h=mini.height;c.clearRect(0,0,w,h);
  c.fillStyle='#6a927c';c.fillRect(0,0,w,h);
  // Minimapa em torno do personagem, sem correspondência cartográfica real.
  const s=1.9,px=player.position.x,pz=player.position.z;
  const mx=x=>w/2+(x-px)*s, my=z=>h/2-(z-pz)*s;
  c.fillStyle='#46515d';c.fillRect(mx(-3.9),0,7.8*s,h);
  c.fillRect(0,my(17.25),w,7.5*s);c.fillRect(0,my(-25.75),w,6.5*s);
  c.strokeStyle='#ebd5a3';c.setLineDash([7,8]);c.lineWidth=1.4;c.beginPath();c.moveTo(mx(0),0);c.lineTo(mx(0),h);c.stroke();c.setLineDash([]);
  for(const n of citizenNodes){const x=mx(n.citizen.position.x),y=my(n.citizen.position.z);if(x<-5||x>w+5||y<-5||y>h+5)continue;c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fillStyle=talked.has(n.id)?'#70dba1':'#f7d652';c.fill();}
  c.save();c.translate(w/2,h/2);c.rotate(-player.rotation.y);c.fillStyle='#ffffff';c.strokeStyle='#133249';c.lineWidth=2;c.beginPath();c.moveTo(0,-10);c.lineTo(-7,8);c.lineTo(7,8);c.closePath();c.fill();c.stroke();c.restore();
}
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),.05);
  if(started)update(dt);
  renderer.render(scene,camera);
}
function installControls(){
  const stick=el('stick'),zone=el('joystick');let activePointer=null;
  function setStick(e){const r=zone.getBoundingClientRect(),max=r.width*.32;const ox=e.clientX-r.left-r.width/2,oy=e.clientY-r.top-r.height/2;const length=Math.hypot(ox,oy),k=length>max?max/length:1;const dx=ox*k,dy=oy*k;stick.style.transform=`translate(${dx}px,${dy}px)`;joyX=dx/max;joyY=dy/max;}
  zone.addEventListener('pointerdown',e=>{if(activePointer!==null)return;activePointer=e.pointerId;zone.setPointerCapture(e.pointerId);setStick(e);e.preventDefault();});
  zone.addEventListener('pointermove',e=>{if(activePointer===e.pointerId){setStick(e);e.preventDefault();}});
  const resetStick=e=>{if(activePointer!==e.pointerId)return;activePointer=null;stick.style.transform='translate(0,0)';joyX=0;joyY=0;};
  zone.addEventListener('pointerup',resetStick);zone.addEventListener('pointercancel',resetStick);zone.addEventListener('lostpointercapture',()=>{activePointer=null;joyX=0;joyY=0;stick.style.transform='translate(0,0)';});
  el('run').addEventListener('pointerdown',e=>{runHeld=true;el('run').classList.add('pressed');el('run').setPointerCapture(e.pointerId);e.preventDefault();});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])el('run').addEventListener(ev,()=>{runHeld=false;el('run').classList.remove('pressed');});
  el('interact').addEventListener('click',interact);
  window.addEventListener('keydown',e=>{pressedKeys.add(e.code);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyE'||e.code==='Space')interact();});
  window.addEventListener('keyup',e=>pressedKeys.delete(e.code));
  window.addEventListener('blur',()=>{pressedKeys.clear();runHeld=false;joyX=0;joyY=0;});
  // Arrastar sobre o cenário muda a câmera. Joystick/botões não interferem.
  let cameraPointer=null,lastX=0;
  mount.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;cameraPointer=e.pointerId;lastX=e.clientX;mount.setPointerCapture(e.pointerId);});
  mount.addEventListener('pointermove',e=>{if(cameraPointer!==e.pointerId)return;const dx=e.clientX-lastX;lastX=e.clientX;camYaw-=dx*.006;});
  const release=e=>{if(cameraPointer===e.pointerId)cameraPointer=null;};
  mount.addEventListener('pointerup',release);mount.addEventListener('pointercancel',release);
  el('full').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();if(screen.orientation?.lock&&screen.orientation.lock instanceof Function)await screen.orientation.lock('landscape');}catch(e){notify('Gire o celular manualmente para jogar em paisagem.');}});
  el('ignore-rotate').addEventListener('click',()=>{ignorePortrait=true;el('rotate-hint').classList.add('ignored');});
  window.addEventListener('resize',()=>{if(window.innerWidth>window.innerHeight&&!ignorePortrait)el('rotate-hint').classList.remove('ignored');});
}
try{
  installControls();
  const loaded=await buildScene();
  ready=true;introButton.disabled=false;
  introButton.textContent='INICIAR PATRULHAMENTO';
  el('load-info').textContent=loaded?'Tio Urso 3D carregado!':'Modelo não carregou; modo de teste reserva disponível.';
  introButton.addEventListener('click',async()=>{
    if(!ready)return;
    started=true;el('intro').style.display='none';notify('Missão 01: converse com os cidadãos marcados no mapa.',3600);
    try {if(screen.orientation?.lock)await screen.orientation.lock('landscape');} catch(e) { /* mobile browsers may disallow */ }
  });
  loop();
} catch(error){
  console.error(error);
  el('fatal').hidden=false;
  el('fatal-reason').textContent='Confira sua conexão com a internet e tente novamente. O carregamento das bibliotecas 3D requer acesso à rede.';
}
