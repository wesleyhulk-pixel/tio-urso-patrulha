import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// v0.7.7: encaixes do cinto seguem o osso Hips animado, mantendo as calibrações.
// v0.7.6: calibrações confirmadas pelo usuário para os QUATRO encaixes.
// Novos padrões e armazenamento próprio: não importar automaticamente ajustes
// antigos para que eles não substituam as quatro posições aprovadas.
// v0.7.5: calibrações fornecidas pelo usuário fixadas nos padrões do cinto;
// ajuste adicional de tonfa na mão em DESCANSO e no ATAQUE (independentes).
// Preserva rig, GLBs texturizados e controles da v0.7.4.
// v0.7.4: ajuste fino de posição E rotação XYZ para tonfa guardada/coldre.
// Persiste localmente, importa posições antigas da v0.7.3, sem mudar mão/rigging.
// v0.7.3: recuperação sem mexer no esqueleto/dedos; encaixes estáveis no corpo.
// Tonfa e coldre GLB originais, texturas e animações mantidos.
// v0.7.2: uma tonfa 3D única, alternando entre suporte esquerdo e mão direita.
// Coldre Meshy à direita; controle de inclinação do punho e dedos ao empunhar.
// v0.7.1: correção de encaixes; preserva animações, joystick e idle v0.7.
// O bastão em uso continua como na v0.6 (estável). Modelos leves só para itens guardados.
// v0.7: tonfa à ESQUERDA do personagem, coldre vazio à DIREITA e idle mais natural.
// v0.6: tonfa presa ao osso real da mão e encaixe secundário no cinto.
// v0.5: joystick analógico; empurre até a borda superior para corrida automática.
// GLB do Tio Urso com Walking, Running e Triple_Combo_Attack preservado da v0.4.
// Para trocar o personagem depois, altere somente o arquivo GLB e confira o eixo de orientação.
const CHARACTER_FILE = './tio-urso.glb';
const HOLSTER_FILE = './coldre.glb';
const TONFA_BELT_FILE = './tonfa.glb';
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
let handAttackBlend = 0, comboPreviewLocked = false;
let runningBlend = 0;
let hasRiggedAnimations = false;
let actionElapsed = 999;
const COMBO_PLAYBACK_RATE = 1.8;
let equipped = 'punhos';
let tonfaModel = null, rightHolster = null, actionEffect = null;
let tonfaBeltSocket=null, tonfaHandSocket=null, tonfaAssetLoaded=false;
let rightHandBone = null, hipBone = null;
// Matriz de referência: coordenadas dos ajustes v0.7.6 no espaço do personagem
// convertidas para o sistema do quadril ANTES das animações. Não recalcular por frame.
let hipsReferenceInverse = null;
// A pose dos dedos e punho fica 100% com o AnimationMixer original:
// manipulações multiplicativas de quaternion acumulavam torções ao longo dos frames.

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
// Uma única tonfa GLB é transferida entre o suporte do cinto e a mão.
// Os suportes são pontos de encaixe, não cópias de modelos geométricos.
function makeTonfa(){
  // UM bastão 3D é transferido entre dois encaixes. Não criamos mais uma
  // tonfa geométrica diferente para a mão e outra para o cinto.
  tonfaModel = new THREE.Group();
  tonfaBeltSocket = new THREE.Group();
  tonfaHandSocket = new THREE.Group();
  tonfaModel.visible = false;
  rightHolster = new THREE.Group();
  rightHolster.visible = false;
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
// ACESSÓRIOS: posição relativa ao corpo (raiz do GLB), NÃO ao quadril animado.
// No arquivo do Tio Urso +X corresponde ao lado esquerdo dele, visto por trás.
// Usar a raiz elimina os deslocamentos inesperados da orientação do osso Hips.
// Valores em unidades do GLB original. O jogo escala o modelo inteiro de forma uniforme.
// Coordenadas em unidades do GLB original; rotação em GRAUS para facilitar
// o ajuste no celular. O eixo Y gira o acessório em torno da vertical.
const BELT_TONFA = Object.freeze({x:.225, y:.815, z:.075, rx:11.15, ry:1.56, rz:8.12});
// Coldre começa virado ~180° no eixo vertical, em direção às costas.
// O ângulo exato depende da orientação exportada pelo Meshy, então é ajustável.
const BELT_HOLSTER = Object.freeze({x:-.250, y:.855, z:-.020, rx:1.72, ry:-95.31, rz:-4.58});
// Valores calibrados no próprio celular e enviados pelo jogador.
// As animações originais de caminhada, corrida e combo permanecem intactas.
const HAND_TONFA_REST = Object.freeze({x:0, y:-.075, z:-.058, rx:0, ry:-40, rz:0});
const HAND_TONFA_ATTACK = Object.freeze({x:-.15, y:.075, z:-.008, rx:0, ry:5, rz:-110});
// Chave nova intencional: em primeiro uso v0.7.6 aplica os quatro valores
// enviados, sem carregar calibrações antigas que poderiam sobrepor os padrões.
// O progresso de XP/missões continua na chave independente demo-v01.
const ACCESSORY_ADJUST_KEY = 'tio-urso-acessorios-v076';
const ACCESSORY_NAMES = ['tonfa','coldre','maoDescanso','maoAtaque'];
const AXES_POSITION = ['x','y','z'];
const AXES_ROTATION = ['rx','ry','rz'];
const accessoryDefaults = {
  tonfa:BELT_TONFA, coldre:BELT_HOLSTER,
  maoDescanso:HAND_TONFA_REST, maoAtaque:HAND_TONFA_ATTACK
};
let accessoryAdjustments=null;
function normalizeAngleDegrees(value){
  return Math.round((((value+180)%360+360)%360-180)*100)/100;
}
function loadAccessoryAdjustments(){
  let saved=null;
  try {
    const raw=localStorage.getItem(ACCESSORY_ADJUST_KEY);
    if(raw){
      const obj=JSON.parse(raw);
      if(obj && typeof obj==='object' && !Array.isArray(obj)) saved=obj;
    }
  }catch(e){console.warn('Não foi possível recuperar ajustes v0.7.6',e);}
  const positions={};
  for(const key of ACCESSORY_NAMES){
    const defaults=accessoryDefaults[key];
    const previous=saved && saved[key] && typeof saved[key]==='object' ? saved[key] : {};
    positions[key]={};
    for(const axis of AXES_POSITION){
      positions[key][axis]=Number.isFinite(previous[axis])
        ? THREE.MathUtils.clamp(previous[axis],-1.5,2) : defaults[axis];
    }
    for(const axis of AXES_ROTATION){
      positions[key][axis]=Number.isFinite(previous[axis])
        ? normalizeAngleDegrees(previous[axis]) : defaults[axis];
    }
  }
  return positions;
}
accessoryAdjustments=loadAccessoryAdjustments();
function saveAccessoryAdjustments(){
  try{localStorage.setItem(ACCESSORY_ADJUST_KEY,JSON.stringify(accessoryAdjustments));}
  catch(e){console.warn('Ajustes aplicados nesta sessão, mas não salvos:',e);}
}
// A calibração do jogador usa coordenadas locais do GLB (raiz). Já a roupa
// animada acompanha Hips, que pode ter deslocamentos nos clips do Meshy.
// Convertemos a posição/rotação calibrada UMA VEZ para o sistema do osso
// na pose inicial. Durante caminhada/corrida/ataque, os itens seguem Hips.
function applyBeltSocket(socket, p){
  if(!socket || !p)return;
  const pos = new THREE.Vector3(p.x,p.y,p.z);
  const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(p.rx),
    THREE.MathUtils.degToRad(p.ry),
    THREE.MathUtils.degToRad(p.rz),'XYZ'
  ));
  const calibratedInCharacter = new THREE.Matrix4().compose(
    pos, rot, new THREE.Vector3(1,1,1)
  );
  if(hipsReferenceInverse && socket.parent===hipBone){
    calibratedInCharacter.premultiply(hipsReferenceInverse);
  }
  calibratedInCharacter.decompose(socket.position,socket.quaternion,socket.scale);
}
function applyBeltPlacement(){
  applyBeltSocket(tonfaBeltSocket,accessoryAdjustments.tonfa);
  applyBeltSocket(rightHolster,accessoryAdjustments.coldre);
}

