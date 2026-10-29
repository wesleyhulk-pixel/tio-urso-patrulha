// v1.0.1: correção de carregamento FBX e visualizador do mapa exportado.
// v0.9.1: refinamento com imagem aérea: Avenida Arapongas a oeste, Flamingos a leste,
// Falcão a norte, Drongo a sul e Eurilemos ligando as extremidades.
// Praça, igreja, coreto, conjunto institucional e calçadas reorganizados.
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
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

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
// v1.0.5: limite ampliado para cobrir todo o GLB (~1 km), inclusive a recepção A11.
// Antes o spawn (-178, -209) estava fora de LIMIT=125, travando WASD e joystick.
const LIMIT = 650; // não aplicado ao teste de deslocamento v1.0.6
// A configuração abaixo permite ajustar o mapa depois com a foto aérea.
// As coordenadas são LOCAIS ao jogo, não latitudes/longitudes reais.
const MAPA_VERSAO = "CENTRO · MATRIZ / CENTRAL — SATÉLITE v0.9.1";
// x negativo: direção da Av. Arapongas; x positivo: R. Flamingos.
// z negativo: direção da R. Falcão; z positivo: R. Drongo.
// Eurilemos atravessa o conjunto entre a praça e os prédios públicos.
// ESCALA ILUSTRATIVA: NÃO é planta georreferenciada nem cópia da imagem do satélite.
const MAPA_RUAS = [
  {nome:"Av. Arapongas", eixo:"z", pos:-43, largura:9.4},
  {nome:"Rua Flamingos", eixo:"z", pos:43, largura:7.2},
  {nome:"Rua Falcão", eixo:"x", pos:-42, largura:7.5},
  {nome:"Rua Drongo", eixo:"x", pos:42, largura:7.3},
  {nome:"Rua Eurilemos", eixo:"x", pos:-2.5, largura:7.2}
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
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong>🎯 CRUZ DE MIRA · v0.9.1</strong><button id="reticle-toggle" type="button">−</button></div>
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
// Marcas locais do TopoExport, feitas e aprovadas no visualizador v1.3.
const ANCHORS = {"A11": {"x": 309.29185707683644, "z": -700.147975094181}, "P1": {"x": 253.70459033699012, "z": -748.3587325036211}, "P2": {"x": 302.9691347936312, "z": -705.6803570919856}, "P3": {"x": 366.7232511492843, "z": -638.5014328329296}, "P4": {"x": 261.3445464291965, "z": -670.6419377725564}, "P5": {"x": 222.35442568276397, "z": -705.6803570919856}, "E5": {"x": 309.55530383863663, "z": -730.4443527012062}, "Centro": {"x": 306.65738945883425, "z": -675.3839794849604}};
// Centro da geometria original do TopoExport (calculado do bounding box do GLB).
const GEO_CENTER = {x:487.40111351,z:-490.724742435};
const toGame=(pos)=>({x:pos.x-GEO_CENTER.x,z:pos.z-GEO_CENTER.z});
const a11=toGame(ANCHORS.A11);
const playerPos = new THREE.Vector3(a11.x,0,a11.z);
let realMapSurface=null, fastbackObj=null, fastbackBase=null;
function surfaceHeight(x,z){
 if(!realMapSurface)return GROUND_Y;
 const ray=new THREE.Raycaster(new THREE.Vector3(x,300,z),new THREE.Vector3(0,-1,0),0,450);
 const hits=ray.intersectObjects(realMapSurface,true);
 return hits.length?hits[0].point.y+0.06:GROUND_Y;
}

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
  // Remover figuras provisórias: só NPCs FBX de verdade serão visíveis.
  for(const obj of [...citizen.children])citizen.remove(obj);
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
  // A tonfa fica visível no cinto desde o início; a missão libera apenas empunhá-la.
  // Não esconder o equipamento de cintura quando ainda não foi desbloqueado.
  const readyTonfa=tonfaAttachedToHand && tonfaAssetLoaded;
  const inHand=readyTonfa && talked.size>=3 && equipped==='tonfa';
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
  // Silhueta da Igreja Matriz voltada para o lado da Avenida Arapongas.
  // Arquitetura provisória baseada em foto, sem reproduzir o prédio literalmente.
  const x=-25.5,z=20;
  const church=cityBlock(x,z,13.2,15.5,7.5,0xe7e8e0,'IGREJA MATRIZ','west');
  const roof=new THREE.Mesh(new THREE.ConeGeometry(10.0,3.0,4),standard(0x777b85));
  roof.rotation.y=Math.PI/4;roof.scale.z=1.08;roof.position.set(0,9.1,0);roof.castShadow=true;church.add(roof);
  const tower=new THREE.Mesh(new THREE.BoxGeometry(3.1,11.2,3.2),standard(0xecebe5));
  tower.position.set(-4.8,5.6,-3.3);tower.castShadow=true;church.add(tower);
  const cupola=new THREE.Mesh(new THREE.ConeGeometry(2.25,3.0,4),standard(0x737a83));
  cupola.rotation.y=Math.PI/4;cupola.position.set(-4.8,12.7,-3.3);cupola.castShadow=true;church.add(cupola);
  const crossMat=standard(0xd9b962);
  const cross1=new THREE.Mesh(new THREE.BoxGeometry(.15,1.45,.15),crossMat);
  cross1.position.set(-4.8,15,-3.3);church.add(cross1);
  const cross2=new THREE.Mesh(new THREE.BoxGeometry(.84,.15,.15),crossMat);
  cross2.position.set(-4.8,15.22,-3.3);church.add(cross2);
  const door=new THREE.Mesh(new THREE.BoxGeometry(.12,3.1,2.3),standard(0x805c4c));
  door.position.set(-6.66,1.56,1.3);church.add(door);
  const stained=standard(0x5c8b9b,.3);
  const window=new THREE.Mesh(new THREE.BoxGeometry(.10,2.3,1.25),stained);
  window.position.set(-6.67,4.8,1.2);church.add(window);
  for(let i=0;i<3;i++){
    const step=new THREE.Mesh(new THREE.BoxGeometry(.65+i*.22,.13,3.3),standard(0xc7c7c2));
    step.position.set(-7.2-i*.50,.11+i*.11,1.2);church.add(step);
  }
}
function buildGazebo(){
  // Coreto próximo ao lado da R. Drongo, na praça junto à Matriz.
  const x=19.2,z=29.0;
  const gazebo=new THREE.Group();gazebo.position.set(x,0,z);scene.add(gazebo);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(3.15,3.15,.33,8),standard(0xcbbda5));
  base.position.y=.165;base.receiveShadow=true;gazebo.add(base);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    const column=new THREE.Mesh(new THREE.CylinderGeometry(.11,.12,3,7),standard(0xf3f0e5));
    column.position.set(Math.cos(a)*2.6,1.84,Math.sin(a)*2.6);gazebo.add(column);
  }
  const roof=new THREE.Mesh(new THREE.ConeGeometry(3.65,2.1,8),standard(0x516976));
  roof.position.y=4.4;roof.castShadow=true;gazebo.add(roof);
  const sign=labelSprite('CORETO','#ffffff','#174157',2.15,.42);
  sign.position.set(x,5,z);scene.add(sign);
  mapLandmarks.push({title:'Coreto • Rua Drongo',x,z});
}
function townPath(x,z,w,d){
  const path=townPaving(x,z,w,d,0xbeb5a6,.117);
  path.receiveShadow=true;
}
function makeKiosk(x,z){
  // Quiosque de praça, provisório para referência ao comércio local.
  const b=new THREE.Group();b.position.set(x,0,z);scene.add(b);
  const base=new THREE.Mesh(new THREE.BoxGeometry(4.4,2.6,3.0),standard(0xe4d6ba));
  base.position.y=1.3;base.castShadow=true;b.add(base);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(3.0,1.5,4),standard(0x506b59));
  roof.rotation.y=Math.PI/4;roof.position.y=3.30;b.add(roof);
  const sign=labelSprite('QUIOSQUE','#ffffff','#315742',2.0,.43);
  sign.position.set(x,4.5,z);scene.add(sign);
  obstacles.push({x1:x-2.5,x2:x+2.5,z1:z-1.9,z2:z+1.9});
  mapLandmarks.push({title:'Quiosque da Praça',x,z});
}
function makeParkingBay(x,z,w,d,title){
  townPaving(x,z,w,d,0x89908b,.075);
  for(let dx=-w/2+2;dx<w/2-1;dx+=3.4)townLine(x+dx,z,.11,d-1.0,0xecece8);
  const sign=labelSprite(title,'#ffffff','#19435f',3.6,.44);
  sign.position.set(x,2.4,z+d/2+.5);scene.add(sign);
  mapLandmarks.push({title,x,z});
}
// v1.0.3 — base 3D importada do TopoExport; SEM edifícios inventados.
let mapaTopoCarregado=false;
function buildDowntownMap(){
  // O modelo será carregado em buildScene. Ponto de início temporário.
  mapLandmarks.length=0;
  for(const [code,pt] of Object.entries(ANCHORS)){const local=toGame(pt); mapLandmarks.push({title:code,x:local.x,z:local.z});}
  makeCitizen('Dona Maria',playerPos.x+7,playerPos.z+12,0x52a47d,'maria');
  makeCitizen('Sr. Carlos',playerPos.x-4,playerPos.z+17,0xe1ad6d,'carlos');
  makeCitizen('Ana',playerPos.x+11,playerPos.z-9,0x7b94cc,'ana');
}
function loadRealMap(){
  const info=document.getElementById('mapa-real-status');
  new GLTFLoader().load('./mapa-topoexport.glb?v=103',g=>{
    // TopoExport: eixo Z é vertical. Three.js: eixo Y vertical.
    const model=g.scene;
    model.rotation.x=-Math.PI/2;
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());
    model.position.x-=center.x;
    model.position.z-=center.z;
    // A cota local será acertada pelo terreno sob o ponto de teste.
    model.position.y-=bounds.min.y;
    model.updateMatrixWorld(true);
    // Nunca mover o modelo pelo raycast: deslocaria as ancoras em relacao ao mapa.
    realMapSurface=[];
    model.traverse(o=>{if(o.isMesh && /Ground|Road|GreenArea/i.test(o.name))realMapSurface.push(o)});
    model.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=false;o.frustumCulled=false;}});
    scene.add(model);mapaTopoCarregado=true;
    scene.fog=new THREE.Fog(0x91c8e1,130,280);
    camera.far=1400;camera.updateProjectionMatrix();
    if(info)info.textContent='Mapa TopoExport carregado • A11 calibrada';
    if(player && !started){player.position.set(playerPos.x,surfaceHeight(playerPos.x,playerPos.z),playerPos.z);}
    updateCalibratedMarkers();
  },undefined,err=>{console.error('Erro mapa real',err);if(info)info.textContent='ERRO: mapa GLB não carregou';});
}

