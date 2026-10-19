// v0.9.0: mapa inicial da Central da Guarda e Praça da Matriz, geometria provisória
// para teste em celular. Traçado de quadras e edifícios ilustrativo até
// conferência com vista aérea. Preserva mecânicas, controles e GLBs anteriores.
// v0.8.9: orientacao paisagem ao iniciar via fullscreen + Screen Orientation API;
// manifest PWA pede paisagem na abertura do app instalado. Mira X:-15 Y:-40 fixa.
// v0.8.8: calibração APENAS da cruz na tela; pata das costas aprovada
// (Y -0.08, RX -10) fixada. Passos reais do Mixkit com sincronização dos clipes;
// todas as calibrações da tonfa, coldre e pistola preservadas.
// v0.8.7: ajuste fino exclusivo da pata das costas (posição XYZ, rotação XYZ, escala)
// e pisadas provisórias sintetizadas pelo Web Audio ao caminhar/correr.
// Calibrações existentes, GLBs e animações foram mantidos da v0.8.6.
// v0.8.6: proteção contra desaparecimento do personagem por descarte
// incorreto do SkinnedMesh durante a rotação da câmera. GLB, ossos,
// materiais, animações e calibrações dos equipamentos inalterados.
// v0.8.5: sons urbanos e biblioteca de efeitos com prévia.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// v0.8.4: câmera sobre ombro com centro de mira livre das costas; pata menor
// presa à superfície traseira do colete, sem tocar nos riggings aprovados.
// v0.8.3: ajuste da mira por quaternions em REFERENCIAL FIXO do personagem.
// Pitch/yaw/roll são independentes da rotação Euler inicial do Meshy;
// pistola aponta adiante (+Z), com cano original no eixo -X do GLB.
// Sem tocar nas 6 calibrações aprovadas, nem na pose FIXA v0.8.2.
// v0.8.2: postura de mira pré-calculada UMA VEZ com os ossos do GLB.
// Sem solver dinâmico durante a mira; testes preservados.
// v0.8.1: fixo de ombro e antebraço por POSE ABSOLUTA (sem acúmulo),
// animações de origem intactas e só Mira calibrável.
// v0.8.0: Mira estável: ombro em eixo LOCAL sem coordenadas mundiais,
// apenas pistolaMira ajustável; seis calibrações confirmadas bloqueadas.
// v0.7.9: pistola GLB texturizada no coldre e mão, estados descanso/mira,
// ajuste independente dos três encaixes e retícula de câmera no teste.
// O tiro continua bloqueado na progressão regular; teste visual via ?ajuste=1.
// v0.7.8: camera livre vertical/horizontal, enquadramento proximo em paisagem,
// sombra real das animacoes + pata no colete (sem alterar os GLBs).
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
const PISTOL_FILE = './pistola.glb';
const RETICLE_ADJUST_MODE = new URLSearchParams(location.search).has('cruz');
const FIREARM_TEST_MODE = new URLSearchParams(location.search).has('ajuste') || RETICLE_ADJUST_MODE;
const PAW_ADJUST_MODE = new URLSearchParams(location.search).has('pata');
const MODEL_FACE_OFFSET = 0; // 0 = personagem olha para +Z.
const PLAYER_SPEED = 2.9;
const RUN_SPEED = 5.4;
const LIMIT = 48;
// A configuração abaixo permite ajustar o mapa depois com a foto aérea.
// As coordenadas são LOCAIS ao jogo, não latitudes/longitudes reais.
const MAPA_VERSAO = "CENTRO · MATRIZ / CENTRAL — ESQUEMA v0.9.0";
const MAPA_RUAS = [
  {nome:"Rua Eurilemos", eixo:"z", pos:0, largura:7.6},
  {nome:"Rua Falcão", eixo:"z", pos:-39, largura:7.0},
  {nome:"Rua Drongo", eixo:"z", pos:39, largura:7.0},
  {nome:"Av. Arapongas", eixo:"x", pos:29, largura:9.2},
  {nome:"Rua Flamingos", eixo:"x", pos:-30, largura:7.0}
];