function applyHandPlacement(attackBlend=handAttackBlend){
  if(!tonfaModel || tonfaModel.parent!==tonfaHandSocket)return;
  const a=accessoryAdjustments.maoDescanso;
  const b=accessoryAdjustments.maoAtaque;
  const t=THREE.MathUtils.clamp(attackBlend,0,1);
  tonfaModel.position.set(
    THREE.MathUtils.lerp(a.x,b.x,t),
    THREE.MathUtils.lerp(a.y,b.y,t),
    THREE.MathUtils.lerp(a.z,b.z,t));
  // Shortest-path interpolation for angles, preventing a sudden rotation at 180°.
  const angle=(key)=>{
    const difference=normalizeAngleDegrees(b[key]-a[key]);
    return THREE.MathUtils.degToRad(a[key]+difference*t);
  };
  tonfaModel.rotation.set(angle('rx'),angle('ry'),angle('rz'),'XYZ');
}
function applyAccessoryPlacement(){
  applyBeltPlacement();
  applyHandPlacement();
}

function refreshTonfaState(){
  if(!tonfaModel || !tonfaHandSocket || !tonfaBeltSocket) return;
  const readyTonfa=talked.size>=3 && tonfaAttachedToHand && tonfaAssetLoaded;
  const inHand=readyTonfa && equipped==='tonfa';
  const socket=inHand ? tonfaHandSocket : tonfaBeltSocket;
  if(tonfaModel.parent!==socket)socket.add(tonfaModel);
  if(inHand){
    applyHandPlacement();
  }else{
    tonfaModel.position.set(0,0,0);
    tonfaModel.rotation.set(0,0,0);
  }
  tonfaModel.scale.setScalar(1);
  tonfaModel.visible=readyTonfa;
}