// v1.0 - assets de terceiros, carregados sem bloquear o protagonista.
const NPC_ASSETS=[
 {file:'Male_Casual.fbx',x:playerPos.x+7,z:playerPos.z+12},
 {file:'Female_Casual.fbx',x:playerPos.x-4,z:playerPos.z+17},
 {file:'Male_Suit.fbx',x:playerPos.x+11,z:playerPos.z-9},
 {file:'Female_Dress.fbx',x:playerPos.x-9,z:playerPos.z-14}
];
const VEHICLE_ASSETS=[
 {file:'NormalCar1.fbx',x:-19,z:19,rot:1.57,color:0x8bbaac},
 {file:'NormalCar2.fbx',x:-19,z:26,rot:1.57,color:0xd3c7ad},
 {file:'SUV.fbx',x:20,z:4,rot:-1.57,color:0xa3b8c8},
 {file:'Taxi.fbx',x:19,z:11,rot:-1.57,color:0xe0bf60}
];
function prepareExternalModel(model, height, x,z,rotation=0){
 const bounds=new THREE.Box3().setFromObject(model);
 if(bounds.isEmpty())return false;
 const size=bounds.getSize(new THREE.Vector3());
 const factor=height/Math.max(size.y,.01);
 if(!Number.isFinite(factor)||factor>200||factor<.000001)return false;
 model.scale.setScalar(factor);
 model.position.set(x-(bounds.min.x+bounds.max.x)*factor/2,-bounds.min.y*factor,z-(bounds.min.z+bounds.max.z)*factor/2);
 model.rotation.y=rotation;
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});
 scene.add(model);return true;
}
// v1.0.1: os modelos FBX agora entram dentro do grupo de interação,
// mantendo as posições e permitindo que o jogador converse normalmente.
const npcLoadStatus={ok:0,failed:0};
function npcInfo(message){
 let badge=document.getElementById('npc-load-info');
 if(!badge){badge=document.createElement('div');badge.id='npc-load-info';badge.style.cssText='position:fixed;left:8px;bottom:8px;z-index:20;color:#fff;background:#082239c9;padding:5px 8px;border-radius:6px;font:11px sans-serif;pointer-events:none';document.body.appendChild(badge);}
 badge.textContent=message;
}

