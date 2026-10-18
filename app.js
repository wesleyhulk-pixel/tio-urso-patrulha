import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// v0.7: tonfa à ESQUERDA do personagem, coldre vazio à DIREITA e idle mais natural.
// v0.6: tonfa presa ao osso real da mão e encaixe secundário no cinto.
// v0.5: joystick analógico; empurre até a borda superior para corrida automática.
// GLB do Tio Urso com Walking, Running e Triple_Combo_Attack preservado da v0.4.
// Para trocar o personagem depois, altere somente o arquivo GLB e confira o eixo de orientação.
const CHARACTER_FILE = './tio-urso.glb';
const MODEL_FACE_OFFSET = 0; // 0 = personagem olha para +Z.
const PLAYER_SPEED = 2.9;
const RUN_SPEED = 5.4;
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
let joyX = 0, joyY = 0, autoRunByStick = false;
// Limiar com histerese: impede alternância rápida entre andar e correr.
const AUTO_RUN_ON_FORWARD = 0.79;
const AUTO_RUN_ON_PRESSURE = 0.88;
const AUTO_RUN_OFF_FORWARD = 0.67;
const AUTO_RUN_OFF_PRESSURE = 0.75;
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
let walkBlend = 0;
let animationMixer = null;
let idleAnim = null, walkAnim = null, runAnim = null, comboAnim = null;
let comboActive = false, comboBlend = 0, tonfaAttachedToHand = false;
let runningBlend = 0;
let hasRiggedAnimations = false;
let actionElapsed = 999;
const COMBO_PLAYBACK_RATE = 1.8;
let equipped = 'punhos';
let tonfaModel = null, tonfaHolstered = null, rightHolster = null, actionEffect = null;
let gripBlend = 0;
const grippingFingers = [];
let rightHandBone = null, hipBone = null;

let animVars = {
  phase: {value:0}, amount: {value:0}, action: {value:0}
};
const velocitySmooth = new THREE.Vector3();
const GROUND_Y = .041;
const CAM_DISTANCE = 2.65;
const CAM_HEIGHT = 2.24;


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
  el('tonfa-state').textContent = talked.size >= 3 ? '✓ Liberado após Missão 01' : '🔒 Conclua o contato comunitário';
  el('equip-tonfa').disabled = talked.size < 3;
  if(talked.size >= 3) el('equip-tonfa').classList.add('unlocked');
  refreshTonfaState();
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

// O GLB do Meshy não possui ossos. Deformação suave por VERTEX SHADER,
// totalmente reversível. Não substitui um esqueleto/rigging profissional.
function installProceduralGait(model){
  model.traverse(node=>{
    if(!node.isMesh || !node.geometry?.getAttribute('position'))return;
    // A malha do nosso GLB é centrada em (0,0,0), com altura ~1.9 unidade.
    const mat=node.material.clone();
    const cacheKey='TioUrsoGait_v02';
    mat.customProgramCacheKey=()=>cacheKey;
    mat.onBeforeCompile=shader=>{
      shader.uniforms.uGaitPhase=animVars.phase;
      shader.uniforms.uGaitAmount=animVars.amount;
      shader.uniforms.uAction=animVars.action;
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
        uniform float uGaitPhase;
        uniform float uGaitAmount;
        uniform float uAction;
      `);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float pSide = position.x < 0.0 ? -1.0 : 1.0;
        float pAbsX = abs(position.x);
        float armMask = smoothstep(0.20,0.35,pAbsX) * (1.0-smoothstep(0.26,0.46,position.y));
        float legMask = smoothstep(0.045,0.15,pAbsX) * (1.0-smoothstep(-0.27,-0.06,position.y));
        float oscillation = sin(uGaitPhase + (pSide>0.0 ? 0.0 : 3.14159));
        float armSwing = oscillation*uGaitAmount*0.39;
        // Soco: braço direito avança sem mover o corpo inteiro.
        if(pSide>0.0)armSwing += -uAction*0.86;
        float da = position.y - 0.29;
        float za = position.z;
        float ca = cos(armSwing), sa = sin(armSwing);
        vec3 armPos = vec3(position.x, 0.29+ca*da-sa*za, sa*da+ca*za);
        transformed = mix(transformed, armPos, armMask);
        float legSwing = -oscillation*uGaitAmount*0.35;
        float dl = position.y + 0.17;
        float zl = position.z;
        float cl = cos(legSwing),sl = sin(legSwing);
        vec3 legPos = vec3(position.x,-0.17+cl*dl-sl*zl,sl*dl+cl*zl);
        transformed = mix(transformed,legPos,legMask);
        // Corrige a elevação geométrica do pé provocada pela rotação da perna.
        transformed.y -= legMask * 0.78 * (1.0-cl);
        // Respiração discreta no tórax; pés permanecem próximos ao piso.
        float upper = smoothstep(0.05,0.52,position.y)*(1.0-armMask);
        transformed.y += upper*0.004*sin(uGaitPhase*0.5);
      `);
    };
    node.material=mat;
  });
}