function attachTonfaToRig(){
  rightHandBone=findRigBone(characterModel,'mixamorig:RightHand');
  hipBone=findRigBone(characterModel,'mixamorig:Hips');
  if(!rightHandBone || !hipBone){
    tonfaAttachedToHand=false;
    console.warn('Rig ausente; não posicionar acessórios flutuando.');
    return false;
  }
  tonfaAttachedToHand=true;
  // Antes, os suportes eram filhos de characterModel; o GLB anima os ossos
  // Hips.position, deixando coldre/tonfa parados enquanto o corpo se move.
  // Mantemos os valores aprovados no referencial ORIGINAL do personagem.
  characterModel.updateWorldMatrix(true,true);
  const hipInCharacter=new THREE.Matrix4().multiplyMatrices(
    characterModel.matrixWorld.clone().invert(), hipBone.matrixWorld
  );
  hipsReferenceInverse=hipInCharacter.invert();
  hipBone.add(tonfaBeltSocket);
  hipBone.add(rightHolster);
  rightHandBone.add(tonfaHandSocket);
  console.info('v0.7.7: coldre e tonfa guardada ancorados ao quadril animado.');
  // Apenas encaixe da peça — sem forçar rotação do punho nem dedos do urso.
  tonfaHandSocket.position.set(-.015,.085,.024);
  tonfaHandSocket.rotation.set(.04,0,-.12);
  rightHolster.visible=false;
  applyBeltPlacement();
  refreshTonfaState();
  loadDetailedBeltAssets();
  return true;
}