// Calibração independente da Fastback. E5 é estacionamento dos fundos: NUNCA usar como vaga.
const PARKING_KEY='tio-urso-fastback-v104';
// Posicionamento PROVISÓRIO junto à fachada A11: NÃO é vaga definitiva.
const awayFront=new THREE.Vector2(ANCHORS.A11.x-ANCHORS.P2.x, ANCHORS.A11.z-ANCHORS.P2.z).normalize();
const FASTBACK_PREVIEW_SPOT={x:a11.x+awayFront.x*12,z:a11.z+awayFront.y*12,rot:0};
function readFastbackSpot(){try{return JSON.parse(localStorage.getItem(PARKING_KEY)||'null')}catch{return null}}
function applyFastbackSpot(pt){
 if(!fastbackObj||!Number.isFinite(pt.x)||!Number.isFinite(pt.z))return;
 // fastbackObj is a ground-aligned wrapper; never overwrite the child's normalized offsets.
 fastbackObj.position.set(pt.x,surfaceHeight(pt.x,pt.z),pt.z);
 fastbackObj.rotation.y=pt.rot||0;
 fastbackObj.visible=true;
}
// Preserve original GLB proportions with ONE uniform scale. Recenter its mesh
// independently of world placement, so parking adjustments cannot bury its wheels.
function prepareFastbackModel(car){
 const bb=new THREE.Box3().setFromObject(car);
 if(bb.isEmpty())throw new Error('Fastback GLB sem geometria');
 const dims=bb.getSize(new THREE.Vector3());
 const longest=Math.max(dims.x,dims.z);
 const scale=4.40/Math.max(longest,0.001);
 if(!Number.isFinite(scale)||scale<=0||scale>1000)throw new Error('Escala inválida da Fastback');
 const wrapper=new THREE.Group();
 // Keep all axes scaled equally: never stretch height separately.
 car.scale.multiplyScalar(scale);
 car.position.set(-(bb.min.x+bb.max.x)*.5*scale,-bb.min.y*scale,-(bb.min.z+bb.max.z)*.5*scale);
 car.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;}});
 wrapper.add(car);
 scene.add(wrapper);
 console.info('Fastback dimensões originais',dims.toArray(),'escala uniforme',scale,
   'dimensões no jogo',dims.clone().multiplyScalar(scale).toArray());
 return wrapper;
}

function updateCalibratedMarkers(){
 if(!scene)return;
 for(const code of ['A11','P1','P2','P3','P4','P5','E5']){
  const p=toGame(ANCHORS[code]);const label=labelSprite(code==='P2'?'P2 GUARDA MUNICIPAL':code,'#ffffff',code==='A11'?'#15705c':'#263c59',2.5,.55);
  label.position.set(p.x,surfaceHeight(p.x,p.z)+4,p.z);scene.add(label);
 }
}