// Aproveita o rig e as animações exportadas pelo Meshy. Sem deformação por shader:
// as transformações das articulações são interpretadas pelo Three.js AnimationMixer.
function installRiggedAnimations(gltf){
  const walkingClip=gltf.animations.find(a => /walk/i.test(a.name));
  const runningClip=gltf.animations.find(a => /run/i.test(a.name));
  const comboClip=gltf.animations.find(a => /triple.*combo.*attack|combo.*attack/i.test(a.name));
  if(!walkingClip || !runningClip) return false;
  try {
    // Repouso criado a partir da pose neutra do próprio esqueleto.
    // Assim, o modelo não fica parado com uma perna suspensa.
    const idleTracks=[];
    for (const track of walkingClip.tracks) {
      const dot=track.name.lastIndexOf('.');
      if(dot<0) continue;
      const nodeName=track.name.slice(0,dot);
      const path=track.name.slice(dot+1);
      const node=characterModel.getObjectByName(nodeName);
      const value=node?.[path];
      if(!value || typeof value.toArray!=='function')continue;
      const rest=value.toArray();
      // Repouso: braços relaxados de verdade em vez da A-pose da imagem-base.
      // O movimento é calculado NO SISTEMA LOCAL DO PAI, preservando os eixos
      // reais dos ossos do Meshy e evitando uma rotação arbitrária no ombro.
      if(path==='quaternion') {
        const q=new THREE.Quaternion().fromArray(rest);
        let relaxation=0;
        if(String(nodeName).replace(/[^a-z0-9]/gi,'').toLowerCase().endsWith('rightarm')) relaxation=0.29;
        if(String(nodeName).replace(/[^a-z0-9]/gi,'').toLowerCase().endsWith('leftarm')) relaxation=-0.29;
        if(relaxation){
          const parentWorld=new THREE.Quaternion();
          node.parent?.getWorldQuaternion(parentWorld);
          const localAxis=new THREE.Vector3(0,0,1).applyQuaternion(parentWorld.invert()).normalize();
          const correction=new THREE.Quaternion().setFromAxisAngle(localAxis,relaxation);
          q.premultiply(correction).normalize();
        }
        // Pequena respiração no peito enquanto o Tio Urso está parado.
        const isBreathing=String(nodeName).replace(/[^a-z0-9]/gi,'').toLowerCase().endsWith('spine2');
        const restQ=q.toArray();
        const breathe=isBreathing ? q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.016)).toArray():restQ;
        idleTracks.push(new THREE.QuaternionKeyframeTrack(track.name,[0,1.5,3], [...restQ,...breathe,...restQ]));
      } else if(path==='position'||path==='scale') {
        idleTracks.push(new THREE.VectorKeyframeTrack(track.name,[0,1.5,3],[...rest,...rest,...rest]));
      }
    }
    if(idleTracks.length<30)console.warn('O repouso pode estar incompleto:',idleTracks.length);
    const idleClip=new THREE.AnimationClip('Parado',3,idleTracks);
    animationMixer=new THREE.AnimationMixer(characterModel);
    idleAnim=animationMixer.clipAction(idleClip);
    walkAnim=animationMixer.clipAction(walkingClip);
    runAnim=animationMixer.clipAction(runningClip);
    if(comboClip){
      // A animação original avança o quadril ~1,3 m. Não duplicamos
      // esse deslocamento: quem movimenta o jogador é o controle do jogo.
      const gameCombo=comboClip.clone();
      const hips=characterModel.getObjectByName('mixamorig:Hips');
      for(const track of gameCombo.tracks){
        if(track.name==='mixamorig:Hips.position' && track.values?.length){
          for(let k=0;k<track.values.length;k+=3){
            track.values[k]=hips?.position.x ?? 0;
            track.values[k+2]=hips?.position.z ?? 0;
          }
        }
      }
      comboAnim=animationMixer.clipAction(gameCombo);
      comboAnim.setLoop(THREE.LoopOnce,1);
      comboAnim.clampWhenFinished=true;
      comboAnim.enabled=true;
      comboAnim.setEffectiveWeight(0);
      comboAnim.setEffectiveTimeScale(COMBO_PLAYBACK_RATE);
      animationMixer.addEventListener('finished',e=>{
        if(e.action===comboAnim)comboActive=false;
      });
    }
    for(const action of [idleAnim,walkAnim,runAnim]){
      action.setLoop(THREE.LoopRepeat,Infinity);
      action.enabled=true;
      action.play();
    }
    idleAnim.setEffectiveWeight(1);
    walkAnim.setEffectiveWeight(0);
    runAnim.setEffectiveWeight(0);
    hasRiggedAnimations=true;
    console.info('GLB animado:',gltf.animations.map(a=>a.name),'bones/rest tracks:',idleTracks.length,'combo:',Boolean(comboAnim));
    return true;
  } catch(e){
    console.error('Falha ao configurar animações rigadas:',e);
    animationMixer=null;idleAnim=null;walkAnim=null;runAnim=null;comboAnim=null;
    return false;
  }
}