const el = id => document.getElementById(id);
// Retícula: ajuste VISUAL independente da posição/rotação da arma e da câmera.
// Valores em pixels, relativos ao centro do visor em paisagem.
const RETICLE_STORAGE_KEY='tio-urso-cruz-v089';
const RETICLE_DEFAULTS=Object.freeze({x:-15,y:-40});
let reticleAdjustments={...RETICLE_DEFAULTS};
try {
  const stored=JSON.parse(localStorage.getItem(RETICLE_STORAGE_KEY)||'null');
  if(stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)){
    reticleAdjustments.x=THREE.MathUtils.clamp(stored.x,-300,300);
    reticleAdjustments.y=THREE.MathUtils.clamp(stored.y,-200,200);
  }
}catch(e){console.warn('Retícula salva inválida',e);}
function saveReticleAdjustments(){
  try{localStorage.setItem(RETICLE_STORAGE_KEY,JSON.stringify(reticleAdjustments));}catch(e){}
}
function applyReticleAdjustments(){
  const cross=el('aim-crosshair'); if(!cross)return;
  cross.style.left='calc(50% + '+reticleAdjustments.x+'px)';
  cross.style.top='calc(50% + '+reticleAdjustments.y+'px)';
}
function enableReticleCalibration(){
  if(!RETICLE_ADJUST_MODE)return;
  const panel=document.createElement('aside');
  panel.id='reticle-calibration';
  panel.setAttribute('aria-label','Ajuste fino exclusivo da cruz de mira');
  panel.style.cssText='position:fixed;right:8px;top:14%;z-index:99999;width:min(290px,60vw);max-height:72vh;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;background:#071b2df2;border:1px solid #ffce63;color:white;border-radius:12px;padding:10px;box-shadow:0 6px 22px #0009;font:12px system-ui;';
  panel.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong>🎯 CRUZ DE MIRA · v0.9.0</strong><button id="reticle-toggle" type="button">−</button></div>
    <div id="reticle-body">
      <p style="font-size:11px;line-height:1.45;color:#dfebfa;margin:8px 0">Movimente a CRUZ na tela. O braço e os equipamentos calibrados não serão alterados.</p>
      <div id="reticle-values" style="padding:8px;background:#18354b;border-radius:7px;text-align:center;font-weight:700" aria-live="polite"></div>
      <label style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 5px">Passo
        <select id="reticle-step" style="padding:6px;border-radius:7px;background:#fff;color:#182937"><option value="2">2 px (fino)</option><option value="5" selected>5 px</option><option value="10">10 px</option><option value="20">20 px</option></select>
      </label>
      <div id="reticle-directions" style="display:grid;grid-template-columns:1fr 1fr;gap:6px"></div>
      <button id="reticle-start" type="button">🎯 Equipar pistola e mirar</button>
      <button id="reticle-reset" type="button">↺ Restaurar cruz no centro</button>
      <button id="reticle-copy" type="button">📋 Copiar ajuste da cruz</button>
      <textarea id="reticle-json" rows="5" readonly style="display:none;width:100%;box-sizing:border-box;margin-top:7px;background:#142e45;color:white;border:1px solid #a3cbd1;border-radius:6px;padding:6px;font-size:11px;"></textarea>
      <small id="reticle-message" style="display:block;margin-top:8px;color:#ffe2a3">Ajustes salvos automaticamente no navegador.</small>
    </div>`;
  document.body.append(panel);
  const style='color:#112639;background:#f3d579;border:0;border-radius:7px;padding:9px 5px;font-weight:700;min-height:37px;touch-action:manipulation;';
  const msg=panel.querySelector('#reticle-message');
  for(const btn of panel.querySelectorAll('button'))btn.style.cssText=style+'margin-top:5px;';
  for(const id of ['reticle-start','reticle-reset','reticle-copy'])panel.querySelector('#'+id).style.width='100%';
  const show=()=>{panel.querySelector('#reticle-values').textContent='Horizontal: '+reticleAdjustments.x+' px  |  Vertical: '+reticleAdjustments.y+' px';};
  const move=(axis,dir)=>{
    const step=Number(panel.querySelector('#reticle-step').value);
    const limit=axis==='x'?Math.min(300,window.innerWidth*.43):Math.min(200,window.innerHeight*.43);
    reticleAdjustments[axis]=THREE.MathUtils.clamp(reticleAdjustments[axis]+step*dir,-limit,limit);
    reticleAdjustments[axis]=Math.round(reticleAdjustments[axis]);
    applyReticleAdjustments();saveReticleAdjustments();show();
    msg.textContent='Cruz posicionada. Confirme olhando a rua à frente.';
  };
  const grid=panel.querySelector('#reticle-directions');
  for(const [label,axis,dir] of [['← Esquerda','x',-1],['Direita →','x',1],['↑ Subir','y',-1],['↓ Descer','y',1]]){
    const b=document.createElement('button');b.type='button';b.style.cssText=style;b.textContent=label;
    b.addEventListener('click',()=>move(axis,dir));grid.append(b);
  }
  panel.querySelector('#reticle-start').addEventListener('click',()=>{
    if(!started){msg.textContent='Primeiro toque em INICIAR PATRULHAMENTO.';return;}
    selectEquipment('arma');setAiming(true);
    msg.textContent='Mira ativada. Ajuste a cruz pelos botões.';
  });
  panel.querySelector('#reticle-reset').addEventListener('click',()=>{
    reticleAdjustments={...RETICLE_DEFAULTS};applyReticleAdjustments();saveReticleAdjustments();show();
    msg.textContent='Cruz restaurada ao centro. Os equipamentos não foram alterados.';
  });
  panel.querySelector('#reticle-copy').addEventListener('click',async()=>{
    const result=JSON.stringify({cruzMira:reticleAdjustments},null,2);
    const txt=panel.querySelector('#reticle-json');txt.value=result;
    try{await navigator.clipboard.writeText(result);msg.textContent='✅ Copiado! Envie este JSON na conversa.';txt.style.display='none';}
    catch(e){txt.style.display='block';txt.focus();txt.select();msg.textContent='Copie os valores no campo abaixo.';}
  });
  panel.querySelector('#reticle-toggle').addEventListener('click',()=>{
    const body=panel.querySelector('#reticle-body');body.hidden=!body.hidden;
    panel.querySelector('#reticle-toggle').textContent=body.hidden?'+':'−';
  });
  applyReticleAdjustments();show();
}


// v0.8.5: biblioteca de áudio otimizada para Android, sem alterar rigging,
// mira, posições aprovadas ou lógica de colisões/ataque.
// AudioContext é iniciado apenas por gesto do usuário (exigência do Chrome).
const SOUND_SPRITE = {"movimento_pistola":[0.25,0.542],"clique_pistola":[1.102,0.94],"disparo_previa":[2.352,1.881],"sirene":[4.543,1.896],"buzina_curta":[6.749,0.66],"buzina_classica":[7.719,0.558],"porta_carro":[8.587,0.711],"motor_ligar":[9.608,14.28]};
const SOUND_LABELS = [
  ['movimento_pistola','Movimento da pistola'],
  ['clique_pistola','Clique da pistola'],
  ['disparo_previa','Disparo (prévia, sem tiro no jogo)'],
  ['sirene','Sirene'],
  ['buzina_curta','Buzina curta'],
  ['buzina_classica','Buzina clássica'],
  ['porta_carro','Porta do carro'],
  ['motor_ligar','Partida do motor']
];
let audioContext=null, audioMaster=null, soundBuffers={}, audioLoad=null;
let audioEnabled=true, audioVolume=.70, audioLoops=[], audioPreviewSource=null;
// Passos provisórios: som criado no navegador sem depender de outro MP3.
// O tempo do efeito é guiado pela fase de Walking/Running do AnimationMixer.
let stepNoiseBuffer=null, stepLastMarker=null, stepLastAt=-100;
let actualStepIndex=0;
// Amostras de pisadas selecionadas no arquivo enviado (passos sobre calçada).
const REAL_STEP_SLICES=[[.07,.31],[.68,.31],[1.27,.31],[1.86,.31],[4.12,.34],[4.71,.34]];
function playFootstep(runningStep=false){
  if(!audioEnabled || !audioContext || !audioMaster || audioContext.state!=='running')return;
  // Usa primeiro a gravação real. Mantém sintetizador como reserva (offline/erro).
  if(soundBuffers.passos){
    const now=audioContext.currentTime;
    const [offset,duration]=REAL_STEP_SLICES[actualStepIndex++%REAL_STEP_SLICES.length];
    const src=audioContext.createBufferSource();
    src.buffer=soundBuffers.passos;
    src.playbackRate.value=runningStep?1.1:.88;
    const filter=audioContext.createBiquadFilter();filter.type='lowpass';
    filter.frequency.value=runningStep?2300:1750;
    const gain=audioContext.createGain();
    const dur=duration/src.playbackRate.value;
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.linearRampToValueAtTime(runningStep?.65:.50,now+.018);
    gain.gain.setValueAtTime(runningStep?.65:.50,now+Math.max(.02,dur-.045));
    gain.gain.linearRampToValueAtTime(.0001,now+dur);
    src.connect(filter);filter.connect(gain);gain.connect(audioMaster);
    src.start(now,offset,duration);
    return;
  }
  if(!stepNoiseBuffer){
    const sampleRate=audioContext.sampleRate;
    const n=Math.max(128,Math.floor(sampleRate*.11));
    stepNoiseBuffer=audioContext.createBuffer(1,n,sampleRate);
    const samples=stepNoiseBuffer.getChannelData(0);
    for(let i=0;i<n;i++){
      const t=i/n;
      samples[i]=(Math.random()*2-1)*Math.pow(1-t,2.8);
    }
  }
  const now=audioContext.currentTime;
  const source=audioContext.createBufferSource();source.buffer=stepNoiseBuffer;
  const filter=audioContext.createBiquadFilter();filter.type='lowpass';
  filter.frequency.value=runningStep?930:670;
  const g=audioContext.createGain();
  const level=runningStep?.21:.14;
  g.gain.setValueAtTime(.001,now);
  g.gain.exponentialRampToValueAtTime(level,now+.008);
  g.gain.exponentialRampToValueAtTime(.001,now+.115);
  source.connect(filter);filter.connect(g);g.connect(audioMaster);
  source.start(now);source.stop(now+.12);
  // Reforço grave leve, mais forte na corrida.
  const thump=audioContext.createOscillator();thump.type='sine';
  thump.frequency.setValueAtTime(runningStep?105:88,now);
  thump.frequency.exponentialRampToValueAtTime(55,now+.075);
  const tg=audioContext.createGain();tg.gain.setValueAtTime(.001,now);
  tg.gain.exponentialRampToValueAtTime(runningStep?.08:.05,now+.006);
  tg.gain.exponentialRampToValueAtTime(.001,now+.085);
  thump.connect(tg);tg.connect(audioMaster);
  thump.start(now);thump.stop(now+.09);
}
function syncFootsteps(speed,runningStep,blocking){
  if(speed<.48 || blocking){stepLastMarker=null;return;}
  if(!audioEnabled || !audioContext || audioContext.state!=='running')return;
  const action=runningStep?runAnim:walkAnim;
  if(!action || !animationMixer){
    // Reserva caso o personagem não tenha rig importado.
    const interval=runningStep?.29:.48;
    if(audioContext.currentTime-stepLastAt>interval){
      stepLastAt=audioContext.currentTime;playFootstep(runningStep);
    }
    return;
  }
  const clip=action.getClip();
  if(!clip?.duration)return;
  const stepIndex=Math.floor((action.time%clip.duration)/clip.duration*2);
  const marker=(runningStep?'R':'W')+stepIndex;
  if(stepLastMarker===null){stepLastMarker=marker;return;}
  if(marker!==stepLastMarker){
    stepLastMarker=marker;
    const now=audioContext.currentTime;
    if(now-stepLastAt>(runningStep?.17:.24)){
      stepLastAt=now;playFootstep(runningStep);
    }
  }
}

try {
  const cfg=JSON.parse(localStorage.getItem('tio-urso-audio-v085')||'{}');
  if(typeof cfg.enabled==='boolean')audioEnabled=cfg.enabled;
  if(Number.isFinite(cfg.volume))audioVolume=Math.min(1,Math.max(0,cfg.volume));
}catch(e){}
function saveAudioPrefs(){
  try{localStorage.setItem('tio-urso-audio-v085',JSON.stringify({enabled:audioEnabled,volume:audioVolume}));}catch(e){}
}
function updateAudioButtons(){
  const b=el('audio-button'),t=el('audio-onoff'),s=el('audio-volume');
  if(b)b.textContent=audioEnabled?'🔊':'🔇';
  if(t)t.textContent=audioEnabled?'🔇 Silenciar':'🔊 Ativar sons';
  if(s)s.value=String(Math.round(audioVolume*100));
}
function applyAudioGain(){
  if(audioContext&&audioMaster){
    audioMaster.gain.setTargetAtTime(audioEnabled?audioVolume:0,audioContext.currentTime,.03);
  }
  updateAudioButtons();saveAudioPrefs();
}
async function initializeAudio(){
  if(!audioEnabled)return;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  if(!audioContext){
    audioContext=new AC();
    audioMaster=audioContext.createGain();
    audioMaster.gain.value=audioEnabled?audioVolume:0;
    audioMaster.connect(audioContext.destination);
  }
  // Retomar dentro do gesto, antes de qualquer await.
  if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  if(audioLoad)return audioLoad;
  const entries=[['fx','efeitos.mp3'],['rua','ambiente-rua.mp3'],['pessoas','ambiente-pessoas.mp3'],['passos','passos-calcada.mp3']];
  audioLoad=Promise.all(entries.map(async ([key,file])=>{
    try{
      const resp=await fetch('./'+file);
      if(!resp.ok)throw new Error('Som indisponível: '+file);
      const ab=await resp.arrayBuffer();
      soundBuffers[key]=await audioContext.decodeAudioData(ab);
    }catch(err){
      if(key==='passos'){
        console.warn('Sem áudio real de passos; mantendo efeito sintetizado:',err);
        return;
      }
      throw err;
    }
  })).then(()=>{
    if(started)startAmbience();
    const status=el('audio-status');
    if(status)status.textContent='Áudio carregado • efeitos prontos para testar';
  }).catch(err=>{
    console.warn('Não foi possível carregar a biblioteca de áudio:',err);
    const status=el('audio-status');
    if(status)status.textContent='Falha no áudio; confira se os 3 arquivos MP3 estão no GitHub.';
    audioLoad=null;
  });
  return audioLoad;
}
function startAmbience(){
  if(!audioContext||audioLoops.length)return;
  for(const [key,volume] of [['rua',.24],['pessoas',.12]]){
    if(!soundBuffers[key])continue;
    const src=audioContext.createBufferSource();
    const gain=audioContext.createGain();
    gain.gain.value=volume;src.buffer=soundBuffers[key];src.loop=true;
    src.connect(gain);gain.connect(audioMaster);src.start();audioLoops.push(src);
  }
}
function playGameSound(name,volume=.65){
  if(!audioEnabled||!audioContext||!soundBuffers.fx||!SOUND_SPRITE[name])return;
  const [start,duration]=SOUND_SPRITE[name];
  const src=audioContext.createBufferSource();
  const gain=audioContext.createGain();gain.gain.value=volume;
  src.buffer=soundBuffers.fx;src.connect(gain);gain.connect(audioMaster);
  // Para previews, interromper o último efeito antes de reproduzir outro.
  if(name==='motor_ligar' && audioPreviewSource){try{audioPreviewSource.stop();}catch(e){}}
  src.start(0,start,Math.max(.07,duration-.025));
  return src;
}
function installAudioPanel(){
  const panel=el('audio-panel');
  if(!panel)return;
  el('audio-button').addEventListener('click',()=>{panel.hidden=!panel.hidden;updateAudioButtons();});
  el('audio-close').addEventListener('click',()=>panel.hidden=true);
  el('audio-onoff').addEventListener('click',()=>{
    audioEnabled=!audioEnabled;applyAudioGain();
    if(audioEnabled)initializeAudio();
  });
  el('audio-volume').addEventListener('input',e=>{
    audioVolume=Math.max(0,Math.min(1,Number(e.target.value)/100));applyAudioGain();
  });
  const list=el('audio-previews');
  for(const [key,label] of SOUND_LABELS){
    const button=document.createElement('button');button.type='button';
    button.textContent='▶ '+label;
    button.addEventListener('click',()=>{
      if(!audioEnabled){audioEnabled=true;applyAudioGain();}
      initializeAudio().then(()=>{audioPreviewSource=playGameSound(key,key==='disparo_previa'?.30:.65);});
    });
    list.append(button);
  }
  const stepsButton=document.createElement('button');
  stepsButton.type='button';stepsButton.textContent='▶ Passos na calçada (teste)';
  stepsButton.addEventListener('click',()=>{
    if(!audioEnabled){audioEnabled=true;applyAudioGain();}
    initializeAudio().then(()=>{
      playFootstep(false);
      window.setTimeout(()=>playFootstep(true),300);
    });
  });
  list.append(stepsButton);
  updateAudioButtons();
}

const mount = el('view');
let renderer, scene, camera, clock, player, characterModel;
let started = false, ready = false, ignorePortrait = false;
let xp = 0, talked = new Set(), toastUntil = 0;
let walking = false, runHeld = false, camYaw = Math.PI;
// Câmera orbital: movimentação vertical disponível para mirar futuramente.
let camPitch = .26;
const CAM_PITCH_MIN = -.32, CAM_PITCH_MAX = .85;
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
// Spawn real narrativo: calçada diante da Central, R. Eurilemos, 530.
// Coordenadas de jogo provisórias, até aferir a quadra por imagem aérea.
const playerPos = new THREE.Vector3(-5.25,0,-6.5);
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
let rightUpperArm=null, rightForeArm=null;
// Referências capturadas UMA ÚNICA VEZ em repouso. Nunca usar a pose já
// modificada como ponto de partida no quadro seguinte.
// Postura definitiva é calculada no carregamento, a partir do repouso original.
// Nunca é recalculada dentro de update(), evitando realimentação do movimento.
let aimRestUpper=null, aimRestForearm=null;
let aimFixedUpper=null, aimFixedForearm=null;
const aimArmAxis = new THREE.Vector3(0,1,0);
const aimTargetLocalUpper = new THREE.Vector3(-.12,-.12,1).normalize();
const aimTargetLocalFore = new THREE.Vector3(-.04,.015,1).normalize();
const aimTmpParent = new THREE.Quaternion();
const aimTmpDir = new THREE.Vector3();
const aimTmpAxis = new THREE.Vector3();
const aimTmpDelta = new THREE.Quaternion();
const aimTmpCharacter = new THREE.Quaternion();

// Alvo quaternion local a partir de um vetor fixo no espaço do PERSONAGEM.
// O alvo NÃO depende do quadro anterior, da posição da câmera, nem da
// animação de corrida/repouso. Uma vez calculado, nunca muda.
function computeAimQuaternion(bone,rest,desiredInCharacter){
  if(!bone || !rest)return null;
  characterModel.getWorldQuaternion(aimTmpCharacter);
  aimTmpDir.copy(desiredInCharacter).applyQuaternion(aimTmpCharacter);
  bone.parent.getWorldQuaternion(aimTmpParent);
  aimTmpDir.applyQuaternion(aimTmpParent.invert()).normalize();
  // No rig exportado os filhos dos braços ficam ao longo de Y local.
  // Ler a direção REAL do próximo osso protege contra um GLB diferente.
  const child=bone.children.find(ch=>ch.isBone);
  aimTmpAxis.copy(child && child.position.lengthSq()>1e-7 ? child.position : aimArmAxis)
    .normalize().applyQuaternion(rest).normalize();
  aimTmpDelta.setFromUnitVectors(aimTmpAxis,aimTmpDir);
  return aimTmpDelta.multiply(rest).normalize().clone();
}
function prepareFixedAimPose(){
  if(!rightUpperArm || !rightForeArm || !aimRestUpper || !aimRestForearm)return;
  characterModel.updateWorldMatrix(true,true);
  aimFixedUpper=computeAimQuaternion(rightUpperArm,aimRestUpper,aimTargetLocalUpper);
  if(!aimFixedUpper)return;
  // Atualizar apenas temporariamente para obter o referencial correto do cotovelo.
  rightUpperArm.quaternion.copy(aimFixedUpper);
  rightUpperArm.updateWorldMatrix(true,true);
  aimFixedForearm=computeAimQuaternion(rightForeArm,aimRestForearm,aimTargetLocalFore);
  // Restaura a pose original antes que o AnimationMixer comece a renderizar.
  rightUpperArm.quaternion.copy(aimRestUpper);
  rightForeArm.quaternion.copy(aimRestForearm);
  characterModel.updateWorldMatrix(true,true);
  console.info('v0.8.2: pose FIXA de mira criada uma única vez; sem giro por frame.');
}
// Coordenadas da arma: no GLB fornecido o cano aponta para -X e a
// vertical do modelo para +Y. Em vez de editar Euler XYZ sobre um Y=-120°
// (eixos X/Z quase sobrepostos na tela), calibramos em torno dos eixos
// fixos do PERSONAGEM: inclinação do cano (X), direção lateral (Y),
// torção do cano (Z). O resultado é transformado UMA vez para a mão
// direita com a pose de mira estável já aprovada na v0.8.2.
let aimCharacterToHand = null;
const gunForwardAlignment = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0,1,0), Math.PI/2);
const aimAxisX=new THREE.Vector3(1,0,0);
const aimAxisY=new THREE.Vector3(0,1,0);
const aimAxisZ=new THREE.Vector3(0,0,1);
const aimQYaw=new THREE.Quaternion();
const aimQPitch=new THREE.Quaternion();
const aimQRoll=new THREE.Quaternion();
const aimQuaternion=new THREE.Quaternion();
function preparePistolAimFrame(){
  if(!characterModel || !rightUpperArm || !rightForeArm || !pistolHandSocket ||
     !aimFixedUpper || !aimFixedForearm)return;
  // Preparação feita só durante o carregamento, antes dos quadros do jogo.
  const keepUpper=rightUpperArm.quaternion.clone();
  const keepFore=rightForeArm.quaternion.clone();
  rightUpperArm.quaternion.copy(aimFixedUpper);
  rightForeArm.quaternion.copy(aimFixedForearm);
  characterModel.updateWorldMatrix(true,true);
  const handWorld=pistolHandSocket.getWorldQuaternion(new THREE.Quaternion());
  const charWorld=characterModel.getWorldQuaternion(new THREE.Quaternion());
  aimCharacterToHand=handWorld.invert().multiply(charWorld).normalize();
  rightUpperArm.quaternion.copy(keepUpper);
  rightForeArm.quaternion.copy(keepFore);
  characterModel.updateWorldMatrix(true,true);
  console.info('v0.8.3: base de mira fixa calculada; cano -X -> +Z.');
}
function getPistolAimQuaternion(angles){
  if(!aimCharacterToHand)return null;
  // Ordem extrínseca explícita: guinada Y, elevação X, rolagem Z.
  // Cada botão altera UM parâmetro independente do ângulo Euler da arma.
  aimQYaw.setFromAxisAngle(aimAxisY,THREE.MathUtils.degToRad(angles.yaw));
  // Pitch positivo = subir o cano (+Y), invertendo sinal de RX físico.
  aimQPitch.setFromAxisAngle(aimAxisX,-THREE.MathUtils.degToRad(angles.pitch));
  aimQRoll.setFromAxisAngle(aimAxisZ,THREE.MathUtils.degToRad(angles.roll));
  return aimQuaternion.copy(aimCharacterToHand)
    .multiply(aimQYaw).multiply(aimQPitch).multiply(aimQRoll)
    .multiply(gunForwardAlignment).normalize();
}
let pistolModel=null, pistolAssetLoaded=false;
let pistolHolsterSocket=null, pistolHandSocket=null;
let aiming=false, aimBlend=0, lastAimCheck=0;
const aimRaycaster=new THREE.Raycaster();
aimRaycaster.far=90;
const aimColliders=[];
const aimTargetPoint=new THREE.Vector3();

let contactShadow = null, sunLight = null, pawBadge = null;
// Ajustes são DESLOCAMENTOS LOCAIS a partir da posição atual do emblema.
// Assim o jogador pode calibrar sem mexer no esqueleto ou no colete GLB.
const PAW_STORAGE_KEY='tio-urso-pata-v088';
// Ajuste aprovado no celular pelo usuário, fixado como novo padrão.
const PAW_DEFAULTS=Object.freeze({x:0,y:-.08,z:0,rx:-10,ry:0,rz:0,escala:1});
let pawAdjustments={...PAW_DEFAULTS};
let pawBasePosition=null,pawBaseQuaternion=null;
try{
  const saved=JSON.parse(localStorage.getItem(PAW_STORAGE_KEY)||'null');
  if(saved && typeof saved==='object'){
    for(const k of Object.keys(PAW_DEFAULTS)){
      if(Number.isFinite(saved[k]))pawAdjustments[k]=saved[k];
    }
  }
}catch(e){console.warn('Ajuste da pata salvo inválido',e);}
function savePawAdjustments(){
  try{localStorage.setItem(PAW_STORAGE_KEY,JSON.stringify(pawAdjustments));}catch(e){}
}
function applyPawAdjustments(){
  if(!pawBadge || !pawBasePosition || !pawBaseQuaternion)return;
  const a=pawAdjustments;
  pawBadge.position.copy(pawBasePosition).add(new THREE.Vector3(a.x,a.y,a.z));
  const rot=new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(a.rx),THREE.MathUtils.degToRad(a.ry),
    THREE.MathUtils.degToRad(a.rz),'XYZ'));
  pawBadge.quaternion.copy(pawBaseQuaternion).multiply(rot).normalize();
  pawBadge.scale.setScalar(a.escala);
}
function enablePawCalibration(){
  if(!PAW_ADJUST_MODE)return;
  const panel=document.createElement('aside');
  panel.id='paw-calibration';
  panel.setAttribute('aria-label','Ajuste fino do emblema nas costas do Tio Urso');
  panel.style.cssText='position:fixed;right:8px;top:14%;z-index:99999;width:min(290px,59vw);max-height:73vh;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;padding:11px;background:rgba(8,25,39,.95);color:white;border:1px solid #f9c45c;border-radius:12px;font:12px system-ui;box-shadow:0 5px 20px #0008;';
  panel.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <b>🐾 AJUSTE DA PATA · v0.8.7</b>
      <button id="paw-collapse" type="button" style="background:#30506a;color:white;border-radius:6px;padding:6px 10px;">−</button>
    </div>
    <div id="paw-body">
      <small style="display:block;margin:8px 0;color:#c9dfe8">Ajuste somente o emblema. Gire a câmera para ver se está rente ao colete.</small>
      <div id="paw-values" style="padding:7px;background:#0b3046;border-radius:6px;line-height:1.7;margin:6px 0" aria-live="polite"></div>
      <label style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin:7px 0">Passo da posição
        <select id="paw-pos-step" style="padding:5px;color:#101b27;background:white;border-radius:5px"><option value="0.005">0,005 fino</option><option value="0.01" selected>0,010</option><option value="0.025">0,025</option></select>
      </label>
      <div style="font-weight:bold;margin:8px 0 4px">↔ POSIÇÃO XYZ</div>
      <div id="paw-positions" style="display:grid;grid-template-columns:1fr 1fr;gap:5px"></div>
      <label style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin:12px 0 4px">Giro em graus
        <select id="paw-rot-step" style="padding:5px;color:#101b27;background:white;border-radius:5px"><option value="1">1° fino</option><option value="5" selected>5°</option><option value="15">15°</option></select>
      </label>
      <div style="font-weight:bold;margin:6px 0 4px">↻ ROTAÇÃO XYZ</div>
      <div id="paw-rotations" style="display:grid;grid-template-columns:1fr 1fr;gap:5px"></div>
      <div style="font-weight:bold;margin:10px 0 4px">📏 TAMANHO DO EMBLEMA</div>
      <div id="paw-size" style="display:grid;grid-template-columns:1fr 1fr;gap:5px"></div>
      <button id="paw-reset" type="button" class="paw-secondary">Restaurar ajuste da pata</button>
      <button id="paw-copy" type="button" class="paw-secondary">📋 Copiar meus ajustes</button>
      <textarea id="paw-json" readonly rows="6" style="display:none;width:100%;box-sizing:border-box;background:#16394d;color:#fff;border:1px solid #7aa5b6;border-radius:7px;margin-top:7px;padding:7px;font-size:11px;user-select:text;" aria-label="Valores da pata para copiar manualmente"></textarea>
      <small id="paw-message" role="status" style="display:block;margin:7px 0;color:#ffe0a0">As alterações são salvas automaticamente neste navegador.</small>
    </div>`;
  document.body.append(panel);
  const text=panel.querySelector('#paw-message'),readout=panel.querySelector('#paw-values');
  for(const btn of panel.querySelectorAll('.paw-secondary')){
    btn.style.cssText='display:block;width:100%;padding:9px;margin:7px 0 0;border-radius:7px;background:#34536b;color:#fff;border:1px solid #819bac;';
  }
  const show=()=>{
    const a=pawAdjustments;
    readout.textContent=`Posição X ${a.x.toFixed(3)} · Y ${a.y.toFixed(3)} · Z ${a.z.toFixed(3)} | Giro X ${a.rx.toFixed(1)}° · Y ${a.ry.toFixed(1)}° · Z ${a.rz.toFixed(1)}° | Tamanho ${(a.escala*100).toFixed(0)}%`;
  };
  const adjust=(key,delta)=>{
    const a=pawAdjustments;
    if(key==='escala')a[key]=Math.round(THREE.MathUtils.clamp(a[key]+delta,.25,2)*100)/100;
    else if(key.startsWith('r'))a[key]=Math.round((a[key]+delta)*100)/100;
    else a[key]=Math.round(THREE.MathUtils.clamp(a[key]+delta,-.6,.6)*1000)/1000;
    applyPawAdjustments();savePawAdjustments();show();
    text.textContent='Salvo. Gire a câmera e confira todos os ângulos.';
  };
  const addButton=(area,label,key,dir,mode)=>{
    const b=document.createElement('button');b.type='button';b.textContent=label;
    b.style.cssText='min-height:35px;padding:7px 4px;color:#112539;background:#f5d47b;border:0;border-radius:6px;font:12px system-ui;';
    b.addEventListener('click',()=>{
      const step=mode==='pos'?Number(panel.querySelector('#paw-pos-step').value):
        mode==='rot'?Number(panel.querySelector('#paw-rot-step').value):.05;
      adjust(key,step*dir);
    });
    area.append(b);
  };
  const pos=panel.querySelector('#paw-positions');
  for(const [label,key] of [['Lado','x'],['Altura','y'],['Profundidade','z']]){
    addButton(pos,label+' −',key,-1,'pos');addButton(pos,label+' +',key,1,'pos');
  }
  const rot=panel.querySelector('#paw-rotations');
  for(const [label,key] of [['Inclinar X','rx'],['Virar Y','ry'],['Torcer Z','rz']]){
    addButton(rot,label+' −',key,-1,'rot');addButton(rot,label+' +',key,1,'rot');
  }
  const size=panel.querySelector('#paw-size');
  addButton(size,'Menor −','escala',-1,'size');addButton(size,'Maior +','escala',1,'size');
  panel.querySelector('#paw-reset').addEventListener('click',()=>{
    pawAdjustments={...PAW_DEFAULTS};applyPawAdjustments();savePawAdjustments();show();
    text.textContent='Pata restaurada. Outros acessórios não foram alterados.';
  });
  panel.querySelector('#paw-copy').addEventListener('click',async()=>{
    const data=JSON.stringify({pataCostas:pawAdjustments},null,2);
    const input=panel.querySelector('#paw-json');input.value=data;
    try{await navigator.clipboard.writeText(data);text.textContent='✅ Valores copiados! Cole na conversa.';input.style.display='none';}
    catch(e){input.style.display='block';input.focus();input.select();text.textContent='Selecione e copie os valores mostrados abaixo.';}
  });
  panel.querySelector('#paw-collapse').addEventListener('click',()=>{
    const body=panel.querySelector('#paw-body');body.hidden=!body.hidden;
    panel.querySelector('#paw-collapse').textContent=body.hidden?'+':'−';
  });
  show();
}