function populateCity(){
 const fbx=new FBXLoader();
 const loadCount=NPC_ASSETS.length;
 npcInfo('Carregando NPCs 0/'+loadCount);
 NPC_ASSETS.forEach((spec,i)=>fbx.load('./'+spec.file+'?v=103',model=>{
   const bounds=new THREE.Box3().setFromObject(model);
   const size=bounds.getSize(new THREE.Vector3());
   if(bounds.isEmpty()||!Number.isFinite(size.y)||size.y<.001){npcLoadStatus.failed++;npcInfo('NPCs '+npcLoadStatus.ok+'/'+loadCount+' • erro de geometria');return;}
   const factor=1.70/size.y;
   const center=bounds.getCenter(new THREE.Vector3());
   // O FBX pode vir em centímetros, distante da origem ou com pivô elevado.
   const wrapper=new THREE.Group();
   model.scale.setScalar(factor);
   model.position.set(-center.x*factor, -bounds.min.y*factor, -center.z*factor);
   model.traverse(o=>{
     if(o.isMesh){o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;
       if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.side=THREE.DoubleSide;m.needsUpdate=true;}}
     }
   });
   wrapper.add(model);
   if(i<3){
     const info=citizenNodes[i];const dummy=info.citizen;
     // Retém o grupo, seu rótulo e coordenadas para interações e minimapa.
     for(const child of [...dummy.children])if(child!==info.flag)dummy.remove(child);
     dummy.add(wrapper);
   }else{
     wrapper.position.set(spec.x,.10,spec.z);scene.add(wrapper);
   }
   const animations=model.animations||[];
   if(animations.length){
     const mixer=new THREE.AnimationMixer(model);
     const chosen=animations.find(c=>/idle|stand|breath/i.test(c.name))||animations[0];
     mixer.clipAction(chosen).play();ambientMixers.push(mixer);
   }
   npcLoadStatus.ok++;npcInfo('NPCs carregados: '+npcLoadStatus.ok+'/'+loadCount+(npcLoadStatus.failed?' • falhas: '+npcLoadStatus.failed:''));
 },undefined,error=>{npcLoadStatus.failed++;npcInfo('NPCs '+npcLoadStatus.ok+'/'+loadCount+' • falhas: '+npcLoadStatus.failed+' ('+spec.file+')');console.error('Falha FBX:',spec.file,error);}));
 // Carros civis aguardam vagas identificadas na planta: não espalhar em locais aleatórios.
 // Fastback retorna em posição PROVISÓRIA de inspeção, fora de sua vaga definitiva.
 new GLTFLoader().load('./fastback-gm.glb?v=103',g=>{
   const car=g.scene;
   // Fastback somente no estacionamento FRONTAL: o usuário seleciona a vaga.
   try { fastbackObj=prepareFastbackModel(car);fastbackBase=car; }
   catch(error){console.error('Falha no modelo Fastback',error);npcInfo('Erro no modelo Fastback');return;}
   const saved=readFastbackSpot();
   if(saved) applyFastbackSpot(saved);
   else {applyFastbackSpot(FASTBACK_PREVIEW_SPOT);npcInfo('Fastback: posição de teste junto à GM • ajuste vaga no minimapa');}

 },undefined,e=>console.warn('Fastback indisponível',e));
}