function createGroundShadow(){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d');const gradient=c.createRadialGradient(64,64,4,64,64,62);
  gradient.addColorStop(0,'rgba(0,0,0,0.45)');gradient.addColorStop(.45,'rgba(0,0,0,0.22)');gradient.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=gradient;c.fillRect(0,0,128,128);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(1.45,1.05),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,opacity:.85,polygonOffset:true,polygonOffsetFactor:-1}));
  m.rotation.x=-Math.PI/2;m.position.y=-.008;
  player.add(m);
}
function makeAttackEffect(){
  const effect=new THREE.Mesh(new THREE.TorusGeometry(.26,.045,8,24),new THREE.MeshBasicMaterial({color:0xffd978,transparent:true,opacity:0,depthWrite:false}));
  effect.visible=false;effect.position.set(.25,1.15,.85);player.add(effect);actionEffect=effect;
}
// Tonfa com dois encaixes: um modelo acompanha a mão, outro fica na lateral do cinto.
// Nunca deixamos o bastão como filho de 'player' solto na cena.
function buildTonfaModel(){
  const weapon = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({color:0x202a32, roughness:.72, metalness:.08});
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.026,.029,.70,12),black);
  shaft.position.y=.33; weapon.add(shaft);
  const sideHandle = new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.23,12),black);
  sideHandle.rotation.z=Math.PI/2;
  sideHandle.position.set(-.105,.065,0);weapon.add(sideHandle);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.033,.033,.13,12),black);
  grip.position.set(0,.066,0);weapon.add(grip);
  return weapon;
}
function makeTonfa(){
  tonfaModel=buildTonfaModel();
  tonfaHolstered=buildTonfaModel();
  tonfaModel.visible=false;
  tonfaHolstered.visible=false;
  // Coldre DIREITO ainda vazio: a pistola permanece bloqueada nesta fase.
  // É só uma peça visual simples, sem arma ou disparos.
  rightHolster=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.16,.28,.10),
      new THREE.MeshStandardMaterial({color:0x11191d,roughness:.89}));
  body.position.set(0,-.11,0);rightHolster.add(body);
  const lip=new THREE.Mesh(new THREE.BoxGeometry(.17,.042,.115),
      new THREE.MeshStandardMaterial({color:0x333d44,roughness:.77}));
  lip.position.set(0,.018,.004);rightHolster.add(lip);
  const strap=new THREE.Mesh(new THREE.BoxGeometry(.19,.055,.14),
      new THREE.MeshStandardMaterial({color:0x202a30,roughness:.86}));
  strap.position.set(0,-.042,.0);rightHolster.add(strap);
  rightHolster.visible=false;
}
// GLTFLoader pode normalizar os nomes originais dos ossos (ex.: mixamorig:RightHand
// vira mixamorigRightHand). Buscar apenas pelo nome com ':' deixava a tonfa solta.
function findRigBone(root, target){
  if(!root)return null;
  const strip=s=>String(s||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const expected=strip(target);
  let exactBone=null, looseBone=null;
  root.traverse(node=>{
    if(!node.isBone)return;
    const name=strip(node.name);
    if(name===expected) exactBone=node;
    else if(!looseBone && name.endsWith(expected))looseBone=node;
  });
  if(exactBone || looseBone)return exactBone || looseBone;
  // Cobre GLBs em que o objeto da articulação não está marcado como Bone.
  let fallback=null;
  root.traverse(node=>{if(!fallback && strip(node.name)===expected) fallback=node;});
  return fallback;
}
function refreshTonfaState(){
  if(tonfaModel) tonfaModel.visible=Boolean(rightHandBone) && equipped==='tonfa';
  if(tonfaHolstered) tonfaHolstered.visible=talked.size>=3 && equipped!=='tonfa';
}
function attachTonfaToRig(){
  rightHandBone=findRigBone(characterModel,'mixamorig:RightHand');
  hipBone=findRigBone(characterModel,'mixamorig:Hips');
  if(!rightHandBone || !tonfaModel){
    tonfaAttachedToHand=false;
    console.warn('Tonfa: não encontrei mixamorig RightHand; impedindo objeto solto.',
      [...new Set((()=>{const names=[];characterModel?.traverse(n=>{if(n.isBone)names.push(n.name);});return names;})())]);
    refreshTonfaState();
    return false;
  }
  // O eixo Y positivo do osso da mão aponta da articulação para os dedos neste rig.
  // O cabo cruza a palma; o corpo do bastão segue o punho no ciclo walk/run/combo.
  rightHandBone.add(tonfaModel);
  tonfaModel.position.set(-.010,.080,.015);
  tonfaModel.rotation.set(0,0,-.10);
  tonfaModel.scale.setScalar(.77);
  tonfaAttachedToHand=true;
  // Dedos do personagem são articulados. O fechamento será sutil e progressivo
  // quando a tonfa estiver equipada; não altera o arquivo GLB original.
  for(const [name,angle] of [
    ['RightHandMiddle2',.33],['RightHandMiddle3',.21],
    ['RightHandPinky2',.33],['RightHandPinky3',.20],
    ['RightHandThumb2',-.20]
  ]){
    const bone=findRigBone(characterModel,`mixamorig:${name}`);
    if(bone)grippingFingers.push({bone,delta:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle)});
  }

  // Convenção do esqueleto Meshy: +X = ESQUERDA DO PERSONAGEM,
  // -X = DIREITA DO PERSONAGEM (não a esquerda/direita da câmera).
  // Ambos os suportes acompanham o quadril, sem depender do ângulo da câmera.
  const waistParent=hipBone || characterModel;
  waistParent.add(tonfaHolstered);
  waistParent.add(rightHolster);
  if(hipBone){
    tonfaHolstered.position.set(+.47,+.085,-.075); // quadril ESQUERDO, acima da coxa
    rightHolster.position.set(-.435,-.035,-.065);   // coldre DIREITO, vazio
  }else{
    tonfaHolstered.position.set(+.47,1.02,-.075);
    rightHolster.position.set(-.435,.91,-.065);
  }
  tonfaHolstered.rotation.set(.06,0,Math.PI+.34);
  tonfaHolstered.scale.setScalar(.61);
  rightHolster.rotation.set(0,0,-.07);
  rightHolster.visible=true;
  refreshTonfaState();
  console.info('Tonfa v0.7: mão:',rightHandBone.name,'quadril:',hipBone?.name||'modelo',
    'suporte esquerdo / coldre direito.');
  return true;
}
function selectEquipment(item){
  if(item==='tonfa'&&talked.size<3){notify('Complete a missão comunitária para receber a tonfa.');return;}
  if(item==='tonfa' && !tonfaAttachedToHand){
    notify('Encaixe da tonfa indisponível neste modelo; bastão não será deixado solto.',4200);
    return;
  }
  if(item==='arma'){notify('Arma de fogo: aguardando futura missão de habilitação.');return;}
  equipped=item;
  el('weapon-label').textContent=item==='tonfa'?'🥢 TONFA':'👊 PUNHOS';
  el('action').querySelector('span').textContent=item==='tonfa'?'🥢':'👊';
  refreshTonfaState();
  el('equipment-panel').hidden=true;
  notify(item==='tonfa'?'Tonfa na mão direita!':'Tonfa guardada à esquerda do cinto.');
}
function doAction(){
  if(!started)return;
  if(comboActive || comboBlend>.2 || actionElapsed<.48)return;
  actionElapsed=0;
  // Somente demonstração: não aplicamos dano aos cidadãos das missões.
  if(comboAnim){
    comboActive=true;
    comboAnim.reset();
    comboAnim.setLoop(THREE.LoopOnce,1);
    comboAnim.clampWhenFinished=true;
    comboAnim.setEffectiveTimeScale(COMBO_PLAYBACK_RATE);
    comboAnim.play();
    notify(equipped==='tonfa'?'Treinamento: sequência de golpes com tonfa.':'Treinamento: combo de golpes desarmados.',1600);
  }else{
    notify(equipped==='tonfa'?'Golpe de tonfa simulado.':'Soco simulado.',1300);
  }
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
  player=new THREE.Group();player.position.copy(playerPos);player.position.y=GROUND_Y;scene.add(player);
  createGroundShadow();makeAttackEffect();makeTonfa();
  clock=new THREE.Clock();
  onResize();window.addEventListener('resize',onResize);
  camera.position.set(0,CAM_HEIGHT,-13-CAM_DISTANCE);
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
      if(!installRiggedAnimations(gltf)){
        // Reserva para um modelo antigo sem ossos.
        installProceduralGait(characterModel);
      }
      attachTonfaToRig();
      console.info('Tio Urso GLB carregado corretamente, rig:',hasRiggedAnimations);
      resolve(true);
    },undefined,error=>{
      console.warn('Erro ao carregar GLB; exibe personagem reserva',error);
      characterModel=fakeBear();player.add(characterModel);resolve(false);
    });
  });
}
function onResize(){if(!renderer)return;let w=mount.clientWidth||window.innerWidth,h=mount.clientHeight||window.innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);}
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
  if(talked.size===3)setTimeout(()=>notify('MISSÃO CONCLUÍDA! 🏅 Bastão tonfa liberado no equipamento.',4700),3100);
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
  // O joystick agora é analógico: deslocamento curto = passo leve; até a borda = velocidade total.
  // O botão CORRER e Shift continuam funcionando independentemente da zona automática.
  const keyboardMoving = pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft') ||
    pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight') ||
    pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp') ||
    pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown');
  const joystickPressure = Math.min(1, Math.hypot(joyX, joyY));
  const analogScale = keyboardMoving ? 1 : THREE.MathUtils.clamp((joystickPressure - 0.10) / 0.65, 0, 1);
  const trying=motion.lengthSq()>.008 && analogScale>.045 && !comboActive && comboBlend<.25;
  const running=(autoRunByStick||runHeld||pressedKeys.has('ShiftLeft')||pressedKeys.has('ShiftRight'))&&trying;
  const desired=new THREE.Vector3();
  if(trying){
    const stride=keyboardMoving?1:Math.max(0.30,analogScale);
    desired.copy(motion).normalize().multiplyScalar((running?RUN_SPEED:PLAYER_SPEED)*stride);
  }
  // Aceleração/desaceleração gradual: menos 'deslizamento'.
  const alpha=1-Math.exp(-dt*(trying?12:17));
  velocitySmooth.lerp(desired,alpha);
  if(velocitySmooth.lengthSq()<.004)velocitySmooth.set(0,0,0);
  const x=player.position.x+velocitySmooth.x*dt;
  const z=player.position.z+velocitySmooth.z*dt;
  if(!isBlocked(x,player.position.z))player.position.x=x;else velocitySmooth.x=0;
  if(!isBlocked(player.position.x,z))player.position.z=z;else velocitySmooth.z=0;
  const speed=velocitySmooth.length();
  walking=speed>.12;
  if(walking){
    const wantedRot=Math.atan2(velocitySmooth.x,velocitySmooth.z);
    const delta=Math.atan2(Math.sin(wantedRot-player.rotation.y),Math.cos(wantedRot-player.rotation.y));
    player.rotation.y+=delta*(1-Math.exp(-dt*12));
  }
  walkBlend+=(Math.min(1,speed/PLAYER_SPEED)-walkBlend)*(1-Math.exp(-dt*9));
  animationTime+=dt*(2.3+speed*1.85);
  if(animationMixer){
    runningBlend+=(Number(running)-runningBlend)*(1-Math.exp(-dt*7));
    const movingWeight=THREE.MathUtils.clamp(speed/PLAYER_SPEED,0,1);
    // Blend in/out do combo para não saltar abruptamente entre poses.
    const blendTarget=comboActive?1:0;
    comboBlend+=(blendTarget-comboBlend)*(1-Math.exp(-dt*(comboActive?15:11)));
    if(!comboActive && comboBlend<.005){
      comboBlend=0;
      if(comboAnim?.isRunning())comboAnim.stop();
    }
    const loco=1-comboBlend;
    idleAnim.setEffectiveWeight((1-movingWeight)*loco);
    walkAnim.setEffectiveWeight(movingWeight*(1-runningBlend)*loco);
    runAnim.setEffectiveWeight(movingWeight*runningBlend*loco);
    if(comboAnim)comboAnim.setEffectiveWeight(comboBlend);
    walkAnim.timeScale=THREE.MathUtils.clamp(speed/PLAYER_SPEED,.6,1.3);
    runAnim.timeScale=THREE.MathUtils.clamp(speed/RUN_SPEED,.65,1.35);
    animationMixer.update(dt);
    // Posição da mão semi-fechada: mistura-se progressivamente à pose do clip.
    // Aplica DEPOIS do mixer (que restaura as rotações animadas a cada frame).
    gripBlend+=(Number(equipped==='tonfa')-gripBlend)*(1-Math.exp(-dt*11));
    for(const {bone,delta} of grippingFingers){
      const q=new THREE.Quaternion().identity().slerp(delta,gripBlend);
      bone.quaternion.multiply(q).normalize();
    }
  } else {
    animVars.phase.value=animationTime;
    animVars.amount.value=walkBlend;
  }
  actionElapsed+=dt;
  const pulse=actionElapsed<.32?Math.sin(Math.PI*actionElapsed/.32):0;
  // Nas animações importadas, o próprio corpo realiza o ataque.
  const fxPulse=comboAnim&&comboActive?Math.max(.20,Math.abs(Math.sin(comboAnim.time*7))):pulse;
  if(!animationMixer) animVars.action.value=pulse;
  if(actionEffect){
    actionEffect.visible=(!comboAnim && pulse>.015) || (comboActive && fxPulse>.4);
    actionEffect.material.opacity=comboActive?fxPulse*.22:pulse*.65;
    actionEffect.scale.setScalar(1+.85*(1-fxPulse));
    actionEffect.position.set(.28,1.11,.83);
  }
  // Não alteramos a orientação da tonfa a cada quadro: o osso da mão já faz isso.
  // A tonfa fica no lado esquerdo do cinto; o coldre vazio, à direita.
  // O modelo permanece assentado no piso, sem salto artificial.
  player.position.y=GROUND_Y;
  if(characterModel){characterModel.position.y=modelBaseY;characterModel.rotation.z=Math.sin(animationTime)*walkBlend*.008;}
  const behindX=Math.sin(camYaw),behindZ=Math.cos(camYaw);
  camPosWanted.set(player.position.x+behindX*CAM_DISTANCE,player.position.y+CAM_HEIGHT,player.position.z+behindZ*CAM_DISTANCE);
  camera.position.lerp(camPosWanted,1-Math.exp(-dt*9));
  targetPos.set(player.position.x,1.32,player.position.z);
  camera.lookAt(targetPos);
  const c=nearbyCitizen();const hint=el('action-hint');
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
  function updateAutoRunFromStick(){
    const pressure=Math.min(1,Math.hypot(joyX,joyY));
    const forwardPush=-joyY;
    const shouldSprint=autoRunByStick
      ? forwardPush>=AUTO_RUN_OFF_FORWARD && pressure>=AUTO_RUN_OFF_PRESSURE
      : forwardPush>=AUTO_RUN_ON_FORWARD && pressure>=AUTO_RUN_ON_PRESSURE;
    if(shouldSprint!==autoRunByStick){
      autoRunByStick=shouldSprint;
      zone.classList.toggle('auto-running',shouldSprint);
    }
  }
  function setStick(e){
    const r=zone.getBoundingClientRect(),max=r.width*.32;
    const ox=e.clientX-r.left-r.width/2,oy=e.clientY-r.top-r.height/2;
    const length=Math.hypot(ox,oy),k=length>max?max/length:1;
    const dx=ox*k,dy=oy*k;
    stick.style.transform=`translate(${dx}px,${dy}px)`;
    joyX=dx/max;joyY=dy/max;
    updateAutoRunFromStick();
  }
  function clearStick(){
    activePointer=null;joyX=0;joyY=0;autoRunByStick=false;
    stick.style.transform='translate(0,0)';
    zone.classList.remove('auto-running');
  }
  zone.addEventListener('pointerdown',e=>{
    if(activePointer!==null)return;
    activePointer=e.pointerId;zone.setPointerCapture(e.pointerId);setStick(e);e.preventDefault();
  });
  zone.addEventListener('pointermove',e=>{if(activePointer===e.pointerId){setStick(e);e.preventDefault();}});
  const resetStick=e=>{if(activePointer===e.pointerId)clearStick();};
  zone.addEventListener('pointerup',resetStick);
  zone.addEventListener('pointercancel',resetStick);
  zone.addEventListener('lostpointercapture',clearStick);
  el('run').addEventListener('pointerdown',e=>{runHeld=true;el('run').classList.add('pressed');el('run').setPointerCapture(e.pointerId);e.preventDefault();});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])el('run').addEventListener(ev,()=>{runHeld=false;el('run').classList.remove('pressed');});
  el('interact').addEventListener('click',interact);
  el('action').addEventListener('click',doAction);
  el('equip').addEventListener('click',()=>{el('equipment-panel').hidden=!el('equipment-panel').hidden;});
  el('close-equipment').addEventListener('click',()=>el('equipment-panel').hidden=true);
  el('equip-fists').addEventListener('click',()=>selectEquipment('punhos'));
  el('equip-tonfa').addEventListener('click',()=>selectEquipment('tonfa'));
  el('equip-firearm').addEventListener('click',()=>selectEquipment('arma'));
  window.addEventListener('keydown',e=>{pressedKeys.add(e.code);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyE')interact();if(e.code==='Space')doAction();if(e.code==='KeyQ')el('equipment-panel').hidden=!el('equipment-panel').hidden;});
  window.addEventListener('keyup',e=>pressedKeys.delete(e.code));
  window.addEventListener('blur',()=>{pressedKeys.clear();runHeld=false;clearStick();});
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
  el('load-info').textContent=loaded?(comboAnim?'Tio Urso animado: caminhada, corrida e combo de golpes!':hasRiggedAnimations?'Caminhada e corrida prontas!':'Tio Urso 3D carregado!'):'Modelo não carregou; modo reserva disponível.';
  introButton.addEventListener('click',async()=>{
    if(!ready)return;
    started=true;el('intro').style.display='none';notify('Empurre o joystick até o topo para CORRER automaticamente. Converse com 3 cidadãos!',3900);
    try {if(screen.orientation?.lock)await screen.orientation.lock('landscape');} catch(e) { /* mobile browsers may disallow */ }
  });
  loop();
} catch(error){
  console.error(error);
  el('fatal').hidden=false;
  el('fatal-reason').textContent='Confira sua conexão com a internet e tente novamente. O carregamento das bibliotecas 3D requer acesso à rede.';
}