const accessoryWorldOffset = new THREE.Vector3();
const shadowAnchor = new THREE.Vector3();
const sunlightOffset = new THREE.Vector3(-12,25,-10);
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
// Em paisagem, a câmera chega mais perto da altura dos ombros.
const CAM_DISTANCE_WIDE = 1.92;
const CAM_DISTANCE_TALL = 2.48;
const CAM_TARGET_HEIGHT = 1.30;


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
function road(x,z,w,d){const asphalt=box(w,.025,d,0x39444c,x,.025,z);asphalt.receiveShadow=true;}
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
  // Contato suave sob o corpo: luz real complementa e projeta os movimentos.
  m.material.opacity=.36;
  m.position.y=.004;
  m.renderOrder=1;
  contactShadow=m;
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
  pistolModel = new THREE.Group();
  pistolModel.visible = false;
  pistolHolsterSocket = new THREE.Group();
  pistolHandSocket = new THREE.Group();
  rightHolster.add(pistolHolsterSocket);

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
// Separado do armazenamento das quatro calibrações anteriores.
const PISTOL_ADJUST_KEY='tio-urso-mira-v083';
const AIM_ROTATION = ['pitch','yaw','roll'];
const PISTOL_NAMES=['pistolaNoColdre','pistolaDescanso','pistolaMira'];
// Os DOIS ajustes de pistola já aprovados pelo jogador não podem ser
// alterados no painel. A mira NÃO reutiliza o valor antigo (bug helicóptero).
const PISTOL_REST_HOLSTER = Object.freeze({x:-0.025,y:-0.001,z:0,rx:0,ry:-180,rz:85});
const PISTOL_REST_HAND = Object.freeze({x:-0.037,y:0.195,z:-0.049,rx:-35,ry:-120,rz:-105});
// Inicia a mira com a orientação da empunhadura aprovada: sem girar 3 eixos
// simultaneamente para uma calibração inválida. O jogador ajustará só a mira.
const pistolDefaults={
  pistolaNoColdre:PISTOL_REST_HOLSTER,
  pistolaDescanso:PISTOL_REST_HAND,
  pistolaMira:Object.freeze({x:-0.012,y:0.195,z:-0.049,pitch:0,yaw:5,roll:-10})
};
let pistolAdjustments={};
function loadPistolAdjustments(){
  // Nunca alterar os dois encaixes que o usuário já aprovou.
  pistolAdjustments.pistolaNoColdre={...PISTOL_REST_HOLSTER};
  pistolAdjustments.pistolaDescanso={...PISTOL_REST_HAND};
  let saved={}, legacy={};
  try{saved=JSON.parse(localStorage.getItem(PISTOL_ADJUST_KEY)||'{}')||{};}catch(e){}
  // Preservar somente eventual posição XYZ já acertada em 0.8.2.
  // As rotações Euler antigas eram ambíguas e NÃO serão importadas.
  try{legacy=JSON.parse(localStorage.getItem('tio-urso-mira-v082')||'{}')||{};}catch(e){}
  const existing=saved.pistolaMira || {};
  const previousPos=(saved.pistolaMira? existing:legacy.pistolaMira)||{};
  const def=pistolDefaults.pistolaMira;
  pistolAdjustments.pistolaMira={};
  for(const axis of AXES_POSITION){
    pistolAdjustments.pistolaMira[axis]=Number.isFinite(previousPos[axis])
      ? THREE.MathUtils.clamp(previousPos[axis],-1.5,2):def[axis];
  }
  for(const axis of AIM_ROTATION){
    pistolAdjustments.pistolaMira[axis]=Number.isFinite(existing[axis])
      ? normalizeAngleDegrees(existing[axis]):def[axis];
  }
}