const ambientMixers=[];
const SAVE_V100='tio-urso-patrulha-save-v104-ancoras-reais';
let selectedPlatform='auto';
function readSession(){try{return JSON.parse(localStorage.getItem(SAVE_V100)||'null');}catch{return null;}}
function saveSession(){
 if(!player||!started)return;
 const data={version:1,updated:Date.now(),x:player.position.x,z:player.position.z,rotation:player.rotation.y,xp,talked:[...talked],equipped,camYaw,camPitch};
 try{localStorage.setItem(SAVE_V100,JSON.stringify(data));}catch(e){console.warn('Salvamento indisponível',e)}
}
function restoreSession(){
 const s=readSession();if(!s)return false;
 for(const k of ['x','z','rotation','xp'])if(!Number.isFinite(Number(s[k])))return false;
 player.position.set(Number(s.x),surfaceHeight(Number(s.x),Number(s.z)),Number(s.z));player.rotation.y=Number(s.rotation);
 xp=Number(s.xp);talked=new Set((s.talked||[]).filter(v=>typeof v==='string'));
 camYaw=Number.isFinite(s.camYaw)?s.camYaw:camYaw;
 camPitch=Number.isFinite(s.camPitch)?s.camPitch:camPitch;
 equipped=s.equipped==='tonfa'&&talked.size>=3?'tonfa':'punhos';
 updateHud();return true;
}
function resetSession(){
 xp=0;talked=new Set();equipped='punhos';
 player.position.copy(playerPos);player.position.y=surfaceHeight(playerPos.x,playerPos.z);player.rotation.y=0;
 camYaw=Math.PI;camPitch=.26;try{localStorage.removeItem('tio-urso-patrulha-demo-v01');}catch(e){}
 updateHud();saveSession();
}
function configurePlatform(value){
 selectedPlatform=value;
 const touch = value==='celular'||(value==='auto'&& (navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches));
 document.body.classList.toggle('desktop-control',!touch);
 const status=document.getElementById('platform-state');
 if(status)status.textContent=touch?'Toque e joystick virtual':'WASD, Shift, mouse, E (falar), Espaço (ação), Q (equipamentos), F (mirar)';
 try{localStorage.setItem('tio-urso-platform-v100',value)}catch(e){}
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
  loadRealMap();
  populateCity();
  player=new THREE.Group();player.position.copy(playerPos);player.position.y=surfaceHeight(playerPos.x,playerPos.z);scene.add(player);
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
  for(const m of ambientMixers)m.update(dt);
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
  // TEMPORÁRIO: deslocamento direto para identificar se as colisões antigas travam o personagem.
  // Não é a implementação final de colisão com os prédios reais.
  if(Number.isFinite(x))player.position.x=x;
  if(Number.isFinite(z))player.position.z=z;
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
  if(mapaTopoCarregado && (Math.floor(animationTime*10)%3===0)) player.position.y=surfaceHeight(player.position.x,player.position.z);
  else if(!mapaTopoCarregado)player.position.y=GROUND_Y;
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
  c.clearRect(0,0,w,h);c.fillStyle='#91a17f';c.fillRect(0,0,w,h);
  const scale=1.54, px=player.position.x, pz=player.position.z;
  const mx=x=>w/2+(x-px)*scale, my=z=>h/2+(z-pz)*scale;
  // O modelo importado ainda NÃO está georreferenciado com A11/P1–P5.
  c.fillStyle='#dbe9e5';c.font='10px system-ui';c.fillText('TOPOEXPORT • VISÃO LOCAL',7,14);
  c.strokeStyle='#6aa8a0';c.lineWidth=1;c.strokeRect(2,2,w-4,h-4);
  for(const n of citizenNodes){
    const x=mx(n.citizen.position.x),y=my(n.citizen.position.z);
    if(x<-5||x>w+5||y<-5||y>h+5)continue;
    c.beginPath();c.arc(x,y,4.2,0,Math.PI*2);c.fillStyle=talked.has(n.id)?'#70dba1':'#f7d652';c.fill();
  }
  c.save();c.translate(w/2,h/2);c.rotate(Math.PI-player.rotation.y);
  c.fillStyle='#fff';c.strokeStyle='#163349';c.lineWidth=2;
  c.beginPath();c.moveTo(0,-9);c.lineTo(-6,7);c.lineTo(6,7);c.closePath();c.fill();c.stroke();c.restore();
}
// v1.0.6: diagnóstico observável de teclado/joystick e erro por quadro.
let movementDebugFrames=0;
let movementLastError='';
function movementDebug(){
  let node=document.getElementById('movement-diagnostic');
  if(!node){
    node=document.createElement('div');node.id='movement-diagnostic';
    node.style.cssText='position:fixed;top:4px;left:4px;z-index:99999;background:rgba(0,0,0,.75);color:#fff;font:12px monospace;padding:6px 8px;border-radius:5px;max-width:85vw;pointer-events:none;white-space:pre-wrap';
    document.body.appendChild(node);
  }
  const keys=[...pressedKeys].filter(k=>/^(Key[WASD]|Arrow|Shift)/.test(k)).join(',')||'-';
  node.textContent=`DIAGNÓSTICO v1.0.7 | ${started?'EM JOGO':'MENU'}\nTeclas: ${keys} | Joy: ${joyX.toFixed(1)},${joyY.toFixed(1)}\nX ${player?.position.x.toFixed(2)??'-'} Z ${player?.position.z.toFixed(2)??'-'}\n${movementLastError?'ERRO: '+movementLastError:'Movimento sem colisões (teste)'}`;
}
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.max(.001,Math.min(clock.getDelta(),.05));
  try {if(started && !window.__ursoMouseControl?.isPaused())update(dt);}catch(e){
    const msg=(e?.message||String(e));
    if(msg!==movementLastError)console.error('Falha no update:',e);
    movementLastError=msg;
  }
  try{renderer.render(scene,camera);}catch(e){movementLastError='render: '+(e?.message||e);}
  if(++movementDebugFrames%12===0)movementDebug();
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
  // v1.0.7.2: camera por Pointer Lock no PC, sem segurar mouse.
  let pcPaused=false;
  let sceneEditorActive=false;
  document.addEventListener("urso-editor-mode",(e)=>{
    sceneEditorActive=!!e.detail?.active;
    if(sceneEditorActive){pcPaused=false;pauseShade.style.display="none";pressedKeys.clear();if(document.pointerLockElement===mount)document.exitPointerLock?.();}
    else if(started&&isPC()){pcPaused=false;pauseShade.style.display="none";requestMouse();}
  });
  const pauseShade=document.createElement('div');
  pauseShade.id='pc-pause-shade';
  pauseShade.style.cssText='display:none;position:fixed;inset:0;z-index:99998;background:rgba(4,14,25,.78);color:white;align-items:center;justify-content:center;flex-direction:column;gap:16px;font:bold 22px system-ui;text-align:center';
  pauseShade.innerHTML='<div>⏸ JOGO PAUSADO</div><button type="button" id="pc-resume" style="font-size:18px;padding:12px 32px;border-radius:10px;cursor:pointer">▶ CONTINUAR</button><small style="font:14px system-ui">ESC pausa e libera o cursor</small>';
  document.body.appendChild(pauseShade);
  const isPC=()=>document.body.classList.contains('desktop-control');
  let freeCursorByRightClick=false; // v1.0.21: cursor livre sem pausar jogo
  const requestMouse=()=>{if(isPC()&&started&&!pcPaused&&!sceneEditorActive&&document.pointerLockElement!==mount){freeCursorByRightClick=false;const p=mount.requestPointerLock?.();p?.catch?.(err=>console.warn('Mouse lock indisponível:',err));}};
  const resumePC=()=>{pcPaused=false;pauseShade.style.display='none';pressedKeys.clear();requestMouse();};
  pauseShade.querySelector('#pc-resume').addEventListener('click',resumePC);
  document.addEventListener('pointerlockchange',()=>{
    if(document.pointerLockElement!==mount && started && isPC() && !pcPaused && !sceneEditorActive && !freeCursorByRightClick){pcPaused=true;pauseShade.style.display='flex';pressedKeys.clear();}
  });
  document.addEventListener('mousemove',e=>{
    if(document.pointerLockElement!==mount||!started||pcPaused||sceneEditorActive||!isPC())return;
    camYaw-=e.movementX*.006;
    camPitch=THREE.MathUtils.clamp(camPitch+e.movementY*.0045,CAM_PITCH_MIN,CAM_PITCH_MAX);
  });
  document.addEventListener('keydown',e=>{
    if(e.code==='Escape'&&started&&isPC()&&!sceneEditorActive){
      pcPaused=true;pauseShade.style.display='flex';pressedKeys.clear();
      if(document.pointerLockElement===mount)document.exitPointerLock?.();
      e.preventDefault();
    }
  });
  // PC: botão direito libera cursor sem pausar; botão esquerdo é Ação quando a câmera está capturada.
  mount.addEventListener('contextmenu', e=>{if(started && isPC()){e.preventDefault();}}, true);
  mount.addEventListener('mousedown', e=>{
    if(!started || !isPC() || pcPaused || sceneEditorActive)return;
    if(e.button===2){
      e.preventDefault();
      freeCursorByRightClick=true;
      if(document.pointerLockElement===mount)document.exitPointerLock?.();
      return;
    }
    if(e.button===0 && document.pointerLockElement===mount){e.preventDefault();doAction();}
  }, true);
  // Expor funções apenas aos botões Novo/Continuar e ao laço principal.
  window.__ursoMouseControl={requestMouse,isPaused:()=>pcPaused,isPC};
  mount.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&isPC()){if(e.button===2)return;if(!sceneEditorActive&&!pcPaused&&e.button===0&&document.pointerLockElement!==mount)requestMouse();return;}
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
  introButton.textContent='NOVO JOGO';
  const savedGame=readSession();
  const continueButton=document.getElementById('continue-game');
  continueButton.disabled=!savedGame;
  continueButton.textContent=savedGame?'CONTINUAR PARTIDA':'CONTINUAR (sem partida salva)';
  configurePlatform(localStorage.getItem('tio-urso-platform-v100')||'auto');
  document.getElementById('platform-select').addEventListener('change',e=>configurePlatform(e.target.value));
  document.getElementById('platform-select').value=selectedPlatform;
  window.setInterval(saveSession,5000);
  window.addEventListener('pagehide',saveSession);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveSession()});
  el('load-info').textContent=loaded?(comboAnim?'Tio Urso animado: caminhada, corrida e combo de golpes!':hasRiggedAnimations?'Caminhada e corrida prontas!':'Tio Urso 3D carregado!'):'Modelo não carregou; modo reserva disponível.';
  introButton.addEventListener('click',async()=>{
    if(!ready)return;
    resetSession();
    started=true;el('intro').style.display='none';
    window.__ursoMouseControl?.requestMouse();
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
  continueButton.addEventListener('click',async()=>{
    if(!ready||!restoreSession())return;
    started=true;el('intro').style.display='none';
    window.__ursoMouseControl?.requestMouse();
    document.body.classList.add('patrulha-iniciada');
    initializeAudio();await requestLandscapeForGame();
    notify('Partida retomada no local salvo!',2500);
  });
  loop();
} catch(error){
  console.error(error);
  el('fatal').hidden=false;
  el('fatal-reason').textContent='Confira sua conexão com a internet e tente novamente. O carregamento das bibliotecas 3D requer acesso à rede.';
}

// Ferramenta opcional: escolha da vaga da Fastback no próprio minimapa ampliado.
(function setupFastbackCalibration(){
 const panel=document.getElementById('bigmap-panel');if(!panel)return;
 const menu=document.createElement('div');menu.style.cssText='display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:95vw';
 menu.innerHTML='<button id="park-select">📍 Marcar vaga da Fastback</button><button id="park-left">↶ Girar -15°</button><button id="park-right">↷ Girar +15°</button><button id="park-copy">Copiar vaga</button><button id="park-xminus">← 1 m</button><button id="park-xplus">1 m →</button><button id="park-zminus">↑ 1 m</button><button id="park-zplus">1 m ↓</button>';
 panel.appendChild(menu);
 let parkingMode=false;
 const el2=(id)=>document.getElementById(id);
 el2('park-select').onclick=()=>{parkingMode=!parkingMode;el2('park-select').textContent=parkingMode?'Toque na vaga EXCLUSIVA no mapa':'📍 Marcar vaga da Fastback'};
 const canvas=el2('bigmap-canvas');canvas.addEventListener('click',e=>{
  if(!parkingMode||!player)return;
  const rect=canvas.getBoundingClientRect();const xx=(e.clientX-rect.left)/rect.width*mini.width,zz=(e.clientY-rect.top)/rect.height*mini.height;
  // Mesmo calculo usado pelo minimapa (1.54 pixel por unidade real relativa ao Tio Urso).
  const spot={x:player.position.x+(xx-mini.width/2)/1.54,z:player.position.z+(zz-mini.height/2)/1.54,rot:0};
  try{localStorage.setItem(PARKING_KEY,JSON.stringify(spot))}catch{}
  applyFastbackSpot(spot);parkingMode=false;el2('park-select').textContent='📍 Marcar vaga da Fastback';
  alert('Vaga marcada. Confira a viatura no cenário; ajuste girando ±15°.');
 });
 for(const [id,amount] of [['park-left',-15],['park-right',15]])el2(id).onclick=()=>{
  const spot=readFastbackSpot();if(!spot){alert('Marque uma vaga primeiro.');return;}
  spot.rot=(spot.rot||0)+amount*Math.PI/180;localStorage.setItem(PARKING_KEY,JSON.stringify(spot));applyFastbackSpot(spot);
 };
 for(const [id,dx,dz] of [['park-xminus',-1,0],['park-xplus',1,0],['park-zminus',0,-1],['park-zplus',0,1]]) el2(id).onclick=()=>{
   const spot=readFastbackSpot()||{...FASTBACK_PREVIEW_SPOT};
   spot.x+=dx;spot.z+=dz;
   localStorage.setItem(PARKING_KEY,JSON.stringify(spot));applyFastbackSpot(spot);
 };
 el2('park-copy').onclick=()=>{const spot=readFastbackSpot()||FASTBACK_PREVIEW_SPOT;const exportSpot={source:'topoexport-71F678',fastback:{x:spot.x+GEO_CENTER.x,z:spot.z+GEO_CENTER.z,rotacaoGraus:+((spot.rot||0)*180/Math.PI).toFixed(2)}};navigator.clipboard?.writeText(JSON.stringify(exportSpot,null,2));alert('Coordenadas da vaga copiadas.');};
})();

// ===== TIO URSO: EDITOR DE CENÁRIO v1.0.19 (opcional, não altera menu) =====
(function setupSceneEditor119(){
 const SAVE='tio-urso-editor-v122';
 // Último JSON enviado pelo usuário, exportação 5: apenas TPX_Buildings_0 alterado.
 // Não aplicar coordenadas da Fastback ou NPCs como novos padrões, pois podem ser originais.
 const approvedPreset={'map-1372':{x:0,y:-0.4398979748892238,z:0,ry:0,scale:1}};
 let saved={...approvedPreset};
 try{const prior=JSON.parse(localStorage.getItem(SAVE)||'null');if(prior&&typeof prior==='object')saved={...saved,...prior}}catch{}
 const refs=new Map();let selected='',step=.25,editing=false,outline=null;
 const css=document.createElement('style');css.textContent=`
 #edit119-open{position:fixed;bottom:12px;left:12px;z-index:890;background:#142d45;color:#fff;border:1px solid #d7ab50;border-radius:9px;padding:8px;font:600 12px system-ui;display:none}
 #edit119{position:fixed;right:8px;top:6px;bottom:6px;max-width:min(350px,94vw);width:320px;overflow:auto;z-index:920;background:#091c30f5;color:#fff;border:1px solid #d7ab50;border-radius:12px;padding:12px;font:13px system-ui;box-shadow:0 10px 26px #0008;display:none}
 #edit119 button,#edit119 select,#edit119 input{background:#203e5d;color:white;border:1px solid #6b849c;border-radius:6px;padding:8px;min-height:34px;font:12px system-ui}
 #edit119 .edit-row{display:flex;gap:5px;margin:6px 0;align-items:center;flex-wrap:wrap}
 #edit119 .edit-row button{flex:1}#edit119 select{width:100%}#edit119 input{width:70px}#edit119 label{min-width:60px}
 #edit119 .editwarn{font-size:11px;color:#eccd86}
 `;document.head.appendChild(css);
 const open=document.createElement('button');open.id='edit119-open';open.textContent='🛠 Editor de cenário';document.body.appendChild(open);
 const panel=document.createElement('section');panel.id='edit119';panel.innerHTML=`
 <div class="edit-row"><strong style="flex:1;font-size:17px">🛠 Editor de cenário</strong><button id="ed119-close">Fechar</button></div>
 <div class="editwarn">Modo experimental. Ajustes só neste dispositivo até exportar o JSON. O menu inicial não é alterado.</div>
 <div class="edit-row"><button id="ed119-refresh">Atualizar lista</button><button id="ed119-pick">Selecionar tocando no 3D</button></div>
 <select id="ed119-objects"></select><div id="ed119-status" class="editwarn">Carregue o jogo antes de editar.</div>
 <div class="edit-row"><label>Passo</label><select id="ed119-step" style="width:92px"><option value="0.05">0,05 m</option><option value="0.25" selected>0,25 m</option><option value="1">1 m</option><option value="5">5 m</option></select></div>
 <div class="edit-row"><label>Lateral X</label><button data-ed119="x:-1">−</button><button data-ed119="x:1">+</button></div>
 <div class="edit-row"><label>Altura Y</label><button data-ed119="y:-1">−</button><button data-ed119="y:1">+</button><button id="ed119-ground">Encostar no chão</button></div>
 <div class="edit-row"><label>Fundo Z</label><button data-ed119="z:-1">−</button><button data-ed119="z:1">+</button></div>
 <div class="edit-row"><label>Giro</label><button data-ed119="rot:-1">− 5°</button><button data-ed119="rot:1">+ 5°</button></div>
 <div class="edit-row"><label>Escala</label><button data-ed119="scale:-1">− 5%</button><button data-ed119="scale:1">+ 5%</button></div>
 <div class="edit-row"><button id="ed119-undo">Desfazer último</button><button id="ed119-reset">Restaurar objeto</button></div>
 <div class="edit-row"><button id="ed119-save">Salvar ajustes</button><button id="ed119-copy">Copiar JSON</button></div>
 <pre id="ed119-values" style="white-space:pre-wrap;font-size:11px;background:#142d45;border-radius:8px;padding:8px"></pre>
 <div class="editwarn">Prédios e árvores importados poderão ser selecionados tocando em sua geometria. Colisões e terreno não são reconstruídos por este editor.</div>
 `;document.body.appendChild(panel);
 const $=s=>panel.querySelector(s), list=$('#ed119-objects'),status=$('#ed119-status');
 const states=[];
 const serialize=o=>({x:o.position.x,y:o.position.y,z:o.position.z,ry:o.rotation.y,scale:o.scale.x});
 const restore=(o,v)=>{if(!o||!v)return;o.position.set(v.x,v.y,v.z);o.rotation.y=v.ry;o.scale.setScalar(v.scale);o.updateMatrixWorld(true)};
 function register(id,label,obj){if(!obj||!obj.isObject3D)return;const prev=refs.get(id);if(prev?.obj===obj)return;const original=serialize(obj);refs.set(id,{obj,label,original});if(saved[id])restore(obj,saved[id]);}
 function refresh(){
  if(typeof fastbackObj!=='undefined'&&fastbackObj)register('fastback','Fastback GM',fastbackObj);
  if(typeof citizenNodes!=='undefined')citizenNodes.forEach((c,i)=>register('npc-'+i,'Cidadão '+(i+1),c.citizen));
  if(typeof scene!=='undefined'&&scene){let count=0;scene.traverse(o=>{if(!o.isMesh||count>=70)return;const n=(o.name||'').toLowerCase();if(/tree|arbor|veget|building|edif|house|roof/i.test(n)){register('map-'+o.id,`${/tree|arbor|veget/i.test(n)?'Árvore':'Prédio'} · ${o.name||o.id}`,o);count++;}})}
  const existing=list.value;list.replaceChildren();for(const [id,r] of refs){const op=document.createElement('option');op.value=id;op.textContent=r.label;list.appendChild(op)}
  selected=refs.has(existing)?existing:(refs.has(selected)?selected:(refs.keys().next().value||''));list.value=selected;show();
 }
 function show(){const r=refs.get(selected);status.textContent=r?'Selecionado: '+r.label:'Nenhum objeto carregado ainda';$('#ed119-values').textContent=r?JSON.stringify(serialize(r.obj),null,2):'Aguarde o carregamento';}
 function edit(k,d){const r=refs.get(selected);if(!r)return;states.push({id:selected,value:serialize(r.obj)});if(states.length>40)states.shift();const o=r.obj;switch(k){case'x':o.position.x+=d*step;break;case'y':o.position.y+=d*step;break;case'z':o.position.z+=d*step;break;case'rot':o.rotation.y+=d*Math.PI/36;break;case'scale':o.scale.multiplyScalar(d>0?1.05:1/1.05)}o.updateMatrixWorld(true);show()}
 const setEditorActive=active=>document.dispatchEvent(new CustomEvent('urso-editor-mode',{detail:{active}}));
 open.onclick=()=>{editing=true;setEditorActive(true);panel.style.display='block';refresh();};
 document.addEventListener('keydown',e=>{if(e.code==='F8' && typeof started!=='undefined'&&started){e.preventDefault();if(editing){editing=false;panel.style.display='none';picking=false;setEditorActive(false)}else open.click();}},true);
 $('#ed119-close').onclick=()=>{editing=false;panel.style.display='none';picking=false;setEditorActive(false)};
 $('#ed119-refresh').onclick=refresh;
 list.onchange=()=>{selected=list.value;show()};
 $('#ed119-step').onchange=e=>step=Number(e.target.value)||.25;
 panel.querySelectorAll('[data-ed119]').forEach(b=>b.onclick=()=>{const [k,v]=b.dataset.ed119.split(':');edit(k,Number(v))});
 $('#ed119-ground').onclick=()=>{const r=refs.get(selected);if(!r||typeof surfaceHeight!=='function')return;states.push({id:selected,value:serialize(r.obj)});const bbox=new THREE.Box3().setFromObject(r.obj);r.obj.position.y+=surfaceHeight(r.obj.position.x,r.obj.position.z)-bbox.min.y;show()};
 $('#ed119-undo').onclick=()=>{const s=states.pop();if(s&&refs.has(s.id)){selected=s.id;restore(refs.get(s.id).obj,s.value);list.value=s.id;show()}};
 $('#ed119-reset').onclick=()=>{const r=refs.get(selected);if(r){states.push({id:selected,value:serialize(r.obj)});restore(r.obj,r.original);show()}};
 function exportData(){const items={};for(const [id,r] of refs)items[id]={name:r.label,...serialize(r.obj)};return {source:'topoexport-71F678',editor:'v1.0.19',items}}
 $('#ed119-save').onclick=()=>{saved={};for(const [id,r] of refs)saved[id]=serialize(r.obj);try{localStorage.setItem(SAVE,JSON.stringify(saved));status.textContent='Ajustes salvos neste navegador.'}catch{status.textContent='Falha no armazenamento local.'}};
 $('#ed119-copy').onclick=async()=>{const t=JSON.stringify(exportData(),null,2);try{await navigator.clipboard.writeText(t);status.textContent='JSON copiado. Envie aqui no chat.'}catch{prompt('Copie o JSON:',t)}};
 let picking=false;$('#ed119-pick').onclick=()=>{picking=true;panel.style.display='none';open.textContent='Toque no objeto para selecionar';};
 document.addEventListener('pointerdown',e=>{if(!picking||!renderer||!camera||!scene||e.target!==renderer.domElement)return;const b=renderer.domElement.getBoundingClientRect();const pos=new THREE.Vector2(2*(e.clientX-b.left)/b.width-1,1-2*(e.clientY-b.top)/b.height);const ray=new THREE.Raycaster();ray.setFromCamera(pos,camera);const hits=ray.intersectObjects([...scene.children],true);for(const h of hits){let obj=h.object;while(obj&&!Array.from(refs.values()).some(r=>r.obj===obj))obj=obj.parent;if(obj){const match=[...refs].find(([,r])=>r.obj===obj);if(match){selected=match[0];break}}else if(h.object.isMesh){const id='custom-'+h.object.id;register(id,'Objeto 3D · '+(h.object.name||h.object.id),h.object);selected=id;break}}picking=false;open.textContent='🛠 Editor de cenário';panel.style.display='block';setEditorActive(true);refresh();e.stopPropagation();e.preventDefault()},true);
 const watcher=setInterval(()=>{if(typeof started!=='undefined'&&started){open.style.display='block';if(editing)refresh()}},1500);
})();