// Mantém materiais PBR/texturas do Meshy. Centraliza e escala a geometria,
// sem reconstruir a tonfa ou substituir por tubos geométricos sem textura.
function normalizeAccessoryScene(root, desiredLength, orientation){
  const bounds=new THREE.Box3().setFromObject(root);
  const center=bounds.getCenter(new THREE.Vector3());
  const size=bounds.getSize(new THREE.Vector3());
  const span=Math.max(size.x,size.y,size.z,.0001);
  const pivot=new THREE.Group();
  const centered=new THREE.Group();
  centered.add(root);
  root.position.sub(center);
  centered.scale.setScalar(desiredLength/span);
  if(orientation==='tonfa')pivot.rotation.z=-Math.PI/2;
  pivot.add(centered);
  root.traverse(o=>{if(o.isMesh){o.castShadow=false;}});
  return pivot;
}
function loadDetailedBeltAssets(){
  const loader=new GLTFLoader();
  loader.load(TONFA_BELT_FILE,gltf=>{
    if(!tonfaModel || !characterModel)return;
    const item=normalizeAccessoryScene(gltf.scene,.52,'tonfa');
    tonfaModel.clear();
    tonfaModel.add(item);
    tonfaAssetLoaded=true;
    refreshTonfaState();
    console.info('Tonfa v0.7.3: mesma malha texturizada no cinto/mão.');
  },undefined,error=>{
    tonfaAssetLoaded=false;tonfaModel.visible=false;
    console.warn('Não foi possível carregar tonfa.glb.',error);
    notify('Não foi possível carregar tonfa.glb. Verifique os arquivos.',4000);
  });
  loader.load(HOLSTER_FILE,gltf=>{
    if(!rightHolster || !characterModel)return;
    const item=normalizeAccessoryScene(gltf.scene,.255,'holster');
    rightHolster.clear();
    rightHolster.add(item);
    rightHolster.visible=true;
  },undefined,error=>{
    rightHolster.visible=false;
    console.warn('Não foi possível carregar coldre.glb.',error);
  });
}
// Ajuste fino opcional pelo telefone: abra ?ajuste=1.
// Permite corrigir poucos centímetros sem remontar ou reenviar o jogo.
function enableAccessoryCalibration(){
  if(!new URLSearchParams(location.search).has('ajuste'))return;
  const panel=document.createElement('aside');
  panel.id='accessory-calibration';
  panel.setAttribute('aria-label','Ajuste fino dos equipamentos 3D');
  panel.style.cssText='position:fixed;right:8px;top:14%;z-index:99999;width:min(254px,61vw);max-height:72vh;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;padding:10px;background:rgba(8,25,39,.94);color:white;border:1px solid #f9c45c;border-radius:12px;font:12px system-ui;box-shadow:0 5px 20px #0006;';
  panel.innerHTML=`
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
      <b>AJUSTE FINO 0.7.6</b>
      <button type="button" id="cal-collapse" aria-label="Recolher painel" style="padding:3px 7px;color:#fff;background:#304e65;border-radius:5px">−</button>
    </div>
    <div id="cal-body">
      <label style="display:block;margin-top:7px">Equipamento/estado
        <select id="cal-item" style="display:block;width:100%;margin:4px 0 8px;padding:5px;color:#111;background:#fff;border-radius:5px">
          <option value="tonfa">Tonfa • guardada no cinto</option>
          <option value="coldre">Coldre • lado direito</option>
          <option value="maoDescanso">Tonfa • mão em descanso</option>
          <option value="maoAtaque">Tonfa • mão em ataque</option>
        </select>
      </label>
      <div id="cal-readout" aria-live="polite" style="font-size:11px;line-height:1.6;margin:6px 0"></div>
      <div id="cal-preview-wrap" hidden>
        <button id="cal-preview" type="button" class="cal-secondary">Congelar pose de ataque</button>
        <small style="display:block;opacity:.85;margin:4px 0">Congele a animação para posicionar a tonfa durante um golpe; toque novamente para liberar.</small>
      </div>
      <details open><summary style="font-weight:700;padding:5px 0;cursor:pointer">↔ POSIÇÃO XYZ</summary>
        <div id="cal-pos-buttons" style="display:grid;grid-template-columns:1fr 1fr;gap:4px"></div>
        <button id="cal-reset-pos" type="button" class="cal-secondary">Restaurar posição</button>
      </details>
      <details open><summary style="font-weight:700;padding:6px 0;cursor:pointer">↻ ROTAÇÃO XYZ</summary>
        <label style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin:5px 0">Passo do giro
          <select id="cal-step" style="padding:5px;color:#111;background:white;border-radius:5px">
            <option value="1">1° (fino)</option><option value="5" selected>5°</option><option value="15">15°</option>
          </select>
        </label>
        <div id="cal-rot-buttons" style="display:grid;grid-template-columns:1fr 1fr;gap:4px"></div>
        <button id="cal-rotate-back" type="button" class="cal-secondary">Girar Y +180°</button>
        <button id="cal-reset-rot" type="button" class="cal-secondary">Restaurar rotação</button>
      </details>
      <button id="cal-copy" type="button" class="cal-secondary">Copiar meus 4 ajustes</button>
      <small style="display:block;margin-top:5px;opacity:.85">Todos os valores são salvos no navegador. O estado ataque não altera a posição guardada.</small>
      <small id="cal-message" role="status" style="display:block;min-height:12px;margin-top:4px;color:#ffe19b"></small>
    </div>`;
  document.body.append(panel);
  for(const btn of panel.querySelectorAll('.cal-secondary')){
    btn.style.cssText='display:block;width:100%;margin-top:6px;padding:6px 3px;border-radius:5px;background:#384e62;color:white;border:1px solid #8195a2;font-size:11px;';
  }
  const choice=panel.querySelector('#cal-item');
  const readout=panel.querySelector('#cal-readout');
  const message=panel.querySelector('#cal-message');
  const previewButton=panel.querySelector('#cal-preview');
  const isHand=()=>['maoDescanso','maoAtaque'].includes(choice.value);
  const show=()=>{
    const p=accessoryAdjustments[choice.value];
    readout.innerHTML=`<span>Posição: X ${p.x.toFixed(3)} · Y ${p.y.toFixed(3)} · Z ${p.z.toFixed(3)}</span><br><span>Giro: X ${p.rx.toFixed(2)}° · Y ${p.ry.toFixed(2)}° · Z ${p.rz.toFixed(2)}°</span>`;
    panel.querySelector('#cal-preview-wrap').hidden=choice.value!=='maoAtaque';
    previewButton.textContent=comboPreviewLocked?'Soltar pose de ataque':'Congelar pose de ataque';
  };
  const endPreview=()=>{
    if(!comboPreviewLocked)return;
    comboPreviewLocked=false;
    if(comboAnim){comboAnim.paused=false;comboAnim.stop();}
    comboActive=false;
    // The ordinary animation blend will restore rest pose smoothly.
  };
  const beginPreview=()=>{
    if(!started){message.textContent='Inicie o jogo antes de congelar a pose.';return;}
    if(!comboAnim){message.textContent='O GLB não contém a animação de ataque.';return;}
    if(equipped!=='tonfa')selectEquipment('tonfa');
    if(equipped!=='tonfa')return;
    comboAnim.paused=false;
    comboAnim.reset();comboAnim.setLoop(THREE.LoopOnce,1);
    comboAnim.setEffectiveTimeScale(1);comboAnim.play();
    comboAnim.time=Math.min(1.2,comboAnim.getClip().duration*.45);
    comboAnim.paused=true;
    comboPreviewLocked=true;comboActive=true;
    message.textContent='Pose congelada: ajuste XYZ e visualize no modelo.';
    show();
  };
  previewButton.addEventListener('click',()=>comboPreviewLocked?endPreview() : beginPreview());
  const change=(axis,delta)=>{
    const p=accessoryAdjustments[choice.value];
    const next=p[axis]+delta;
    p[axis]=AXES_ROTATION.includes(axis) ? normalizeAngleDegrees(next)
      : Math.round(THREE.MathUtils.clamp(next,-1.5,2)*1000)/1000;
    applyAccessoryPlacement();saveAccessoryAdjustments();show();
  };
  const addButton=(parent,name,axis,dir,isRotation)=>{
    const btn=document.createElement('button');btn.type='button';btn.textContent=name;
    btn.style.cssText='min-height:33px;padding:5px 2px;color:#0d2133;background:#f5d47b;border-radius:5px;font:12px system-ui;';
    btn.addEventListener('click',()=>{
      const step=isRotation?Number(panel.querySelector('#cal-step').value):.025;
      change(axis,step*dir);
    });parent.append(btn);
  };
  const pos=panel.querySelector('#cal-pos-buttons');
  for(const [name,axis] of [['Lado','x'],['Altura','y'],['Frente','z']]){
    addButton(pos,`${name} −`,axis,-1,false);addButton(pos,`${name} +`,axis,1,false);
  }
  const rot=panel.querySelector('#cal-rot-buttons');
  for(const axis of AXES_ROTATION){
    const name=axis.slice(1).toUpperCase();
    addButton(rot,`Giro ${name} −`,axis,-1,true);addButton(rot,`Giro ${name} +`,axis,1,true);
  }
  choice.addEventListener('change',()=>{
    endPreview();message.textContent='';
    if(isHand() && started && talked.size>=3 && equipped!=='tonfa')selectEquipment('tonfa');
    show();
  });
  panel.querySelector('#cal-rotate-back').addEventListener('click',()=>change('ry',180));
  const resetAxes=axes=>{
    const key=choice.value;
    for(const axis of axes)accessoryAdjustments[key][axis]=accessoryDefaults[key][axis];
    applyAccessoryPlacement();saveAccessoryAdjustments();show();
    message.textContent='Restaurado apenas o estado selecionado.';
  };
  panel.querySelector('#cal-reset-pos').addEventListener('click',()=>resetAxes(AXES_POSITION));
  panel.querySelector('#cal-reset-rot').addEventListener('click',()=>resetAxes(AXES_ROTATION));
  panel.querySelector('#cal-copy').addEventListener('click',async()=>{
    const result=JSON.stringify(accessoryAdjustments,null,2);
    try{await navigator.clipboard.writeText(result);message.textContent='Quatro ajustes copiados!';}
    catch(e){message.textContent='Cópia indisponível neste navegador.';}
  });
  panel.querySelector('#cal-collapse').addEventListener('click',()=>{
    const body=panel.querySelector('#cal-body');body.hidden=!body.hidden;
    panel.querySelector('#cal-collapse').textContent=body.hidden?'+':'−';
  });
  show();
}

function selectEquipment(item){
  if(item==='tonfa'&&talked.size<3){notify('Complete a missão comunitária para receber a tonfa.');return;}
  if(item==='tonfa' && (!tonfaAttachedToHand || !tonfaAssetLoaded)){
    notify('Tonfa 3D ainda não carregou ou não há osso da mão. Aguarde.',4200);
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
  if(comboPreviewLocked || comboActive || comboBlend>.2 || actionElapsed<.48)return;
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
    // Blend only the accessory's relative socket transform, never the finger bones.
    handAttackBlend+=(Number(comboActive)-handAttackBlend)*(1-Math.exp(-dt*10));
    applyHandPlacement(handAttackBlend);
    // IMPORTANTE: não alterar dedos/punho após AnimationMixer.update().
    // Antes eram multiplicados a cada frame, acumulando torções e deformações.
    // As mãos continuam nas poses originais corretas dos clips importados.
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
  // A tonfa guardada e o coldre estão na raiz do modelo; o bastão equipado fica na mão.
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
  enableAccessoryCalibration();
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