function savePistolAdjustments(){
  // Nunca sobrescrever os dois estados fixos no armazenamento.
  try{localStorage.setItem(PISTOL_ADJUST_KEY,JSON.stringify({pistolaMira:pistolAdjustments.pistolaMira}));}catch(e){}
}
function calibValue(name){return PISTOL_NAMES.includes(name)?pistolAdjustments[name]:accessoryAdjustments[name];}
function calibDefault(name){return PISTOL_NAMES.includes(name)?pistolDefaults[name]:accessoryDefaults[name];}
function saveCalibrations(){saveAccessoryAdjustments();savePistolAdjustments();}

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
loadPistolAdjustments();
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
  applyPistolPlacement();
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
  rightUpperArm=findRigBone(characterModel,'mixamorig:RightArm');
  rightForeArm=findRigBone(characterModel,'mixamorig:RightForeArm');
  hipBone=findRigBone(characterModel,'mixamorig:Hips');
  if(!rightHandBone || !hipBone){
    tonfaAttachedToHand=false;
    console.warn('Rig ausente; não posicionar acessórios flutuando.');
    return false;
  }
  tonfaAttachedToHand=true;
  // A pose absoluta de mira parte da postura de descanso do próprio rig.
  // animationMixer.update(0) aplica o idle uma vez, sem mover as animações.
  if(animationMixer)animationMixer.update(0);
  aimRestUpper=rightUpperArm?.quaternion.clone() || null;
  aimRestForearm=rightForeArm?.quaternion.clone() || null;
  prepareFixedAimPose();
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
  rightHandBone.add(pistolHandSocket);
  preparePistolAimFrame();
  console.info('v0.7.7: coldre e tonfa guardada ancorados ao quadril animado.');
  // Apenas encaixe da peça — sem forçar rotação do punho nem dedos do urso.
  tonfaHandSocket.position.set(-.015,.085,.024);
  tonfaHandSocket.rotation.set(.04,0,-.12);
  rightHolster.visible=false;
  applyBeltPlacement();
  refreshTonfaState();
  loadDetailedBeltAssets();
  loadPistolAsset();
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
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;}});
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
    rightHolster.add(pistolHolsterSocket);
    refreshPistolState();
    rightHolster.visible=true;
  },undefined,error=>{
    rightHolster.visible=false;
    console.warn('Não foi possível carregar coldre.glb.',error);
  });
}

// A MESMA pistola 3D fica no coldre ou na mão; nenhum duplicado na cena.
function applyPistolPlacement(){
  if(!pistolModel || !pistolModel.parent)return;
  const inHand=pistolModel.parent===pistolHandSocket;
  const base=inHand?PISTOL_REST_HAND:PISTOL_REST_HOLSTER;
  const aim=pistolAdjustments.pistolaMira;
  const t=inHand?THREE.MathUtils.clamp(aimBlend,0,1):0;
  pistolModel.position.set(
    THREE.MathUtils.lerp(base.x,aim.x,t),
    THREE.MathUtils.lerp(base.y,aim.y,t),
    THREE.MathUtils.lerp(base.z,aim.z,t)
  );
  // A mão em DESCANSO conserva EXATAMENTE a calibração aprovada.
  const q0=new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(base.rx),THREE.MathUtils.degToRad(base.ry),
    THREE.MathUtils.degToRad(base.rz),'XYZ'));
  const qAim=inHand?getPistolAimQuaternion(aim):null;
  pistolModel.quaternion.copy(q0);
  if(qAim)pistolModel.quaternion.slerp(qAim,t).normalize();

}
function refreshPistolState(){
  if(!pistolModel || !pistolHandSocket || !pistolHolsterSocket)return;
  // No gameplay normal a pistola permanece guardada e o tiro bloqueado.
  const inHand=equipped==='arma' && FIREARM_TEST_MODE && pistolAssetLoaded;
  const parent=inHand?pistolHandSocket:pistolHolsterSocket;
  if(pistolModel.parent!==parent)parent.add(pistolModel);
  pistolModel.visible=pistolAssetLoaded;
  applyPistolPlacement();
  const aimButton=el('aim-button');
  if(aimButton)aimButton.hidden=!inHand;
  const cross=el('aim-crosshair');
  if(cross)cross.hidden=!(inHand && aiming);
  if(!inHand) aiming=false;
}
function loadPistolAsset(){
  new GLTFLoader().load(PISTOL_FILE,gltf=>{
    if(!pistolModel || !characterModel)return;
    const item=normalizeAccessoryScene(gltf.scene,.235,'pistol');
    pistolModel.clear();pistolModel.add(item);
    pistolAssetLoaded=true;
    refreshPistolState();
    console.info('Pistola Meshy texturizada carregada: coldre e mão usam a mesma peça.');
  },undefined,error=>{
    pistolAssetLoaded=false;
    console.warn('Falha ao carregar pistola.glb',error);
    notify('Não encontrei pistola.glb: confira se foi enviado ao GitHub.',5000);
  });
}
function setAiming(value){
  if(equipped!=='arma' || !FIREARM_TEST_MODE || !pistolAssetLoaded){aiming=false;return;}
  aiming=Boolean(value);
  const button=el('aim-button');
  if(button){button.classList.toggle('pressed',aiming);button.textContent=aiming?'🎯 MIRANDO':'🎯 MIRAR';}
  refreshPistolState();
}
function updateAimReticle(dt){
  const available=equipped==='arma'&&aiming&&FIREARM_TEST_MODE;
  const cross=el('aim-crosshair');
  if(cross)cross.hidden=!available;
  if(!available)return;
  lastAimCheck+=dt;
  if(lastAimCheck<.12)return;
  lastAimCheck=0;
  // A cruz marca o ponto onde um disparo SIMULADO orientado pelo centro
  // da câmera encontraria o cenário. Ainda não há tiro nem dano.
  camera.updateMatrixWorld();
  // Converter o deslocamento da cruz da tela para coordenadas NDC, para
  // a prévia do raycast corresponder ao ponto calibrado (sem disparos reais).
  const ndcX=reticleAdjustments.x*2/Math.max(1,mount.clientWidth);
  const ndcY=-reticleAdjustments.y*2/Math.max(1,mount.clientHeight);
  aimRaycaster.setFromCamera(new THREE.Vector2(ndcX,ndcY),camera);
  const hits=aimRaycaster.intersectObjects(aimColliders,false);
  if(hits.length){
    aimTargetPoint.copy(hits[0].point);
    // Retícula sem legenda, conforme solicitado; somente marcador central.
  } // Nenhum texto abaixo da retícula.
}

// Ajuste fino opcional pelo telefone: abra ?ajuste=1.
// Permite corrigir poucos centímetros sem remontar ou reenviar o jogo.
function enableAccessoryCalibration(){
  if(!FIREARM_TEST_MODE || PAW_ADJUST_MODE || RETICLE_ADJUST_MODE)return;
  const panel=document.createElement('aside');
  panel.id='accessory-calibration';
  panel.setAttribute('aria-label','Ajuste fino exclusivo de mira da pistola');
  panel.style.cssText='position:fixed;right:8px;top:14%;z-index:99999;width:min(256px,61vw);max-height:72vh;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;padding:10px;background:rgba(8,25,39,.94);color:white;border:1px solid #f9c45c;border-radius:12px;font:12px system-ui;box-shadow:0 5px 20px #0006;';
  panel.innerHTML=`
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
      <b>AJUSTE DA MIRA · 0.8.3</b>
      <button type="button" id="cal-collapse" aria-label="Recolher painel" style="padding:3px 7px;color:#fff;background:#304e65;border-radius:5px">−</button>
    </div>
    <div id="cal-body">
      <div style="margin:8px 0;color:#cbe5ef">Somente <b>Pistola • Mira</b> pode ser modificada. Todos os outros encaixes estão preservados.</div>
      <button id="cal-preview" type="button" class="cal-secondary">🎯 Preparar mira estável</button>
      <div id="cal-readout" aria-live="polite" style="font-size:11px;line-height:1.6;margin:8px 0"></div>
      <details open><summary style="font-weight:700;padding:5px 0;cursor:pointer">↔ POSIÇÃO XYZ</summary>
        <div id="cal-pos-buttons" style="display:grid;grid-template-columns:1fr 1fr;gap:4px"></div>
        <button id="cal-reset-pos" type="button" class="cal-secondary">Restaurar só posição da mira</button>
      </details>
      <details open><summary style="font-weight:700;padding:6px 0;cursor:pointer">↻ ORIENTAÇÃO DO CANO</summary>
        <small style="display:block;opacity:.85;margin:2px 0 4px">Comandos independentes da rotação original do Meshy.</small>
        <label style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin:5px 0">Passo do giro
          <select id="cal-step" style="padding:5px;color:#111;background:white;border-radius:5px">
            <option value="1">1° (fino)</option><option value="5" selected>5°</option><option value="15">15°</option>
          </select>
        </label>
        <div id="cal-rot-buttons" style="display:grid;grid-template-columns:1fr 1fr;gap:4px"></div>
        <button id="cal-rotate-back" type="button" class="cal-secondary">Virar cano 180°</button>
        <button id="cal-reset-rot" type="button" class="cal-secondary">Restaurar orientação da mira</button>
      </details>
      <button id="cal-copy" type="button" class="cal-secondary">Copiar posição e orientação da mira</button>
      <small style="display:block;margin-top:5px;opacity:.85">Somente a mira é salva; os seis encaixes aprovados permanecem intactos.</small>
      <small id="cal-message" role="status" style="display:block;min-height:12px;margin-top:4px;color:#ffe19b"></small>
    </div>`;
  document.body.append(panel);
  for(const btn of panel.querySelectorAll('.cal-secondary')){
    btn.style.cssText='display:block;width:100%;margin-top:6px;padding:6px 3px;border-radius:5px;background:#384e62;color:white;border:1px solid #8195a2;font-size:11px;';
  }
  const readout=panel.querySelector('#cal-readout');
  const message=panel.querySelector('#cal-message');
  const show=()=>{
    const p=pistolAdjustments.pistolaMira;
    readout.innerHTML=`<b>PISTOLA • MIRA</b><br>Posição: X ${p.x.toFixed(3)} · Y ${p.y.toFixed(3)} · Z ${p.z.toFixed(3)}<br>Cano ↑↓ ${p.pitch.toFixed(1)}° · Lados ↔ ${p.yaw.toFixed(1)}° · Torção ⟳ ${p.roll.toFixed(1)}°`;
  };
  panel.querySelector('#cal-preview').addEventListener('click',()=>{
    if(!started){message.textContent='Primeiro toque em INICIAR PATRULHAMENTO.';return;}
    if(!pistolAssetLoaded){message.textContent='Aguarde carregar o GLB da pistola.';return;}
    if(equipped!=='arma')selectEquipment('arma');
    if(equipped!=='arma'){message.textContent='Não foi possível equipar a pistola.';return;}
    setAiming(true);
    message.textContent='Mira estável. Use Cano ↑↓, Apontar ↔ e Torcer ⟳ para orientar a pistola.';
  });
  const change=(axis,delta)=>{
    const p=pistolAdjustments.pistolaMira;
    p[axis]=AIM_ROTATION.includes(axis)?normalizeAngleDegrees(p[axis]+delta)
      :Math.round(THREE.MathUtils.clamp(p[axis]+delta,-1.5,2)*1000)/1000;
    applyPistolPlacement();savePistolAdjustments();show();
  };
  const addButton=(parent,name,axis,dir,isRotation)=>{
    const btn=document.createElement('button');btn.type='button';btn.textContent=name;
    btn.style.cssText='min-height:33px;padding:5px 2px;color:#0d2133;background:#f5d47b;border-radius:5px;font:12px system-ui;';
    btn.addEventListener('click',()=>change(axis,(isRotation?Number(panel.querySelector('#cal-step').value):.025)*dir));
    parent.append(btn);
  };
  const pos=panel.querySelector('#cal-pos-buttons');
  for(const [name,axis] of [['Lado','x'],['Altura','y'],['Frente','z']]){
    addButton(pos,`${name} −`,axis,-1,false);addButton(pos,`${name} +`,axis,1,false);
  }
  const rot=panel.querySelector('#cal-rot-buttons');
  // Botões com significado concreto: não exigem adivinhar Euler XYZ.
  for(const [label,axis,dir] of [
    ['Cano ↓','pitch',-1],['Cano ↑','pitch',1],
    ['Apontar ←','yaw',-1],['Apontar →','yaw',1],
    ['Torcer ↻','roll',-1],['Torcer ↺','roll',1]
  ])addButton(rot,label,axis,dir,true);
  panel.querySelector('#cal-rotate-back').addEventListener('click',()=>change('yaw',180));
  const resetAxes=axes=>{
    for(const axis of axes)pistolAdjustments.pistolaMira[axis]=pistolDefaults.pistolaMira[axis];
    applyPistolPlacement();savePistolAdjustments();show();
    message.textContent='Restaurado apenas o ajuste da mira.';
  };
  panel.querySelector('#cal-reset-pos').addEventListener('click',()=>resetAxes(AXES_POSITION));
  panel.querySelector('#cal-reset-rot').addEventListener('click',()=>resetAxes(AIM_ROTATION));
  panel.querySelector('#cal-copy').addEventListener('click',async()=>{
    const result=JSON.stringify({pistolaMira:pistolAdjustments.pistolaMira},null,2);
    try{await navigator.clipboard.writeText(result);message.textContent='Ajuste da mira copiado!';}
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
  if(item==='arma' && !FIREARM_TEST_MODE){
    notify('Arma de fogo: aguardando futura missão de habilitação.');return;
  }
  if(item==='arma' && (!pistolAssetLoaded || !rightHandBone)){
    notify('Modelo da pistola ainda não carregou. Aguarde.',3500);return;
  }
  if(item!=='arma')setAiming(false);
  equipped=item;
  if(item==='arma')playGameSound('movimento_pistola',.48);
  el('weapon-label').textContent=item==='tonfa'?'🥢 TONFA':item==='arma'?'🎯 PISTOLA':'👊 PUNHOS';
  el('action').querySelector('span').textContent=item==='tonfa'?'🥢':item==='arma'?'🎯':'👊';
  refreshTonfaState();
  refreshPistolState();
  el('equipment-panel').hidden=true;
  notify(item==='arma'?'Teste de empunhadura e mira: disparos desabilitados.':item==='tonfa'?'Tonfa na mão direita!':'Equipamentos guardados nos respectivos suportes.');
}
function doAction(){
  if(!started)return;
  if(equipped==='arma'){
    playGameSound('clique_pistola',.38);
    notify('Teste de mira apenas: disparos serão liberados numa futura missão.',2000);
    return;
  }
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

// Brasão com pata, aplicado como decalque no colete (não modifica o GLB).
// O decalque é filho da coluna torácica, acompanhando as animações.
function makePawBadge(){
  if(!characterModel || pawBadge)return;
  const clothBone=findRigBone(characterModel,'mixamorig:Spine2') ||
    findRigBone(characterModel,'mixamorig:Spine1');
  if(!clothBone){console.warn('Não foi localizado o osso torácico para a pata.');return;}
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=600;
  const ctx=canvas.getContext('2d');
  ctx.lineJoin='round';
  const path=new Path2D();
  path.moveTo(256,62);path.lineTo(432,116);path.lineTo(422,369);
  path.quadraticCurveTo(415,469,256,535);
  path.quadraticCurveTo(97,469,90,369);
  path.lineTo(80,116);path.closePath();
  ctx.fillStyle='#f0c85b';ctx.fill(path);
  ctx.save();ctx.translate(256,298);ctx.scale(.87,.88);ctx.translate(-256,-298);
  ctx.fillStyle='#112e59';ctx.fill(path);ctx.restore();
  ctx.strokeStyle='#f8f3df';ctx.lineWidth=8;ctx.stroke(path);
  // Quatro dedos e palma, sem texto ou brasão institucional real.
  ctx.fillStyle='#ffffff';
  [[142,250,31,39,-.25],[214,214,33,44,-.08],[299,214,33,44,.08],[369,250,31,39,.25]].forEach(([x,y,rx,ry,angle])=>{
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,Math.PI*2);ctx.fill();
  });
  ctx.beginPath();ctx.moveTo(157,365);
  ctx.bezierCurveTo(156,321,200,291,230,309);
  ctx.quadraticCurveTo(256,325,281,309);
  ctx.bezierCurveTo(313,290,355,321,355,365);
  ctx.bezierCurveTo(356,416,307,441,256,424);
  ctx.bezierCurveTo(205,441,156,415,157,365);
  ctx.fill();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,
    side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.145,.165),material);
  mesh.name='Emblema_Pata_Colete_Costas';
  mesh.frustumCulled=false; // Não desaparecer no giro de câmera com rig animado.
  // Encontre a SUPERFÍCIE do colete: o posicionamento antigo -0.229 era
  // fixo e por isso o desenho parecia flutuar atrás do Tio Urso.
  // Em referencial do personagem, traseira = -Z; o raycast segue +Z.
  characterModel.updateWorldMatrix(true,true);
  const hitStart=characterModel.localToWorld(new THREE.Vector3(0,1.37,-1.2));
  const rayDirection=new THREE.Vector3(0,0,1)
    .transformDirection(characterModel.matrixWorld).normalize();
  const meshList=[];
  characterModel.traverse(o=>{if(o.isMesh && o!==mesh)meshList.push(o);});
  const surfaceRay=new THREE.Raycaster(hitStart,rayDirection,0,2.0);
  const hits=surfaceRay.intersectObjects(meshList,false);
  // A malha do colete pode mudar em animação, mas seu osso torácico é estável.
  // Usar a primeira superfície encontrada atrás do tronco, com folga 3mm.
  const fallback=characterModel.localToWorld(new THREE.Vector3(0,1.37,-.229));
  const worldPos=hits.length? hits[0].point.clone().addScaledVector(rayDirection,-.003):fallback;
  const boneWorld=clothBone.getWorldQuaternion(new THREE.Quaternion());
  const targetWorld=characterModel.getWorldQuaternion(new THREE.Quaternion())
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));
  clothBone.add(mesh);
  mesh.position.copy(clothBone.worldToLocal(worldPos));
  mesh.quaternion.copy(boneWorld.invert().multiply(targetWorld));
  mesh.renderOrder=2;
  pawBadge=mesh;
  pawBasePosition=mesh.position.clone();
  pawBaseQuaternion=mesh.quaternion.clone();
  applyPawAdjustments();
}


// ---------------------------------------------------------------------------
// MAPA v0.9.0 - QUADRA DA MATRIZ / CENTRAL DA GUARDA
// Referências: fotos enviadas pelo usuário. POSIÇÕES/PROPORÇÕES SÃO PROVISÓRIAS.
// Início da partida na Rua Eurilemos, 530; Rouxinol NÃO é ponto inicial.
// ---------------------------------------------------------------------------
const mapLandmarks=[];
function cityBlock(x,z,w,d,height,color,title,face='east'){
  // Objeto retangular de baixo polígono: posteriormente substituível por GLB.
  const root=new THREE.Group(); root.position.set(x,0,z);scene.add(root);
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,height,d),standard(color,.83));
  m.position.y=height/2; m.castShadow=true; m.receiveShadow=true;root.add(m);
  const trim=new THREE.Mesh(new THREE.BoxGeometry(w+.18,.19,d+.18),standard(0xcfd6d5));
  trim.position.y=height+.07;trim.castShadow=true;root.add(trim);
  const direction=face==='east'?'x':face==='west'?'x':'z';
  const sign=labelSprite(title,'#f7f9ff','#15304a',Math.min(5.8,Math.max(2.4,title.length*.15)),.46);
  sign.position.set(direction==='x'?(face==='east'?w/2+.25:-w/2-.25):0,Math.min(height-.55,2.6),direction==='z'?(face==='south'?d/2+.25:-d/2-.25):0);
  root.add(sign);mapLandmarks.push({title,x,z});
  const windows=standard(0x9fc2c8,.24);
  const frontSide=face==='east'?1:face==='west'?-1:face==='south'?1:-1;
  for(let k=1;k<Math.max(2,Math.floor(height/1.6));k++){
    const yy=1.2+k*1.1;
    if(yy>height-.45)continue;
    for(let pos=-((direction==='x'?d:w)/2)+1.25;pos<(direction==='x'?d:w)/2-.6;pos+=2.3){
      const win=new THREE.Mesh(new THREE.PlaneGeometry(.85,.72),windows);
      if(direction==='x'){
        win.rotation.y=frontSide*Math.PI/2;
        win.position.set(frontSide*(w/2+.015),yy,pos);
      }else{
        win.rotation.y=frontSide===1?0:Math.PI;
        win.position.set(pos,yy,frontSide*(d/2+.015));
      }
      root.add(win);
    }
  }
  obstacles.push({x1:x-w/2-.28,x2:x+w/2+.28,z1:z-d/2-.28,z2:z+d/2+.28});
  return root;
}
function townPaving(x,z,w,d,color=0xc7bdb0,y=.065){
  const slab=box(w,.055,d,color,x,y,z);slab.receiveShadow=true;return slab;
}
function townLine(x,z,w,d,color=0xf5eed8){return box(w,.018,d,color,x,.073,z);}
function paveCrosswalk(x,z,vertical=false){
  // O jogador atravessa estas faixas; nenhuma delas possui colisão.
  for(let i=-3;i<=3;i++){
    if(vertical)townLine(x+i*.8,z, .48,4.8);
    else townLine(x,z+i*.8,4.8,.48);
  }
}
function simpleLight(x,z){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.06,4.2,7),standard(0x526371));
  pole.position.set(x,2.1,z);scene.add(pole);
  const light=new THREE.Mesh(new THREE.SphereGeometry(.16,8,8),standard(0xffe8ba,.34));
  light.position.set(x,4.18,z);scene.add(light);
}
function townBench(x,z,angle=0){
  const b=new THREE.Group();b.position.set(x,0,z);b.rotation.y=angle;
  const wood=standard(0x855437);const iron=standard(0x303842);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.55,.15,.5),wood);seat.position.y=.47;b.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(1.55,.56,.12),wood);back.position.set(0,.79,-.24);b.add(back);
  for(let t of [-.57,.57]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.5,.1),iron);leg.position.set(t,.23,0);b.add(leg);
  }
  scene.add(b);
}
function buildChurch(){
  // Volume inspirado na Matriz: NÃO é réplica arquitetônica da igreja real.
  const x=18.2,z=11.0;
  const facade=cityBlock(x,z,11.2,12.5,7.5,0xd6d9d5,'IGREJA MATRIZ','south');
  const roof=new THREE.Mesh(new THREE.ConeGeometry(8.4,2.9,4),standard(0x686b78));
  roof.rotation.y=Math.PI/4;roof.scale.z=1.13;roof.position.set(0,8.95,0);facade.add(roof);
  const tower=new THREE.Mesh(new THREE.BoxGeometry(2.9,12.6,3.2),standard(0xe7e3dd));
  tower.position.set(-3.7,6.3,-1.4);facade.add(tower);tower.castShadow=true;
  const belfry=new THREE.Mesh(new THREE.ConeGeometry(2.4,3.2,4),standard(0x747881));
  belfry.rotation.y=Math.PI/4;belfry.position.set(-3.7,14.1,-1.4);facade.add(belfry);
  const crossMat=standard(0xe9c973,.4);
  const v=new THREE.Mesh(new THREE.BoxGeometry(.20,2,.20),crossMat);v.position.set(-3.7,16.55,-1.4);facade.add(v);
  const h=new THREE.Mesh(new THREE.BoxGeometry(1.2,.20,.20),crossMat);h.position.set(-3.7,16.9,-1.4);facade.add(h);
  const door=new THREE.Mesh(new THREE.BoxGeometry(2.25,3.1,.15),standard(0x765847));
  door.position.set(0,1.55,6.35);facade.add(door);
  // Pequenas escadarias na entrada.
  for(let i=0;i<3;i++){
    const step=new THREE.Mesh(new THREE.BoxGeometry(3.6,.16,1),standard(0xb2b7b5));
    step.position.set(0,.08+i*.13,6.9+i*.62);facade.add(step);
  }
}
function buildGazebo(){
  const gazebo=new THREE.Group();gazebo.position.set(29,-0.0,-9);scene.add(gazebo);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(3.0,3.0,.38,8),standard(0xc8c3b2));
  base.position.y=.19;gazebo.add(base);base.receiveShadow=true;
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.10,.12,3.0,6),standard(0xf7f4e8));
    post.position.set(Math.cos(a)*2.55,1.88,Math.sin(a)*2.55);gazebo.add(post);
  }
  const roof=new THREE.Mesh(new THREE.ConeGeometry(3.55,2.1,8),standard(0x536d75));
  roof.position.y=4.37;roof.castShadow=true;gazebo.add(roof);
  const sign=labelSprite('CORETO','#ffffff','#174157',1.9,.42);sign.position.set(0,4.65,0);// Etiqueta fica sobre o coreto e não na origem da cena.
  scene.add(sign);sign.position.set(29,4.95,-9);
  mapLandmarks.push({title:'Coreto',x:29,z:-9});
}
function buildDowntownMap(){
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(125,125),standard(0x8da77e));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.018;floor.receiveShadow=true;scene.add(floor);
  // Ruas LOCAIS organizadas como esquema de circulação; não são extração GIS.
  for(const st of MAPA_RUAS){
    if(st.eixo==='z')road(st.pos,0,st.largura,103);
    else road(0,st.pos,103,st.largura);
  }
  // Duas calçadas contínuas em cada rua. Larguras aproximadas de jogo.
  for(const st of MAPA_RUAS){
    const out=st.largura/2+1.30;
    for(const side of [-1,1]){
      if(st.eixo==='z')townPaving(st.pos+side*out,0,2.5,101,0xcec9bb,.055);
      else townPaving(0,st.pos+side*out,101,2.5,0xcec9bb,.055);
    }
  }
  // Eixos centrais pintados nas vias.
  for(const st of MAPA_RUAS){
    for(let d=-46;d<46;d+=7.5){
      if(st.eixo==='z')townLine(st.pos,d,.10,3.1,0xd8c88d);
      else townLine(d,st.pos,3.1,.10,0xd8c88d);
    }
  }
  for(const z of [29,-30])paveCrosswalk(0,z,false);
  for(const x of [-39,39])paveCrosswalk(x,29,true);
  // A Praça da Matriz ocupa o miolo entre Eurilemos e Drongo neste protótipo.
  townPaving(20.2,-.5,29.2,42.0,0xd4ccb9,.08);
  townPaving(20.2,-.5,2.4,42.0,0xbab3a0,.113);
  townPaving(20.2,-.5,29.2,2.1,0xbab3a0,.115);
  // Pequeno canteiro verde e mobiliário da praça.
  for(const [x,z] of [[9,-13],[12,-7],[12,0],[29,1],[29,13],[10,18]]){
    const soil=box(2.4,.06,2.4,0x749a65,x,.118,z); soil.receiveShadow=true;
    tree(x,z);
  }
  for(const [x,z,r] of [[14,-12,0],[25,16,Math.PI],[9,7,Math.PI/2],[30,6,-Math.PI/2]])townBench(x,z,r);
  buildChurch();buildGazebo();
  const plazaSign=labelSprite('PRAÇA DA MATRIZ','#ffffff','#456d56',3.7,.58);
  plazaSign.position.set(19,3,-17.5);scene.add(plazaSign);
  // Quadra administrativa, a oeste da Rua Eurilemos.
  const central=cityBlock(-15.2,-6.7,13.5,10.0,5.3,0xb7c6c9,'CENTRAL DA GUARDA','east');
  const blueBand=new THREE.Mesh(new THREE.BoxGeometry(.09,.72,13),standard(0x234b72));
  blueBand.rotation.y=Math.PI/2;blueBand.position.set(6.85,4.5,0);central.add(blueBand);
  const mainDoor=new THREE.Mesh(new THREE.BoxGeometry(.1,2.75,2.2),standard(0x345769,.34));
  mainDoor.position.set(6.79,1.4,0);central.add(mainDoor);
  const frontSign=labelSprite('GUARDA MUNICIPAL','#ffffff','#18416a',3.6,.48);
  frontSign.position.set(-7.60,3.4,-6.7);scene.add(frontSign);
  // Jogador inicia diante da entrada, na calçada da Rua Eurilemos.
  const startMark=new THREE.Mesh(new THREE.RingGeometry(.48,.62,24),new THREE.MeshBasicMaterial({color:0x72e1ad,side:THREE.DoubleSide}));
  startMark.rotation.x=-Math.PI/2;startMark.position.set(playerPos.x,.095,playerPos.z);scene.add(startMark);
  const spawnSign=labelSprite('INÍCIO DO PLANTÃO','#ffffff','#12644f',3.25,.49);
  spawnSign.position.set(-5.9,2.35,-6.7);scene.add(spawnSign);
  mapLandmarks.push({title:'Spawn — Rua Eurilemos, 530',x:playerPos.x,z:playerPos.z});
  // Estacionamento frontal/lateral, com acesso voltado para a via.
  townPaving(-14.7,-23.0,17,10,0x7b8586,.063);
  for(let x=-21;x<=-9;x+=3)townLine(x,-23,.1,5.6,0xf1efe5);
  townPaving(-7.8,-22.9,3.5,5.0,0xa7aaa5,.078);
  const parkingSign=labelSprite('ESTACIONAMENTO GMA','#ffffff','#164264',3.65,.45);
  parkingSign.position.set(-12,2.7,-27.3);scene.add(parkingSign);
  mapLandmarks.push({title:'Estacionamento GM',x:-15,z:-23});
  cityBlock(-28,-5.6,10.4,11.5,6.8,0x8aafc3,'SECRETARIA DE EDUCAÇÃO','south');
  cityBlock(-19.5,13.4,14.2,9.6,5.4,0xdadfe5,'CORREIOS','east');
  cityBlock(-29.7,-20.9,10.2,8.3,5.2,0xd8d0c3,'RECEITA ESTADUAL','south');
  cityBlock(-30.5,5.0,9.2,7.4,3.6,0xe9cbb1,"DONALD'S LANCHES",'west');
  // Área de carga/descarga dos Correios: apenas ambientação, sem acesso funcional.
  townPaving(-30.2,14,4.6,7.0,0x9c9b92,.065);
  townLine(-30.2,14,.15,5.9,0xe8d5a5);
  const truckSign=labelSprite('SERVIÇO • CORREIOS','#fefefe','#39556b',3.3,.42);
  truckSign.position.set(-30,2.3,19.8);scene.add(truckSign);
  mapLandmarks.push({title:'Fundos dos Correios',x:-30,z:14});
  // Algumas fachadas genéricas adicionais. Sem marcas nem ocupantes inventados.
  cityBlock(-21.0,41.4,13,8.0,5.7,0xdbd3c0,'COMÉRCIO','south');
  cityBlock(13.5,41.5,10.0,8.0,5.5,0xb8a8a0,'COMÉRCIO','south');
  cityBlock(27.0,-41.4,13.5,7.4,4.3,0xbec5b4,'SERVIÇOS','north');
  cityBlock(-20.0,-42.0,15,7.4,4.4,0xcfc6b9,'COMÉRCIO','north');
  // Iluminação estática simples para poupar chamadas de desenho no Android.
  for(const [x,z] of [[-5.1,18],[-5.1,-19],[5.1,22],[34,16],[34,-18],[-34,20],[-34,-19]])simpleLight(x,z);
  // Distribuição de cidadãos na mesma missão original de 3 conversas.
  makeCitizen('Dona Maria',-5.15,7.5,0x52a47d,'maria');
  makeCitizen('Sr. Carlos',7.0,-11.5,0xe1ad6d,'carlos');
  makeCitizen('Ana',-5.25,20,0x7b94cc,'ana');
}

function buildScene(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x91c8e1);scene.fog=new THREE.Fog(0x91c8e1,34,92);
  camera=new THREE.PerspectiveCamera(64,1,.1,180);
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  // Sombras reais, acompanhando os ossos e a arma durante os golpes.
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  mount.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xe7f4ff,0x778062,2.15));
  sunLight=new THREE.DirectionalLight(0xffefcd,2.4);
  sunLight.position.set(-12,25,-10);sunLight.castShadow=true;
  sunLight.shadow.mapSize.set(1024,1024);
  sunLight.shadow.camera.near=1;sunLight.shadow.camera.far=55;
  sunLight.shadow.camera.left=-13;sunLight.shadow.camera.right=13;
  sunLight.shadow.camera.top=13;sunLight.shadow.camera.bottom=-13;
  sunLight.shadow.bias=-.00018;sunLight.shadow.normalBias=.025;
  sunLight.shadow.radius=2;
  scene.add(sunLight);scene.add(sunLight.target);
  buildDowntownMap();
  player=new THREE.Group();player.position.copy(playerPos);player.position.y=GROUND_Y;scene.add(player);
  createGroundShadow();makeAttackEffect();makeTonfa();
  clock=new THREE.Clock();
  // Apenas o cenário físico é alvo visual da mira, nunca o Tio Urso.
  scene.traverse(o=>{
    if(!o.isMesh)return;
    let p=o,insidePlayer=false;
    while(p){if(p===player){insidePlayer=true;break;}p=p.parent;}
    if(!insidePlayer)aimColliders.push(o);
  });
  onResize();window.addEventListener('resize',onResize);
  camera.position.set(0,1.8,-13-CAM_DISTANCE_WIDE);
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
      // O modelo animado do Meshy utiliza SkinnedMesh. Seu boundingSphere
      // em pose de repouso nem sempre representa as posições dos vértices
      // depois de atualizar os ossos com AnimationMixer. Isso faz a câmera
      // principal DESCARTAR o urso ao vê-lo por trás, enquanto a sombra e
      // acessórios independentes continuam visíveis (efeito fantasma).
      // Um único personagem (~134 mil faces) dispensa frustum culling;
      // preservar materiais/texturas/ossos e nunca esconder suas malhas.
      let protectedMeshes=0;
      characterModel.traverse(o=>{
        if(!o.isMesh)return;
        o.frustumCulled=false;
        o.castShadow=true;
        o.receiveShadow=false;
        protectedMeshes++;
      });
      console.info('v0.8.6: malhas 3D protegidas contra culling incorreto:',protectedMeshes);
      if(!installRiggedAnimations(gltf)){
        // Reserva para um modelo antigo sem ossos.
        installProceduralGait(characterModel);
      }
      attachTonfaToRig();
      makePawBadge();
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
// Pose alvo precomputada: interpolação determinística entre a animação-base
// e os dois quaternions fixos. Não lê a orientação do próprio braço para
// recalcular outra rotação (causa de oscilação/"helicóptero").
function applyStableFirearmAimPose(blend){
  if(!(FIREARM_TEST_MODE && equipped==='arma' && aimFixedUpper &&
    aimFixedForearm && rightUpperArm && rightForeArm))return;
  const weight=THREE.MathUtils.clamp(blend,0,1);
  if(weight<=.0001)return;
  // AnimationMixer acabou de atualizar: este é o estado-base do quadro.
  // Aplicar APENAS uma slerp direta ao destino FIXO em cada osso.
  rightUpperArm.quaternion.slerp(aimFixedUpper,weight).normalize();
  rightForeArm.quaternion.slerp(aimFixedForearm,weight).normalize();
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
  const trying=motion.lengthSq()>.008 && analogScale>.045 && !comboActive && comboBlend<.25 && !(FIREARM_TEST_MODE && aiming);
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
  if(walking || aiming){
    const wantedRot=aiming?Math.atan2(forward.x,forward.z):Math.atan2(velocitySmooth.x,velocitySmooth.z);
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
    aimBlend+=(Number(aiming&&equipped==='arma')-aimBlend)*(1-Math.exp(-dt*11));
    // v0.8.3: nenhuma rotação calculada por frame. Apenas aplicar pose
    // fixa gerada uma vez no carregamento do rig (sem oscilações).
    applyStableFirearmAimPose(aimBlend);
    applyPistolPlacement();
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
  // Passos sincronizados à fase dos clipes reais: duas pisadas por ciclo.
  // Sem arquivo sonoro externo, apenas áudio sintetizado provisório.
  syncFootsteps(speed,Boolean(runningBlend>.5 && running),comboActive || comboBlend>.20);
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
  // A sombra suave fica sob o quadril efetivo (inclusive nas animações com
  // deslocamento do root/hips); a sombra de luz acompanha a malha em tempo real.
  if(contactShadow){
    shadowAnchor.set(0,0,0);
    if(hipBone){
      hipBone.getWorldPosition(accessoryWorldOffset);
      player.worldToLocal(accessoryWorldOffset);
      shadowAnchor.copy(accessoryWorldOffset);
    }
    contactShadow.position.set(
      THREE.MathUtils.clamp(shadowAnchor.x,-1.5,1.5),.004,
      THREE.MathUtils.clamp(shadowAnchor.z,-1.5,1.5));
  }
  if(sunLight){
    sunLight.target.position.copy(player.position);
    sunLight.position.copy(player.position).add(sunlightOffset);
    sunLight.target.updateMatrixWorld();
  }
  const behindX=Math.sin(camYaw),behindZ=Math.cos(camYaw);
  const landscape=window.innerWidth>window.innerHeight;
  // Third-person over-the-shoulder: a câmera sai à direita do personagem,
  // mas a retícula permanece no centro do viewport e aponta PARA A RUA,
  // não para o colete. Direção para frente é o oposto do vetor 'behind'.
  const distance=(landscape?CAM_DISTANCE_WIDE:CAM_DISTANCE_TALL)-.30*aimBlend;
  const flatDistance=distance*Math.cos(camPitch);
  const eyeLevel=CAM_TARGET_HEIGHT+.14*aimBlend+distance*Math.sin(camPitch);
  // Retrato tem campo horizontal menor: não cortar o Tio Urso da tela.
  const shoulderDistance=(landscape?.80:.34)*aimBlend;
  const shoulderX=Math.cos(camYaw)*shoulderDistance;
  const shoulderZ=-Math.sin(camYaw)*shoulderDistance;
  const lookAhead=5.0*aimBlend;
  camPosWanted.set(
    player.position.x+behindX*flatDistance+shoulderX,
    player.position.y+Math.max(.44,eyeLevel),
    player.position.z+behindZ*flatDistance+shoulderZ
  );
  camera.position.lerp(camPosWanted,1-Math.exp(-dt*10));
  // Preservar olhar livre para cima/baixo também durante a mira.
  targetPos.set(
    player.position.x-behindX*lookAhead,
    player.position.y+CAM_TARGET_HEIGHT+.14*aimBlend-lookAhead*Math.tan(camPitch),
    player.position.z-behindZ*lookAhead
  );
  camera.lookAt(targetPos);
  updateAimReticle(dt);
  const c=nearbyCitizen();const hint=el('action-hint');
  if(c){hint.classList.add('visible');hint.textContent=talked.has(c.id)?`✓ ${c.name} já foi atendido`:`✋ FALAR com ${c.name}`;}
  else hint.classList.remove('visible');
  for(const n of citizenNodes)n.flag.visible=player.position.distanceTo(n.citizen.position)<14;
  drawMap();
  if(performance.now()>toastUntil)el('toast').classList.remove('show');
}
function drawMap(){
  const c=miniCtx,w=mini.width,h=mini.height;
  c.clearRect(0,0,w,h);c.fillStyle='#8ca483';c.fillRect(0,0,w,h);
  const s=2.2,px=player.position.x,pz=player.position.z;
  const mx=x=>w/2+(x-px)*s, my=z=>h/2-(z-pz)*s;
  // Desenha a mesma malha ESQUEMÁTICA usada no cenário, sem GPS real.
  for(const st of MAPA_RUAS){
    c.fillStyle='#45525c';
    if(st.eixo==='z')c.fillRect(mx(st.pos-st.largura/2),0,st.largura*s,h);
    else c.fillRect(0,my(st.pos+st.largura/2),w,st.largura*s);
    c.strokeStyle='#e6d5a3';c.lineWidth=1;c.setLineDash([4,6]);c.beginPath();
    if(st.eixo==='z'){c.moveTo(mx(st.pos),0);c.lineTo(mx(st.pos),h);}
    else{c.moveTo(0,my(st.pos));c.lineTo(w,my(st.pos));}
    c.stroke();c.setLineDash([]);
  }
  c.fillStyle='#c5b68d';c.fillRect(mx(6.2),my(20.5),29.0*s,41.5*s);
  for(const p of mapLandmarks){
    const x=mx(p.x),y=my(p.z);if(x<0||y<0||x>w||y>h)continue;
    c.beginPath();c.arc(x,y,3.6,0,Math.PI*2);
    c.fillStyle=p.title.includes('Guarda')||p.title.includes('Spawn')?'#4cffb9':'#ffe498';c.fill();
  }
  for(const n of citizenNodes){const x=mx(n.citizen.position.x),y=my(n.citizen.position.z);
    if(x<-5||x>w+5||y<-5||y>h+5)continue;
    c.beginPath();c.arc(x,y,4.5,0,Math.PI*2);c.fillStyle=talked.has(n.id)?'#70dba1':'#f7d652';c.fill();
  }
  c.save();c.translate(w/2,h/2);c.rotate(-player.rotation.y);c.fillStyle='#fff';
  c.strokeStyle='#163349';c.lineWidth=2;c.beginPath();c.moveTo(0,-9);c.lineTo(-6,7);c.lineTo(6,7);c.closePath();c.fill();c.stroke();c.restore();
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
  el('aim-button').addEventListener('click',()=>setAiming(!aiming));
  if(FIREARM_TEST_MODE){
    el('equip-firearm').disabled=false;
    el('equip-firearm').querySelector('small').textContent='🧪 TESTE VISUAL • sem disparos';
  }
  window.addEventListener('keydown',e=>{pressedKeys.add(e.code);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyE')interact();if(e.code==='Space')doAction();if(e.code==='KeyQ')el('equipment-panel').hidden=!el('equipment-panel').hidden;if(e.code==='KeyF')setAiming(!aiming);});
  window.addEventListener('keyup',e=>pressedKeys.delete(e.code));
  window.addEventListener('blur',()=>{pressedKeys.clear();runHeld=false;clearStick();});
  // Arrastar sobre o cenário muda a câmera. Joystick/botões não interferem.
  let cameraPointer=null,lastX=0,lastY=0;
  mount.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    if(cameraPointer!==null)return; // O segundo dedo continua independente no joystick.
    cameraPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;
    mount.setPointerCapture(e.pointerId);e.preventDefault();
  });
  mount.addEventListener('pointermove',e=>{
    if(cameraPointer!==e.pointerId)return;
    const dx=e.clientX-lastX,dy=e.clientY-lastY;
    lastX=e.clientX;lastY=e.clientY;
    camYaw-=dx*.006;
    camPitch=THREE.MathUtils.clamp(camPitch+dy*.0045,CAM_PITCH_MIN,CAM_PITCH_MAX);
    e.preventDefault();
  });
  const release=e=>{if(cameraPointer===e.pointerId)cameraPointer=null;};
  mount.addEventListener('pointerup',release);mount.addEventListener('pointercancel',release);
  mount.addEventListener('lostpointercapture',release);
  el('full').addEventListener('click',async()=>{
    if(document.fullscreenElement){
      try {screen.orientation?.unlock?.();await document.exitFullscreen();}
      catch(err){console.warn('Saida da tela cheia:',err);}
    } else {
      const rotated=await requestLandscapeForGame();
      if(!rotated)notify('O navegador não autorizou girar a tela. Ative a rotação automática do Android ou gire o celular.',4100);
    }
  });
  el('ignore-rotate').addEventListener('click',()=>{ignorePortrait=true;el('rotate-hint').classList.add('ignored');});
  window.addEventListener('resize',()=>{if(window.innerWidth>window.innerHeight&&!ignorePortrait)el('rotate-hint').classList.remove('ignored');});
}
// v0.8.9 - navegador: a rotacao precisa ser solicitada durante o gesto do usuario.
// Apps instalados usam adicionalmente a preferencia landscape no manifest.
async function requestLandscapeForGame(){
  if(window.matchMedia?.('(orientation: landscape)').matches)return true;
  // Em muitos navegadores Android, orientation.lock exige tela cheia.
  if(!document.fullscreenElement && typeof document.documentElement.requestFullscreen==='function'){
    try {await document.documentElement.requestFullscreen({navigationUI:'hide'});}
    catch(err){console.warn('Tela cheia indisponivel:',err);}
  }
  if(screen.orientation && typeof screen.orientation.lock==='function'){
    try {await screen.orientation.lock('landscape');return true;}
    catch(err){console.warn('Bloqueio de orientacao indisponivel:',err);}
  }
  return window.matchMedia?.('(orientation: landscape)').matches ?? (innerWidth>innerHeight);
}

try{
  installControls();
  installAudioPanel();
  const loaded=await buildScene();
  enableAccessoryCalibration();
  enablePawCalibration();
  enableReticleCalibration();
  applyReticleAdjustments();
  ready=true;introButton.disabled=false;
  introButton.textContent='INICIAR PATRULHAMENTO';
  el('load-info').textContent=loaded?(comboAnim?'Tio Urso animado: caminhada, corrida e combo de golpes!':hasRiggedAnimations?'Caminhada e corrida prontas!':'Tio Urso 3D carregado!'):'Modelo não carregou; modo reserva disponível.';
  introButton.addEventListener('click',async()=>{
    if(!ready)return;
    started=true;el('intro').style.display='none';
    document.body.classList.add('patrulha-iniciada');
    // Audio e orientacao devem comecar pelo toque do usuario (permissao Android).
    initializeAudio();
    const landscapeResult=requestLandscapeForGame();
    notify('Empurre o joystick até o topo para CORRER automaticamente. Converse com 3 cidadãos!',3900);
    const rotated=await landscapeResult;
    if(!rotated){
      // Orientacao bloqueada pelo navegador/sistema: mostra instrucoes, sem travar o jogo.
      notify('Para paisagem, habilite Rotação automática no Android e gire o celular.',4500);
    }
  });
  loop();
} catch(error){
  console.error(error);
  el('fatal').hidden=false;
  el('fatal-reason').textContent='Confira sua conexão com a internet e tente novamente. O carregamento das bibliotecas 3D requer acesso à rede.';
}
