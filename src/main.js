import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createTextures } from './textures.js';
import { MAPS } from './maps.js';
import { World, rayVCyl, raySphere } from './world.js';
import { WEAPONS, PRIMARIES, SECONDARIES, NADES, NADE_MAX, PRICES, killReward, buildGun, buildNadeModel, gunMats } from './weapons.js';
import { createSoldier } from './characters.js';
import { Audio } from './audio.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SKINS, CASES, RARITY, RARITY_ORDER, inv, saveInv, addItem, equippedSkin, equip, sell, rollCase } from './skins.js';

const $ = id => document.getElementById(id);
const TEAM_NAME = { T: 'SALDIRI', CT: 'SAVUNMA' };
const BOT_NAMES = ['Kartal', 'Bozkurt', 'Ghost', 'Viper', 'Atlas', 'Raven', 'Tank', 'Shadow', 'Falcon', 'Kobra', 'Neo', 'Arda', 'Mert', 'Efe', 'Blaze', 'Rex', 'Storm', 'Toprak', 'Yiğit', 'Hawk'];
const WIN_ROUNDS = 7;
const DIFF = [
  { react: 0.6, err: 0.055, turn: 4.0, head: 0.12, burst: 4 },
  { react: 0.38, err: 0.032, turn: 6.5, head: 0.25, burst: 5 },
  { react: 0.22, err: 0.018, turn: 10, head: 0.42, burst: 7 },
];

// ---------- settings ----------
const settings = { map: 'sandstorm', team: 'T', diff: 1, size: 5, sens: 1.2, fov: 80, vol: 0.6, quality: 2, dmgNums: true, killcam: true };
const CH_DEFAULT = { style: 'classic', color: '#4dff7a', size: 9, thick: 2, gap: 4, outline: true, dynamic: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('sz_settings') || '{}')); } catch (e) { /* ignore */ }
settings.ch = { ...CH_DEFAULT, ...(settings.ch || {}) };
const saveSettings = () => { try { localStorage.setItem('sz_settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } };

// ---------- renderer ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.quality >= 2 ? 1.5 : 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = settings.quality > 0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

const tex = createTextures(renderer);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const scene = new THREE.Scene();
scene.environment = envTex;
scene.environmentIntensity = 0.3;
const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, 1200);
camera.rotation.order = 'YXZ';
scene.add(camera);

const vmScene = new THREE.Scene();
vmScene.environment = envTex;
vmScene.environmentIntensity = 1.0;
const vmCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10);
const vmHemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1.2); vmScene.add(vmHemi);
const vmSun = new THREE.DirectionalLight(0xffffff, 2.2); vmSun.position.set(0.5, 1, 0.3); vmScene.add(vmSun);
const vmFlashLight = new THREE.PointLight(0xffb060, 0, 2); vmFlashLight.position.set(0.2, -0.1, -0.9); vmScene.add(vmFlashLight);

// ---------- post processing ----------
let composer = null, gtaoPass = null;
function setupComposer() {
  if (settings.quality < 1) { composer = null; return; }
  const w = window.innerWidth, h = window.innerHeight;
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  if (settings.quality >= 2) {
    gtaoPass = new GTAOPass(scene, camera, w, h);
    gtaoPass.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.2, thickness: 1.5, scale: 1.0, samples: 12 });
    gtaoPass.blendIntensity = 0.85;
    composer.addPass(gtaoPass);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.28, 0.45, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
setupComposer();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = vmCamera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix(); vmCamera.updateProjectionMatrix();
});

const audio = new Audio();

// ---------- sky ----------
function makeSky(env) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(env.skyTop) }, hor: { value: new THREE.Color(env.skyHorizon) },
      sun: { value: new THREE.Vector3(...env.sunDir).normalize() }, sunCol: { value: new THREE.Color(env.sunColor) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sun; uniform vec3 sunCol; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = max(d.y, 0.0);
        vec3 c = mix(hor, top, pow(h, 0.5));
        if (d.y < 0.0) c = hor * 0.9;
        float s = max(dot(d, sun), 0.0);
        c += sunCol * (pow(s, 1200.0) * 8.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.08);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -1;
  return m;
}

// ---------- effects ----------
const fx = { decals: [], puffs: [], tracers: [], flashes: [] };
const decalGeo = new THREE.PlaneGeometry(0.14, 0.14);
const decalMat = new THREE.MeshBasicMaterial({ map: tex.decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const tracerGeo = new THREE.BoxGeometry(0.012, 0.012, 1); tracerGeo.translate(0, 0, -0.5);
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
const flashMat = new THREE.SpriteMaterial({ map: tex.flash, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const worldFlashLight = new THREE.PointLight(0xffb070, 0, 9, 2); scene.add(worldFlashLight);
const botFlashLight = new THREE.PointLight(0xffb070, 0, 8, 2); scene.add(botFlashLight);

function addDecal(point, normal) {
  let d;
  if (fx.decals.length > 140) d = fx.decals.shift();
  else { d = new THREE.Mesh(decalGeo, decalMat); }
  scene.add(d);
  d.position.copy(point).addScaledVector(normal, 0.01);
  d.lookAt(point.clone().add(normal));
  d.rotation.z = Math.random() * 6.28;
  const s = 0.7 + Math.random() * 0.6; d.scale.set(s, s, s);
  fx.decals.push(d);
}
function addPuff(point, normal, color, count = 4, size = 0.35) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.SpriteMaterial({ map: tex.puff, color, transparent: true, opacity: 0.7, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.position.copy(point);
    s.scale.setScalar(size * 0.4);
    const v = normal.clone().multiplyScalar(1.2 + Math.random() * 1.5).add(new THREE.Vector3((Math.random() - .5) * 1.2, Math.random() * 1.2, (Math.random() - .5) * 1.2));
    scene.add(s);
    fx.puffs.push({ s, v, life: 0, max: 0.5 + Math.random() * 0.4, size });
  }
}
function addTracer(from, to) {
  const len = from.distanceTo(to);
  if (len < 1.5) return;
  const m = new THREE.Mesh(tracerGeo, tracerMat.clone());
  m.position.copy(from); m.lookAt(to); m.scale.set(1, 1, Math.min(len, 18));
  m.userData.v = new THREE.Vector3().subVectors(to, from).normalize().multiplyScalar(220);
  m.userData.remain = len;
  scene.add(m);
  fx.tracers.push({ m, life: 0 });
}
function addWorldFlash(pos, light) {
  const s = new THREE.Sprite(flashMat);
  s.position.copy(pos); s.scale.setScalar(0.5 + Math.random() * 0.3);
  s.material.rotation = Math.random() * 6;
  scene.add(s);
  fx.flashes.push({ s, life: 0 });
  if (light) { light.position.copy(pos); light.intensity = 12; }
}
function updateFx(dt) {
  for (let i = fx.puffs.length - 1; i >= 0; i--) {
    const p = fx.puffs[i]; p.life += dt;
    p.v.multiplyScalar(1 - dt * 3); p.v.y -= dt * 0.6;
    p.s.position.addScaledVector(p.v, dt);
    const k = p.life / p.max;
    p.s.scale.setScalar(p.size * (0.4 + k * 1.6));
    p.s.material.opacity = 0.65 * (1 - k);
    if (k >= 1) { scene.remove(p.s); p.s.material.dispose(); fx.puffs.splice(i, 1); }
  }
  for (let i = fx.tracers.length - 1; i >= 0; i--) {
    const t = fx.tracers[i]; t.life += dt;
    const step = t.m.userData.v.length() * dt;
    t.m.position.addScaledVector(t.m.userData.v, dt);
    t.m.userData.remain -= step;
    t.m.material.opacity = 0.8 * (1 - t.life / 0.12);
    if (t.life > 0.12 || t.m.userData.remain < 0) { scene.remove(t.m); t.m.material.dispose(); fx.tracers.splice(i, 1); }
  }
  for (let i = fx.flashes.length - 1; i >= 0; i--) {
    const f = fx.flashes[i]; f.life += dt;
    if (f.life > 0.05) { scene.remove(f.s); fx.flashes.splice(i, 1); }
  }
  worldFlashLight.intensity = Math.max(0, worldFlashLight.intensity - dt * 300);
  botFlashLight.intensity = Math.max(0, botFlashLight.intensity - dt * 300);
  vmFlashLight.intensity = Math.max(0, vmFlashLight.intensity - dt * 200);
}
function clearFx() {
  for (const d of fx.decals) scene.remove(d);
  for (const p of fx.puffs) scene.remove(p.s);
  for (const t of fx.tracers) scene.remove(t.m);
  for (const f of fx.flashes) scene.remove(f.s);
  fx.decals = []; fx.puffs = []; fx.tracers = []; fx.flashes = [];
}

// ---------- game state ----------
const G = {
  state: 'menu', world: null, mapDef: null, sky: null, lights: [],
  actors: [], player: null, round: 1, score: { T: 0, CT: 0 },
  phase: 'freeze', freezeT: 0, roundT: 0, endT: 0, time: 0,
  intel: { T: null, CT: null }, test: false, rec: [], killcam: null,
  keys: {}, mouseDown: false, rightDown: false, firedThisPress: false,
  spectate: null, deathT: 0,
  loadout: { primary: null, secondary: null },
};

function disposeWorld() {
  if (!G.world) return;
  scene.remove(G.world.group);
  G.world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  for (const l of G.lights) scene.remove(l);
  if (G.sky) scene.remove(G.sky);
  for (const a of G.actors) if (a.model) scene.remove(a.model);
  if (G.playerModel) { scene.remove(G.playerModel); G.playerModel = null; }
  clearFx();
  G.world = null; G.lights = []; G.actors = [];
}

function buildMap(id) {
  disposeWorld();
  const def = MAPS[id]();
  G.mapDef = def;
  G.world = new World(scene, def, tex);
  const env = def.env;
  scene.fog = new THREE.Fog(env.fog, env.fogNear, env.fogFar);
  renderer.toneMappingExposure = env.exposure;
  G.sky = makeSky(env); scene.add(G.sky);
  const hemi = new THREE.HemisphereLight(0xdfe9ff, env.groundColor, env.hemiInt);
  const sun = new THREE.DirectionalLight(env.sunColor, env.sunInt);
  const W = def.w * def.cell, H = def.h * def.cell;
  const c = new THREE.Vector3(W / 2, 0, H / 2);
  const sd = new THREE.Vector3(...env.sunDir).normalize();
  sun.position.copy(c).addScaledVector(sd, 160);
  sun.target.position.copy(c);
  sun.castShadow = settings.quality > 0;
  const ext = Math.max(W, H) * 0.75;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 400 });
  const ms = settings.quality >= 2 ? 4096 : 2048;
  sun.shadow.mapSize.set(ms, ms);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(hemi, sun, sun.target);
  G.lights = [hemi, sun, sun.target];
  vmSun.color.setHex(env.sunColor);
  vmHemi.groundColor.setHex(env.groundColor);
}

// ---------- actors ----------
let actorId = 0;
function makeActor(team, isPlayer, name) {
  const a = {
    id: actorId++, team, isPlayer, name,
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
    hp: 100, armor: 100, alive: true, onGround: true, crouch: false, eye: 1.62,
    weapon: 'knife', loadout: { 1: null, 2: 'glock', 3: 'knife' }, ammo: {},
    kills: 0, deaths: 0, hs: 0, spottedT: -99, model: null, deathAnim: 0, stepT: 0,
    ai: null, money: 800, helmet: false, kit: false, nades: { he: 0, flash: 0, smoke: 0 }, hasBomb: false,
  };
  if (!isPlayer) {
    a.skins = {};
    for (const k in SKINS) if (Math.random() < 0.25 && !a.skins[SKINS[k].weapon]) a.skins[SKINS[k].weapon] = k;
    a.model = createSoldier(team, 'ak', tex);
    scene.add(a.model);
  }
  return a;
}

function giveWeapon(a, id) {
  const w = WEAPONS[id];
  a.loadout[w.slot] = id;
  a.ammo[id] = { mag: w.mag, res: w.reserve };
}

function setupActors() {
  const size = Math.max(1, settings.size);
  G.actors = [];
  const pt = settings.team;
  G.player = makeActor(pt, true, 'Sen');
  G.actors.push(G.player);
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  let n = 0;
  for (const team of ['T', 'CT']) {
    const count = team === pt ? size - 1 : size;
    for (let i = 0; i < count; i++) G.actors.push(makeActor(team, false, names[n++ % names.length]));
  }
}

function botLoadout(a) {
  if (G.mapDef.weapons === 'sniper') return { p: 'awm', s: 'deagle' };
  const r = Math.random();
  const p = r < 0.18 ? 'awm' : r < 0.28 ? 'mp5' : (a.team === 'T' ? 'ak' : 'm4');
  return { p, s: Math.random() < 0.3 ? 'deagle' : 'glock' };
}

function spawnCells(team) {
  const w = G.world;
  return w.cellsOfType(team === 'T' ? ['T'] : ['X']).sort(() => Math.random() - 0.5);
}

function startMatch() {
  G.score = { T: 0, CT: 0 }; G.round = 1; G.lossStreak = { T: 0, CT: 0 };
  buildMap(settings.map);
  G.bombMode = G.mapDef.mode === 'bomb';
  setupActors();
  buildRadarBase();
  if (G.mapDef.weapons === 'sniper') G.loadout = { primary: 'awm', secondary: 'deagle' };
  else if (!G.loadout.primary) G.loadout = { primary: settings.team === 'T' ? 'ak' : 'm4', secondary: 'glock' };
  startRound();
  G.state = 'playing';
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
}

function startRound() {
  clearFx();
  const w = G.world, C = w.cell;
  const cells = { T: spawnCells('T'), CT: spawnCells('CT') };
  G.plan = Math.random() < 0.5 ? 'A' : 'B';
  G.shake = 0;
  const center = new THREE.Vector3(w.w * C / 2, 0, w.h * C / 2);
  for (const a of G.actors) {
    const cell = cells[a.team].pop() || cells[a.team][0] || [1, 1];
    const [x, z] = w.center(cell[0], cell[1]);
    a.pos.set(x + (Math.random() - 0.5) * C * 0.3, 0, z + (Math.random() - 0.5) * C * 0.3);
    a.vel.set(0, 0, 0);
    a.yaw = Math.atan2(-(center.x - a.pos.x), -(center.z - a.pos.z));
    const survived = a.alive && G.round > 1;
    a.pitch = 0; a.hp = 100; a.alive = true; a.crouch = false; a.deathAnim = 0; a.hasBomb = false; a.flashT = 0;
    if (!G.bombMode) {
      a.ammo = {}; a.loadout = { 1: null, 2: null, 3: 'knife' };
      a.armor = 100; a.helmet = true;
      if (a.isPlayer) { giveWeapon(a, G.loadout.primary); giveWeapon(a, G.loadout.secondary); }
      else { const lo = botLoadout(a); giveWeapon(a, lo.p); giveWeapon(a, lo.s); }
      a.nades = { he: 0, flash: 1, smoke: 1 };
    } else if (!survived) {
      a.ammo = {}; a.loadout = { 1: null, 2: null, 3: 'knife' };
      giveWeapon(a, 'glock');
      a.armor = 0; a.helmet = false; a.kit = false;
      a.nades = { he: 0, flash: 0, smoke: 0 };
    } else {
      for (const id in a.ammo) { const w = WEAPONS[id]; a.ammo[id] = { mag: w.mag, res: w.reserve }; }
      if (a.team === 'T') a.kit = false;
    }
    giveWeapon(a, 'knife');
    if (G.bombMode && !a.isPlayer) botBuy(a);
    a.weapon = a.loadout[1] || a.loadout[2];
    if (a.model) {
      a.model.visible = true;
      a.model.userData.setWeapon(a.weapon, a.skins[a.weapon]);
      a.model.userData.body.rotation.set(0, 0, 0);
      a.model.userData.body.position.set(0, 0, 0);
      a.model.position.copy(a.pos);
      a.model.rotation.y = a.yaw;
      initAI(a);
    }
  }
  G.intel = { T: null, CT: null };
  resetBomb();
  clearNades();
  G.phase = 'freeze'; G.freezeT = G.mapDef.weapons === 'sniper' ? 2.5 : 6; G.roundT = G.mapDef.weapons === 'sniper' ? 90 : 115;
  G.spectate = null; G.deathT = 0;
  endKillcam(); G.killcamDone = false; G.rec = []; G.lastAttacker = null;
  resetPlayerWeaponState();
  showBanner(`ROUND ${G.round}`, G.round === 1 ? `${TEAM_NAME[G.player.team]} takımındasın · İlk ${WIN_ROUNDS} round kazanan alır` : `${TEAM_NAME.T} ${G.score.T} - ${G.score.CT} ${TEAM_NAME.CT}`, null, 2.5);
  audio.beep(660, 0.1);
}

function endRound(winner, reason, kind = 'elim') {
  if (G.phase === 'end') return;
  G.phase = 'end'; G.endT = 4.5;
  G.score[winner]++;
  if (G.bombMode) {
    const loser = winner === 'T' ? 'CT' : 'T';
    G.lossStreak[winner] = 0;
    const winMoney = kind === 'bomb' || kind === 'defuse' ? 3500 : 3250;
    const lossMoney = 1400 + 500 * Math.min(4, G.lossStreak[loser]);
    G.lossStreak[loser]++;
    for (const a of G.actors) {
      if (a.team === winner) addMoney(a, winMoney);
      else addMoney(a, lossMoney + (a.team === 'T' && G.bomb.planted ? 800 : 0));
    }
    const pm = G.player.team === winner ? winMoney : lossMoney;
    setTimeout(() => moneyPopup(`+$${pm} round ${G.player.team === winner ? 'galibiyeti' : 'kaybı'}`), 600);
  }
  const mine = winner === G.player.team;
  showBanner(`${TEAM_NAME[winner]} KAZANDI`, reason, winner, 4);
  audio.win(mine);
}

function endMatch() {
  G.state = 'end';
  if (document.pointerLockElement) document.exitPointerLock();
  const win = G.score[G.player.team] >= WIN_ROUNDS;
  $('endTitle').textContent = win ? 'ZAFER' : 'MAĞLUBİYET';
  $('endTitle').style.color = win ? '#7dff9a' : '#ff6060';
  $('endScore').innerHTML = `<span style="color:#f0a64a">${G.score.T}</span> : <span style="color:#5fb3ff">${G.score.CT}</span>`;
  $('endBoard').innerHTML = scoreboardHTML();
  const p = G.player;
  const earned = p.kills * 10 + G.score[p.team] * 20 + (win ? 100 : 30);
  stats.matches++; if (win) stats.wins++;
  stats.roundsWon += G.score[p.team]; stats.roundsPlayed += G.score.T + G.score.CT;
  stats.mapPlays[settings.map] = (stats.mapPlays[settings.map] || 0) + 1;
  stats.goldEarned += earned;
  saveStats();
  inv.gold += earned; saveInv();
  $('endGold').innerHTML = `+${earned} <span class="coin">◆</span> altın kazandın <small>(toplam ${inv.gold})</small>`;
  updateGoldUI();
  $('end').classList.remove('hidden');
}

// ---------- player weapon state ----------
const PW = { switchT: 0, reloadT: 0, fireCd: 0, burst: 0, lastShot: 0, scope: 0, boltT: 0, wantScope: 0, kick: 0, recoilAcc: 0, knifeT: 0, swayX: 0, swayY: 0, bob: 0 };
function resetPlayerWeaponState() {
  Object.assign(PW, { switchT: 0.4, reloadT: 0, fireCd: 0, burst: 0, scope: 0, boltT: 0, wantScope: 0, kick: 0, recoilAcc: 0, knifeT: 0 });
  buildViewModel();
}

let vmRoot = null, vmGun = null;
function buildViewModel() {
  if (vmRoot) vmScene.remove(vmRoot);
  const p = G.player;
  vmRoot = new THREE.Group();
  vmGun = buildGun(p.weapon, tex, equippedSkin(p.weapon));
  vmRoot.add(vmGun);
  const sleeve = new THREE.MeshStandardMaterial({ color: p.team === 'T' ? 0x6e5b3c : 0x3b4a5c, roughness: 0.9 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.65 });
  const limb = (a, b, r, mat) => {
    const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    vmGun.add(m);
  };
  const w = WEAPONS[p.weapon];
  const pistol = w.slot === 2, knife = w.melee;
  const rh = knife ? new THREE.Vector3(0, -0.01, 0.02) : new THREE.Vector3(0, -0.05, 0.05);
  const re = new THREE.Vector3(0.1, -0.3, 0.38);
  limb(rh, re, 0.042, sleeve);
  limb(re, re.clone().add(new THREE.Vector3(0.05, -0.2, 0.3)), 0.055, sleeve);
  const gr = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.085, 0.1), glove); gr.position.copy(rh); vmGun.add(gr);
  const lhPos = vmGun.userData.leftHand;
  if (lhPos) {
    const le = pistol ? new THREE.Vector3(-0.14, -0.3, 0.35) : new THREE.Vector3(-0.2, -0.26, lhPos.z + 0.32);
    limb(lhPos.clone().add(new THREE.Vector3(-0.02, -0.03, 0.02)), le, 0.042, sleeve);
    limb(le, le.clone().add(new THREE.Vector3(-0.08, -0.2, 0.3)), 0.055, sleeve);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.1), glove); gl.position.copy(lhPos).add(new THREE.Vector3(-0.015, -0.025, 0)); vmGun.add(gl);
  }
  vmGun.traverse(o => { if (o.isMesh) o.castShadow = false; });
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.flash, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  fl.visible = false; fl.scale.setScalar(0.18);
  vmGun.userData.muzzle.add(fl);
  vmGun.userData.flash = fl;
  const VB = { he: [0.15, -0.15, -0.3], flash: [0.15, -0.15, -0.3], smoke: [0.15, -0.15, -0.3], ak: [0.15, -0.17, -0.46], m4: [0.15, -0.17, -0.47], awm: [0.17, -0.21, -0.62], mp5: [0.14, -0.16, -0.42], glock: [0.12, -0.12, -0.36], deagle: [0.12, -0.125, -0.4], knife: [0.17, -0.17, -0.42] };
  vmRoot.userData.base = new THREE.Vector3(...VB[p.weapon]);
  if (knife) vmGun.rotation.set(0.55, 0.75, 0.15);
  vmScene.add(vmRoot);
}

function switchWeapon(slot) {
  const p = G.player;
  const id = slot === 4 ? nextNade(p) : p.loadout[slot];
  if (!id || id === p.weapon || !p.alive) return;
  p.weapon = id;
  PW.switchT = WEAPONS[id].melee ? 0.3 : 0.45; PW.reloadT = 0; PW.scope = 0; PW.boltT = 0; PW.burst = 0;
  buildViewModel();
}

function tryReload() {
  const p = G.player, w = WEAPONS[p.weapon], am = p.ammo[p.weapon];
  if (w.melee || !am || PW.reloadT > 0 || am.mag >= w.mag || am.res <= 0 || PW.switchT > 0) return;
  PW.reloadT = w.reload; PW.scope = 0;
  audio.reload();
}

// ---------- shooting ----------
const tmpV = new THREE.Vector3();
function hitTestActors(shooter, o, d, maxT) {
  let best = maxT, hit = null, part = null;
  for (const a of G.actors) {
    if (!a.alive || a === shooter || a.team === shooter.team) continue;
    const H = a.crouch ? 1.3 : 1.8;
    const headY = a.pos.y + (a.crouch ? 1.2 : 1.67);
    // quick reject
    tmpV.set(a.pos.x - o.x, 0, a.pos.z - o.z);
    const along = tmpV.x * d.x + tmpV.z * d.z;
    if (along < -1) continue;
    let t = raySphere(o, d, a.pos.x, headY, a.pos.z, 0.16, best);
    if (t >= 0 && t < best) { best = t; hit = a; part = 'head'; }
    t = rayVCyl(o, d, a.pos.x, a.pos.z, 0.27, a.pos.y + H * 0.47, headY - 0.13, best);
    if (t >= 0 && t < best) { best = t; hit = a; part = 'body'; }
    t = rayVCyl(o, d, a.pos.x, a.pos.z, 0.22, a.pos.y, a.pos.y + H * 0.47, best);
    if (t >= 0 && t < best) { best = t; hit = a; part = 'legs'; }
  }
  return hit ? { actor: hit, part, t: best } : null;
}

function fireRay(shooter, origin, dir, w, muzzlePos) {
  const range = w.range || 250;
  const wh = G.world.raycast(origin, dir, range);
  const wt = wh ? wh.t : range;
  const ah = hitTestActors(shooter, origin, dir, wt);
  const end = origin.clone().addScaledVector(dir, ah ? ah.t : wt);
  if (!w.melee && muzzlePos) addTracer(muzzlePos, end);
  if (ah) {
    G.lastHitPoint = end;
    if (shooter.isPlayer) stats.hits++;
    damage(ah.actor, shooter, w, ah.part, dir);
    addPuff(end, dir.clone().negate(), 0x8a0f0f, 5, 0.3);
  } else if (wh) {
    if (!w.melee) {
      if (wh.collider.kind !== 'floor' || true) addDecal(end, wh.normal);
      const col = G.mapDef.id === 'bazaar' ? 0xd9b38a : 0xd2b07a;
      addPuff(end, wh.normal, col, 4, 0.4);
      if (shooter.isPlayer || end.distanceTo(camera.position) < 15) audio.impact(end);
    }
  }
  return ah;
}

function damage(victim, attacker, w, part, dir) {
  if (!victim.alive) return;
  const mult = part === 'head' ? w.head : part === 'legs' ? 0.75 : 1;
  let dmg = w.dmg * mult;
  if (victim.armor > 0 && (part === 'body' || (part === 'head' && victim.helmet))) {
    const health = dmg * w.armorPen;
    victim.armor = Math.max(0, victim.armor - (dmg - health) * 0.5);
    dmg = health;
  }
  dmg = Math.round(dmg);
  victim.hp -= dmg;
  if (attacker.isPlayer) {
    showHit(part === 'head');
    audio.hit(part === 'head');
    dmgNumber(G.lastHitPoint || new THREE.Vector3(victim.pos.x, victim.pos.y + 1.4, victim.pos.z), Math.min(dmg, dmg + victim.hp), part === 'head', victim.hp <= 0);
  }
  if (victim.isPlayer) {
    G.lastAttacker = attacker;
    $('vignette').style.opacity = Math.min(1, 0.35 + dmg / 80);
    setTimeout(() => { $('vignette').style.opacity = 0; }, 180);
    const toA = Math.atan2(attacker.pos.x - victim.pos.x, attacker.pos.z - victim.pos.z);
    const rel = toA - Math.atan2(-Math.sin(victim.yaw), -Math.cos(victim.yaw));
    const el = $('dmgdir'); el.style.transform = `rotate(${-rel}rad)`; el.style.opacity = 1;
    clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = 0; }, 400);
    audio.hurt();
    PW.recoilAcc += 0.01; G.player.pitch += 0.01; // aim punch
  } else if (victim.ai) {
    victim.ai.alert = attacker.pos.clone();
    victim.ai.alertT = 2;
  }
  if (victim.hp <= 0) kill(victim, attacker, w, part === 'head');
}

function kill(victim, attacker, w, head) {
  victim.hp = 0; victim.alive = false; victim.deaths++;
  if (attacker.team !== victim.team) { attacker.kills++; if (head) attacker.hs++; }
  if (G.bombMode && attacker.team !== victim.team) {
    const r = killReward(w.id);
    addMoney(attacker, r);
    if (attacker.isPlayer) moneyPopup(`+$${r} ${victim.name}`);
  }
  if (victim.hasBomb) dropBomb(victim);
  if (victim.isPlayer) { G.planting = 0; G.defusing = 0; }
  victim.deathAnim = 0.0001;
  victim.deathDir = Math.random() < 0.5 ? -1 : 1;
  addKillfeed(attacker, victim, w, head);
  if (attacker.isPlayer && victim.team !== attacker.team) {
    stats.kills++; if (head) stats.hs++;
    stats.weaponKills[w.id] = (stats.weaponKills[w.id] || 0) + 1;
    saveStats();
  }
  if (victim.isPlayer) {
    stats.deaths++; saveStats();
    G.deathT = 0; PW.scope = 0;
    if (settings.killcam && attacker !== victim && attacker.team !== victim.team && attacker.alive !== undefined && !attacker.isPlayer && G.rec.length > 10) startKillcam(attacker, w, head);
    else showCenter('Öldün — takım arkadaşlarını izliyorsun (Sol tık: değiştir)');
  }
  checkRoundEnd();
}

function checkRoundEnd() {
  if (G.phase === 'end') return;
  const aliveT = G.actors.some(a => a.team === 'T' && a.alive);
  const aliveCT = G.actors.some(a => a.team === 'CT' && a.alive);
  if (!aliveCT) endRound('T', 'Tüm savunmacılar etkisiz hale getirildi');
  else if (!aliveT && !(G.bomb && G.bomb.state === 'planted')) endRound('CT', 'Tüm saldırganlar etkisiz hale getirildi');
}

function alertBots(shooter, loud) {
  for (const a of G.actors) {
    if (!a.ai || !a.alive || a.team === shooter.team) continue;
    const d = a.pos.distanceTo(shooter.pos);
    if (d < loud && !a.ai.target) { a.ai.alert = shooter.pos.clone(); a.ai.alertT = 1.5; }
  }
}

function playerFire() {
  const p = G.player, w = WEAPONS[p.weapon];
  if (PW.switchT > 0 || PW.reloadT > 0 || PW.boltT > 0 || PW.fireCd > 0) return;
  if (!w.auto && G.firedThisPress) return;
  if (G.planting > 0 || G.defusing > 0) return;
  if (w.nade) { playerThrow(); return; }
  if (w.melee) {
    G.firedThisPress = true;
    PW.fireCd = 60 / w.rpm; PW.knifeT = 0.35;
    audio.shot('knife');
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    fireRay(p, camera.position.clone(), dir, w, null);
    return;
  }
  const am = p.ammo[p.weapon];
  if (am.mag <= 0) {
    if (!G.firedThisPress) audio.empty();
    G.firedThisPress = true;
    if (am.res > 0) tryReload();
    return;
  }
  G.firedThisPress = true;
  am.mag--;
  stats.shots++; stats.weaponShots[w.id] = (stats.weaponShots[w.id] || 0) + 1;
  PW.fireCd = 60 / w.rpm;
  if (G.time - PW.lastShot > 0.35) PW.burst = 0;
  PW.burst++; PW.lastShot = G.time;
  const spread = currentSpread();
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  const right = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation);
  const up = new THREE.Vector3(0, 1, 0).applyEuler(camera.rotation);
  const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * spread;
  dir.addScaledVector(right, Math.cos(ang) * rad).addScaledVector(up, Math.sin(ang) * rad).normalize();
  const muzzle = camera.position.clone().addScaledVector(right, 0.14).addScaledVector(up, -0.1).add(new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation).multiplyScalar(0.7));
  fireRay(p, camera.position.clone(), dir, w, muzzle);
  // recoil
  const k = w.recoil * (0.85 + Math.random() * 0.3) * (1 + Math.min(PW.burst, 10) * 0.06);
  p.pitch = Math.min(1.5, p.pitch + k);
  PW.recoilAcc += k * 0.55;
  p.yaw += (Math.random() - 0.5) * w.recoil * (PW.burst > 4 ? 1.4 : 0.4);
  PW.kick = 1;
  // flash
  if (PW.scope === 0) {
    vmGun.userData.flash.visible = true; vmGun.userData.flash.material.rotation = Math.random() * 6;
    vmFlashLight.intensity = 6;
    setTimeout(() => { if (vmGun) vmGun.userData.flash.visible = false; }, 45);
  }
  worldFlashLight.position.copy(muzzle); worldFlashLight.intensity = 10;
  audio.shot(w.sound);
  alertBots(p, w.sound === 'sniper' ? 45 : 32);
  if (w.scope) {
    PW.wantScope = PW.scope; PW.scope = 0; PW.boltT = w.bolt;
    audio.bolt();
  }
  if (am.mag === 0 && am.res > 0) setTimeout(() => { if (G.player.weapon === w.id) tryReload(); }, 250);
}

function currentSpread() {
  const p = G.player, w = WEAPONS[p.weapon];
  const hs = Math.hypot(p.vel.x, p.vel.z);
  let s = w.scope ? (PW.scope > 0 ? w.spread : w.unscoped) : w.spread;
  s += Math.min(1, hs / 5) * w.moveSpread;
  if (!p.onGround) s += w.airSpread;
  if (w.auto) s += Math.min(PW.burst, 12) * w.recoil * 0.22;
  if (p.crouch) s *= 0.7;
  return s;
}

// ---------- statistics (persistent) ----------
const STATS_KEY = 'sz_stats_v1';
const stats = { kills: 0, deaths: 0, hs: 0, shots: 0, hits: 0, matches: 0, wins: 0, roundsWon: 0, roundsPlayed: 0, goldEarned: 0, weaponKills: {}, weaponShots: {}, mapPlays: {} };
try { Object.assign(stats, JSON.parse(localStorage.getItem(STATS_KEY) || '{}')); } catch (e) { /* ignore */ }
function saveStats() { try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ } }

// ---------- damage numbers ----------
const dmgNums = [];
const projV = new THREE.Vector3();
function dmgNumber(pos, dmg, head, lethal) {
  if (!settings.dmgNums || dmg <= 0) return;
  const el = document.createElement('div');
  el.className = 'dnum' + (head ? ' head' : '') + (lethal ? ' lethal' : '');
  el.textContent = Math.round(dmg);
  $('dmgNums').appendChild(el);
  dmgNums.push({ el, pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.15, (Math.random() - 0.5) * 0.3)), t: 0, vx: (Math.random() - 0.5) * 40 });
}
function updateDmgNums(dt) {
  const W = window.innerWidth, H = window.innerHeight;
  for (let i = dmgNums.length - 1; i >= 0; i--) {
    const d = dmgNums[i]; d.t += dt;
    d.pos.y += dt * 0.5;
    projV.copy(d.pos).project(camera);
    const vis = projV.z < 1;
    const x = (projV.x * 0.5 + 0.5) * W + d.vx * d.t, y = (-projV.y * 0.5 + 0.5) * H;
    const sc = d.t < 0.08 ? 1.5 - d.t * 6 : 1;
    d.el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${sc})`;
    d.el.style.opacity = vis ? Math.max(0, 1 - Math.max(0, d.t - 0.6) / 0.4) : 0;
    if (d.t > 1) { d.el.remove(); dmgNums.splice(i, 1); }
  }
}

// ---------- killcam (replay from the killer's eyes) ----------
const REC_SECS = 4;
function recordFrame() {
  if (!G.rec) G.rec = [];
  const n = G.actors.length;
  const f = new Float32Array(n * 8);
  G.actors.forEach((a, i) => {
    f.set([a.pos.x, a.pos.y, a.pos.z, a.yaw, a.pitch, a.alive ? 1 : 0, a.crouch ? 1 : 0, a.vel ? Math.hypot(a.vel.x, a.vel.z) : 0], i * 8);
  });
  G.rec.push({ t: G.time, f });
  while (G.rec.length && G.time - G.rec[0].t > REC_SECS) G.rec.shift();
}
function frameAt(t) {
  const r = G.rec;
  let i = r.length - 1;
  while (i > 0 && r[i].t > t) i--;
  return r[Math.max(0, i)].f;
}
function startKillcam(killer, w, head) {
  const kidx = G.actors.indexOf(killer);
  if (kidx < 0) return;
  const deathT = G.time;
  const start = Math.max(G.rec[0].t, deathT - 3.0);
  G.killcam = { killer, kidx, start, end: deathT + 0.35, t: start, w, head, hp: Math.max(0, Math.round(killer.hp)) };
  if (!G.playerModel) { G.playerModel = createSoldier(G.player.team, G.player.weapon, tex, equippedSkin(G.player.weapon)); scene.add(G.playerModel); }
  else G.playerModel.userData.setWeapon(G.player.weapon, equippedSkin(G.player.weapon));
  G.playerModel.visible = false;
  const kc = $('killcam');
  kc.querySelector('.kc-name').textContent = killer.name;
  kc.querySelector('.kc-name').className = 'kc-name ' + killer.team;
  kc.querySelector('.kc-weap').textContent = w.name + (head ? ' · KAFA VURUŞU' : '');
  kc.querySelector('.kc-hp').textContent = `Kalan canı: ${G.killcam.hp} HP`;
  kc.classList.remove('hidden');
  showCenter('');
}
function endKillcam() {
  if (!G.killcam) return;
  G.killcam = null;
  G.killcamDone = true;
  $('killcam').classList.add('hidden');
  if (G.playerModel) G.playerModel.visible = false;
  if (G.player && !G.player.alive && G.phase !== 'end') showCenter('Öldün — takım arkadaşlarını izliyorsun (Sol tık: değiştir)');
}
function updateKillcam(dt) {
  const kc = G.killcam;
  // the last moment plays in slow motion
  const slow = kc.end - kc.t < 0.7 ? 0.4 : 1;
  kc.t += dt * slow;
  if (kc.t >= kc.end || G.specNext) { G.specNext = false; endKillcam(); return; }
  const f = frameAt(Math.min(kc.t, G.time));
  const o = kc.kidx * 8;
  camera.position.set(f[o], f[o + 1] + (f[o + 6] ? 1.15 : 1.62), f[o + 2]);
  camera.rotation.set(f[o + 4], f[o + 3], 0);
  const prog = (kc.t - kc.start) / (kc.end - kc.start);
  $('killcam').querySelector('.kc-bar i').style.width = (prog * 100).toFixed(1) + '%';
}
// temporarily pose every model as it was at the replay time; returns a restore fn
function applyKillcamPose() {
  const kc = G.killcam;
  const f = frameAt(Math.min(kc.t, G.time));
  const saved = [];
  G.actors.forEach((a, i) => {
    const m = a.isPlayer ? G.playerModel : a.model;
    if (!m) return;
    const o = i * 8;
    const ud = m.userData;
    saved.push([m, m.position.clone(), m.rotation.y, m.visible, ud.body.rotation.clone(), ud.body.position.clone()]);
    m.position.set(f[o], f[o + 1], f[o + 2]);
    m.rotation.y = f[o + 3];
    const alive = f[o + 5] > 0.5;
    m.visible = i !== kc.kidx && (alive || a.deathAnim > 0);
    if (alive) { ud.body.rotation.set(0, 0, 0); ud.body.position.set(0, 0, 0); }
    if (a.isPlayer) { ud.anim.update(0.016, f[o + 7], true); }
  });
  return () => { for (const [m, p, ry, v, br, bp] of saved) { m.position.copy(p); m.rotation.y = ry; m.visible = v; m.userData.body.rotation.copy(br); m.userData.body.position.copy(bp); } };
}

// ---------- crosshair ----------
function applyCrosshair(el, gap) {
  const c = settings.ch;
  const L = c.size, T = c.thick;
  const sh = c.outline ? '0 0 0 1px rgba(0,0,0,0.85)' : 'none';
  const [t, b, l, r, dot, ring] = el.children;
  const lines = c.style === 'classic' || c.style === 'classicdot' || c.style === 'tshape';
  for (const e of [t, b, l, r]) { e.style.display = lines ? 'block' : 'none'; e.style.background = c.color; e.style.boxShadow = sh; }
  if (c.style === 'tshape') t.style.display = 'none';
  t.style.width = b.style.width = T + 'px'; t.style.height = b.style.height = L + 'px';
  t.style.left = b.style.left = (-T / 2) + 'px';
  t.style.top = (-gap - L) + 'px'; b.style.top = gap + 'px';
  l.style.height = r.style.height = T + 'px'; l.style.width = r.style.width = L + 'px';
  l.style.top = r.style.top = (-T / 2) + 'px';
  l.style.left = (-gap - L) + 'px'; r.style.left = gap + 'px';
  const showDot = c.style !== 'classic' && c.style !== 'tshape';
  dot.style.display = showDot ? 'block' : 'none';
  const ds = Math.max(2, T + (c.style === 'dot' ? 2 : 0));
  Object.assign(dot.style, { width: ds + 'px', height: ds + 'px', left: (-ds / 2) + 'px', top: (-ds / 2) + 'px', background: c.color, boxShadow: sh, borderRadius: c.style === 'dot' ? '50%' : '0' });
  ring.style.display = c.style === 'circle' ? 'block' : 'none';
  const rr = gap + L / 2 + 4;
  Object.assign(ring.style, { width: rr * 2 + 'px', height: rr * 2 + 'px', left: -rr + 'px', top: -rr + 'px', border: `${T}px solid ${c.color}`, boxShadow: c.outline ? '0 0 0 1px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(0,0,0,0.7)' : 'none' });
}

// ---------- economy ----------
function addMoney(a, v) { a.money = Math.max(0, Math.min(16000, a.money + v)); }
function moneyPopup(text) {
  const el = document.createElement('div'); el.className = 'mpop'; el.textContent = text;
  $('moneyPops').appendChild(el); setTimeout(() => el.remove(), 2400);
}
function totalNades(a) { return a.nades.he + a.nades.flash + a.nades.smoke; }
function buyList(team) {
  const rifle = team === 'T' ? 'ak' : 'm4';
  const l = [
    { k: 'deagle', label: 'Desert Eagle', cat: 'Tabanca' },
    { k: 'mp5', label: 'MP5', cat: 'Hafif makineli' },
    { k: rifle, label: WEAPONS[rifle].name, cat: 'Tüfek' },
    { k: 'awm', label: 'AWM', cat: 'Keskin nişancı' },
    { k: 'kevlar', label: 'Zırh', cat: 'Ekipman' },
    { k: 'helmet', label: 'Zırh + Kask', cat: 'Ekipman' },
    { k: 'he', label: 'HE Bombası', cat: 'Bomba' },
    { k: 'flash', label: 'Flaş Bombası', cat: 'Bomba' },
    { k: 'smoke', label: 'Sis Bombası', cat: 'Bomba' },
  ];
  if (team === 'CT') l.push({ k: 'kit', label: 'İmha Kiti', cat: 'Ekipman' });
  return l;
}
function itemOwned(a, k) {
  if (WEAPONS[k] && !WEAPONS[k].nade) return a.loadout[WEAPONS[k].slot] === k;
  if (k === 'kevlar') return a.armor >= 100;
  if (k === 'helmet') return a.armor >= 100 && a.helmet;
  if (NADES.includes(k)) return a.nades[k] >= NADE_MAX[k] || totalNades(a) >= 4;
  if (k === 'kit') return a.kit;
  return false;
}
function itemPrice(a, k) { return k === 'helmet' && a.armor >= 100 && !a.helmet ? 350 : PRICES[k]; }
function buyItem(a, k) {
  if (itemOwned(a, k)) return 'owned';
  const price = itemPrice(a, k);
  if (a.money < price) return 'money';
  if (WEAPONS[k] && !WEAPONS[k].nade) giveWeapon(a, k);
  else if (k === 'kevlar') a.armor = 100;
  else if (k === 'helmet') { a.armor = 100; a.helmet = true; }
  else if (NADES.includes(k)) a.nades[k]++;
  else if (k === 'kit') a.kit = true;
  a.money -= price;
  return 'ok';
}
function botBuy(a) {
  const rifle = a.team === 'T' ? 'ak' : 'm4';
  if (!a.loadout[1]) {
    const awmTaken = G.actors.some(o => o !== a && o.team === a.team && o.loadout[1] === 'awm');
    if (a.money >= PRICES.awm + 1000 && Math.random() < 0.22 && !awmTaken) buyItem(a, 'awm');
    else if (a.money >= PRICES[rifle] + 650) buyItem(a, rifle);
    else if (G.round > 1 && a.money >= 2150 && Math.random() < 0.6) buyItem(a, 'mp5');
    else if (Math.random() < 0.35 && a.money >= 700) buyItem(a, 'deagle');
  }
  if (a.loadout[1] && a.money >= 1000) buyItem(a, 'helmet');
  else if (a.money >= 650) buyItem(a, 'kevlar');
  if (a.team === 'CT' && a.money >= 400 && Math.random() < 0.6) buyItem(a, 'kit');
  for (const n of ['flash', 'he', 'smoke', 'flash']) if (a.money >= PRICES[n] + 150 && Math.random() < 0.5) buyItem(a, n);
}

// ---------- bomb ----------
const BOMB_TIME = 40, PLANT_TIME = 3.2;
let bombMesh = null;
function makeBombMesh() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2722, roughness: 0.8 });
  const tan = new THREE.MeshStandardMaterial({ color: 0xb59a6a, roughness: 0.85 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x0b2a10, emissive: 0x1aff4a, emissiveIntensity: 0.6 });
  const led = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 0.5 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(0.34, 0.06, 0.24), dark, 0, 0.03, 0);
  for (const x of [-0.1, 0, 0.1]) add(new THREE.BoxGeometry(0.09, 0.07, 0.22), tan, x, 0.095, 0);
  add(new THREE.BoxGeometry(0.14, 0.035, 0.1), dark, 0, 0.145, 0.02);
  add(new THREE.BoxGeometry(0.1, 0.006, 0.05), screen, 0, 0.165, 0.035);
  const l = add(new THREE.SphereGeometry(0.012, 8, 6), led, 0.06, 0.17, -0.02);
  const wireMat = [0xd02020, 0x2050d0, 0xe0c020].map(c => new THREE.MeshStandardMaterial({ color: c }));
  wireMat.forEach((m, i) => { const w = add(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 5), m, -0.05 + i * 0.03, 0.135, 0); w.rotation.x = Math.PI / 2; });
  g.userData.led = led; g.userData.ledMesh = l;
  return g;
}
function resetBomb() {
  if (bombMesh) scene.remove(bombMesh);
  G.bomb = { state: 'none', carrier: null, pos: new THREE.Vector3(), timer: 0, beepT: 0, planted: false, site: null, defuser: null, planter: null };
  G.planting = 0; G.defusing = 0;
  if (!G.bombMode) return;
  const ts = G.actors.filter(a => a.team === 'T');
  const c = ts[(Math.random() * ts.length) | 0];
  c.hasBomb = true; G.bomb.state = 'carried'; G.bomb.carrier = c;
  if (c.ai) { c.ai.path = null; c.ai.objective = randomSiteCell(G.plan); c.ai.reachedObj = false; }
}
function siteOf(pos) {
  const [cx, cz] = G.world.toCell(pos.x, pos.z);
  const t = G.world.cellType(cx, cz);
  return t === 'A' || t === 'B' ? t : null;
}
function randomSiteCell(site) {
  const cells = G.world.cellsOfType([site]);
  return cells[(Math.random() * cells.length) | 0];
}
function nearestWalkable(cell) {
  const w = G.world;
  if (w.walkable(cell[0], cell[1])) return cell;
  for (let r = 1; r < 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (w.walkable(cell[0] + dx, cell[1] + dz)) return [cell[0] + dx, cell[1] + dz];
  return cell;
}
function retaskBots(filter) {
  for (const a of G.actors) if (a.ai && a.alive && filter(a)) { a.ai.path = null; a.ai.state = 'move'; a.ai.reachedObj = true; a.ai.waitStart = 0; }
}
function dropBomb(a) {
  const b = G.bomb;
  a.hasBomb = false; b.state = 'dropped'; b.carrier = null;
  b.pos.set(a.pos.x, a.pos.y, a.pos.z);
  if (!bombMesh) bombMesh = makeBombMesh();
  bombMesh.position.copy(b.pos); bombMesh.rotation.y = Math.random() * 6;
  scene.add(bombMesh);
  // nearest T bot fetches it
  let best = null, bd = 1e9;
  for (const o of G.actors) if (o.ai && o.alive && o.team === 'T') { const d = o.pos.distanceTo(b.pos); if (d < bd) { bd = d; best = o; } }
  for (const o of G.actors) if (o.ai) o.ai.fetchBomb = o === best;
  if (best) { best.ai.path = null; best.ai.state = 'move'; best.ai.waitStart = 0; }
  if (G.player.team === 'T') moneyPopup('Bomba düştü!');
}
function pickupBomb(a) {
  const b = G.bomb;
  a.hasBomb = true; b.state = 'carried'; b.carrier = a;
  if (bombMesh) scene.remove(bombMesh);
  for (const o of G.actors) if (o.ai) o.ai.fetchBomb = false;
  if (a.ai) { a.ai.path = null; a.ai.state = 'move'; }
  if (a.isPlayer) moneyPopup('Bombayı aldın');
}
function plantBomb(a) {
  const b = G.bomb;
  a.hasBomb = false; b.carrier = null; b.state = 'planted'; b.planted = true; b.planter = a;
  b.site = siteOf(a.pos) || G.plan;
  b.pos.set(a.pos.x, a.pos.y, a.pos.z); b.timer = BOMB_TIME; b.beepT = 0;
  if (!bombMesh) bombMesh = makeBombMesh();
  bombMesh.position.copy(b.pos); bombMesh.rotation.y = a.yaw;
  scene.add(bombMesh);
  addMoney(a, 300);
  if (a.isPlayer) moneyPopup('+$300 bomba kuruldu');
  showBanner('BOMBA KURULDU', `${b.site} bölgesi · 40 saniye`, 'T', 2.5);
  audio.planted();
  retaskBots(() => true);
}
function defuseBomb(a) {
  const b = G.bomb;
  b.state = 'defused';
  addMoney(a, 300);
  if (a.isPlayer) moneyPopup('+$300 bomba imha edildi');
  audio.defused();
  endRound('CT', `${a.name} bombayı imha etti`, 'defuse');
}
function explodeBomb() {
  const b = G.bomb;
  b.state = 'exploded';
  if (bombMesh) scene.remove(bombMesh);
  endRound('T', 'Hedef yok edildi', 'bomb');
  const p = b.pos.clone().add(new THREE.Vector3(0, 0.5, 0));
  explosionFx(p, 3.2);
  audio.explosion(p, 1.6);
  const C4 = { id: 'c4', name: 'C4', dmg: 0, head: 1, armorPen: 1 };
  for (const a of G.actors) {
    if (!a.alive) continue;
    const d = a.pos.distanceTo(b.pos);
    if (d > 24) continue;
    const dmg = 260 * Math.pow(1 - d / 24, 1.6);
    applyRawDamage(a, b.planter || G.player, C4, dmg);
  }
  const dc = camera.position.distanceTo(p);
  G.shake = Math.max(G.shake, Math.max(0, 1.4 - dc / 50));
}
function applyRawDamage(victim, attacker, w, dmg) {
  if (!victim.alive || dmg <= 0) return;
  if (victim.armor > 0) { const h = dmg * 0.57; victim.armor = Math.max(0, victim.armor - (dmg - h) * 0.5); dmg = h; }
  victim.hp -= Math.round(dmg);
  if (victim.isPlayer) { $('vignette').style.opacity = 0.8; setTimeout(() => { $('vignette').style.opacity = 0; }, 250); audio.hurt(); }
  if (attacker.isPlayer && attacker !== victim) { showHit(false); audio.hit(false); dmgNumber(new THREE.Vector3(victim.pos.x, victim.pos.y + 1.6, victim.pos.z), Math.round(Math.min(dmg, dmg + victim.hp)), false, victim.hp <= 0); }
  if (victim.ai) { victim.ai.alert = attacker.pos.clone(); victim.ai.alertT = 2; }
  if (victim.hp <= 0) kill(victim, attacker, w, false);
}
function updateBomb(dt) {
  if (!G.bombMode) return;
  const b = G.bomb;
  if (b.state === 'dropped') {
    for (const a of G.actors) if (a.alive && a.team === 'T' && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 1.3 && Math.abs(a.pos.y - b.pos.y) < 1.5) { pickupBomb(a); break; }
    b.fetchCheck = (b.fetchCheck || 0) - dt;
    if (b.state === 'dropped' && b.fetchCheck <= 0) {
      b.fetchCheck = 1;
      const fetcher = G.actors.find(o => o.ai && o.alive && o.ai.fetchBomb);
      if (!fetcher) {
        let best = null, bd = 1e9;
        for (const o of G.actors) if (o.ai && o.alive && o.team === 'T') { const d = o.pos.distanceTo(b.pos); if (d < bd) { bd = d; best = o; } }
        if (best) { best.ai.fetchBomb = true; best.ai.path = null; best.ai.state = 'move'; best.ai.waitStart = 0; }
      } else if (!fetcher.ai.target && fetcher.ai.state === 'hold') { fetcher.ai.state = 'move'; fetcher.ai.path = null; }
    }
  }
  if (b.state === 'planted') {
    b.timer -= dt;
    b.beepT -= dt;
    const led = bombMesh.userData.led;
    if (b.beepT <= 0) {
      b.beepT = Math.max(0.1, 1.0 * b.timer / BOMB_TIME);
      audio.bombBeep(b.pos, b.timer < 5);
      led.emissiveIntensity = 8;
    }
    led.emissiveIntensity = Math.max(0.5, led.emissiveIntensity - dt * 40);
    if (b.defuser && (!b.defuser.alive || b.defuser.pos.distanceTo(b.pos) > 2.2)) b.defuser = null;
    if (b.timer <= 0) explodeBomb();
  }
}
// bot bomb actions — returns true if the bot must stand still
function botBombAction(a, dt) {
  if (!G.bombMode || G.phase !== 'live') return false;
  const ai = a.ai, b = G.bomb;
  if (a.hasBomb && siteOf(a.pos) && a.onGround) {
    ai.plantT = (ai.plantT || 0) + dt;
    a.crouch = true;
    if (ai.plantT >= PLANT_TIME) { ai.plantT = 0; a.crouch = false; plantBomb(a); }
    return true;
  }
  ai.plantT = 0;
  if (a.team === 'CT' && b.state === 'planted' && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 1.7 && Math.abs(a.pos.y - b.pos.y) < 1.6) {
    if (!b.defuser || b.defuser === a) {
      b.defuser = a;
      ai.defuseT = (ai.defuseT || 0) + dt;
      a.crouch = true;
      if (ai.defuseT >= (a.kit ? 5 : 10)) { a.crouch = false; defuseBomb(a); }
      return true;
    }
  }
  ai.defuseT = 0; a.crouch = false;
  return false;
}
function bombGoal(a) {
  if (!G.bombMode) return null;
  const b = G.bomb, w = G.world;
  if (a.hasBomb) return randomSiteCell(G.plan);
  if (b.state === 'dropped' && a.team === 'T' && a.ai.fetchBomb) return nearestWalkable(w.toCell(b.pos.x, b.pos.z));
  if (b.state === 'planted') {
    if (a.team === 'CT') return nearestWalkable(w.toCell(b.pos.x, b.pos.z));
    return randomSiteCell(b.site);
  }
  return null;
}

// ---------- grenades ----------
const nadeList = [], smokes = [];
function clearNades() {
  for (const n of nadeList) scene.remove(n.mesh);
  for (const s of smokes) for (const sp of s.sprites) { scene.remove(sp.s); sp.s.material.dispose(); }
  nadeList.length = 0; smokes.length = 0;
  G.flashT = 0;
}
function throwNade(owner, type, origin, vel) {
  if (owner.nades[type] <= 0) return;
  owner.nades[type]--;
  const g = new THREE.Group();
  buildNadeModel(g, type, gunMats(tex));
  g.scale.setScalar(1.4);
  g.position.copy(origin);
  scene.add(g);
  nadeList.push({ type, owner, pos: origin.clone(), vel, t: 0, mesh: g, rest: false, ground: false, spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10), bounceT: 0 });
  audio.throwNade(owner.isPlayer ? null : origin);
  if (!owner.isPlayer) alertBots(owner, 6);
}
function nadeHit(p, r) { return G.world.overlaps(p.x - r, p.y - r, p.z - r, p.x + r, p.y + r, p.z + r); }
function updateNades(dt) {
  for (let i = nadeList.length - 1; i >= 0; i--) {
    const n = nadeList[i];
    n.t += dt; n.bounceT -= dt;
    const steps = 4, h = dt / steps, r = 0.06;
    for (let s = 0; s < steps && !n.rest; s++) {
      n.vel.y -= 18 * h;
      let bounced = false;
      n.pos.x += n.vel.x * h;
      if (nadeHit(n.pos, r)) { n.pos.x -= n.vel.x * h; n.vel.x *= -0.45; bounced = true; }
      n.pos.z += n.vel.z * h;
      if (nadeHit(n.pos, r)) { n.pos.z -= n.vel.z * h; n.vel.z *= -0.45; bounced = true; }
      n.pos.y += n.vel.y * h;
      n.ground = false;
      if (n.pos.y < r || nadeHit(n.pos, r)) {
        n.pos.y -= n.vel.y * h;
        if (n.vel.y < 0) {
          n.ground = true;
          if (n.vel.y < -2) bounced = true;
          n.vel.y = Math.abs(n.vel.y) < 2 ? 0 : -n.vel.y * 0.32;
          n.vel.x *= 0.7; n.vel.z *= 0.7;
        } else n.vel.y *= -0.3;
      }
      if (n.ground) { n.vel.x *= 1 - 5 * h; n.vel.z *= 1 - 5 * h; }
      if (n.pos.y < r) n.pos.y = r;
      if (bounced && n.bounceT <= 0) { n.bounceT = 0.12; audio.bounce(n.pos.clone()); }
      if (n.ground && Math.hypot(n.vel.x, n.vel.z) < 0.25) n.rest = true;
    }
    n.mesh.position.copy(n.pos);
    if (!n.rest) { n.mesh.rotation.x += n.spin.x * dt; n.mesh.rotation.z += n.spin.z * dt; }
    const fuse = n.type === 'he' ? 1.7 : n.type === 'flash' ? 1.5 : 99;
    const go = n.t >= fuse || (n.type === 'smoke' && ((n.rest && n.t > 0.8) || n.t > 3.5));
    if (go) {
      scene.remove(n.mesh); nadeList.splice(i, 1);
      if (n.type === 'he') explodeHE(n);
      else if (n.type === 'flash') explodeFlash(n);
      else spawnSmoke(n.pos);
    }
  }
  updateSmokes(dt);
  if (G.flashT > 0) G.flashT = Math.max(0, G.flashT - dt);
  $('flash').style.opacity = Math.min(1, G.flashT / 1.4);
}
function explosionFx(p, scale = 1) {
  addPuff(p, new THREE.Vector3(0, 1, 0), 0x3a3530, Math.round(10 * scale), 0.9 * scale);
  addPuff(p, new THREE.Vector3(0, 1, 0), 0xffa040, Math.round(5 * scale), 0.6 * scale);
  addPuff(p, new THREE.Vector3(0, 1, 0), 0xc9a070, Math.round(6 * scale), 1.1 * scale);
  worldFlashLight.position.copy(p).add(new THREE.Vector3(0, 0.8, 0));
  worldFlashLight.intensity = 60 * scale; worldFlashLight.distance = 14 * scale;
  setTimeout(() => { worldFlashLight.distance = 9; }, 200);
  const s = new THREE.Sprite(flashMat); s.position.copy(p); s.scale.setScalar(3 * scale); scene.add(s);
  fx.flashes.push({ s, life: -0.08 });
  addDecal(new THREE.Vector3(p.x, 0.01, p.z), new THREE.Vector3(0, 1, 0));
  fx.decals[fx.decals.length - 1].scale.setScalar(14 * scale);
}
function explodeHE(n) {
  const p = n.pos.clone();
  explosionFx(p, 1);
  audio.explosion(p, 1);
  const d0 = camera.position.distanceTo(p);
  G.shake = Math.max(G.shake, Math.max(0, 0.8 - d0 / 25));
  const from = p.clone().add(new THREE.Vector3(0, 0.3, 0));
  for (const a of G.actors) {
    if (!a.alive || (a.team === n.owner.team && a !== n.owner)) continue;
    const chest = new THREE.Vector3(a.pos.x, a.pos.y + 1.0, a.pos.z);
    const d = from.distanceTo(chest);
    if (d > 9 || !G.world.lineClear(from, chest)) continue;
    applyRawDamage(a, n.owner, WEAPONS.he, 105 * (1 - d / 9));
  }
  alertBots(n.owner, 35);
}
function explodeFlash(n) {
  const p = n.pos.clone().add(new THREE.Vector3(0, 0.15, 0));
  const s = new THREE.Sprite(flashMat); s.position.copy(p); s.scale.setScalar(2.5); scene.add(s);
  fx.flashes.push({ s, life: -0.05 });
  worldFlashLight.position.copy(p); worldFlashLight.intensity = 80;
  audio.flashBang(p);
  for (const a of G.actors) {
    if (!a.alive || a === n.owner) continue;
    const eye = new THREE.Vector3(a.pos.x, a.pos.y + a.eye, a.pos.z);
    const d = eye.distanceTo(p);
    if (d > 32 || !G.world.lineClear(p, eye) || smokeBlocks(p, eye)) continue;
    const fwd = new THREE.Vector3(-Math.sin(a.yaw) * Math.cos(a.pitch), Math.sin(a.pitch), -Math.cos(a.yaw) * Math.cos(a.pitch));
    const to = p.clone().sub(eye).normalize();
    const dot = fwd.dot(to);
    let amt = dot > 0.55 ? 1 : dot > 0.0 ? 0.55 : 0.15;
    amt *= Math.min(1, Math.max(0, 1.15 - d / 30));
    const dur = amt * 4.5;
    if (dur < 0.2) continue;
    if (a.isPlayer) { G.flashT = Math.max(G.flashT, dur); audio.ring(amt); }
    else { a.ai.blindT = Math.max(a.ai.blindT || 0, dur); if (dur > 1) a.ai.target = null; }
  }
}
function spawnSmoke(pos) {
  const sm = { pos: pos.clone(), t: 0, life: 18, sprites: [] };
  for (let i = 0; i < 36; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex.puff, color: 0xbdb9b2, transparent: true, opacity: 0, depthWrite: false, fog: true });
    const s = new THREE.Sprite(mat);
    const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 3.4;
    const off = new THREE.Vector3(Math.cos(ang) * rr, 0.4 + Math.random() * 3.0, Math.sin(ang) * rr);
    s.position.copy(pos).add(new THREE.Vector3(0, 0.2, 0));
    const size = 3.4 + Math.random() * 2.4;
    s.scale.setScalar(1);
    scene.add(s);
    sm.sprites.push({ s, off, size, rot: (Math.random() - 0.5) * 0.3 });
  }
  smokes.push(sm);
  audio.smoke(pos);
}
function updateSmokes(dt) {
  for (let i = smokes.length - 1; i >= 0; i--) {
    const sm = smokes[i]; sm.t += dt;
    const grow = Math.min(1, sm.t / 1.6);
    const alpha = sm.t < 1.6 ? grow : sm.t > sm.life - 3 ? Math.max(0, (sm.life - sm.t) / 3) : 1;
    for (const sp of sm.sprites) {
      sp.s.position.set(sm.pos.x + sp.off.x * grow, sm.pos.y + 0.2 + sp.off.y * grow, sm.pos.z + sp.off.z * grow);
      sp.s.scale.setScalar(sp.size * (0.3 + 0.7 * grow));
      sp.s.material.opacity = 0.9 * alpha;
      sp.s.material.rotation += sp.rot * dt;
    }
    if (sm.t >= sm.life) {
      for (const sp of sm.sprites) { scene.remove(sp.s); sp.s.material.dispose(); }
      smokes.splice(i, 1);
    }
  }
}
const segTmp = new THREE.Vector3(), segTmp2 = new THREE.Vector3();
function smokeBlocks(a, b) {
  for (const sm of smokes) {
    if (sm.t < 0.9 || sm.t > sm.life - 2) continue;
    const c = segTmp.set(sm.pos.x, sm.pos.y + 1.8, sm.pos.z);
    const ab = segTmp2.subVectors(b, a);
    const len2 = ab.lengthSq();
    let t = len2 > 0 ? ((c.x - a.x) * ab.x + (c.y - a.y) * ab.y + (c.z - a.z) * ab.z) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + ab.x * t - c.x, py = (a.y + ab.y * t - c.y) * 0.7, pz = a.z + ab.z * t - c.z;
    if (px * px + py * py + pz * pz < 3.5 * 3.5) return true;
  }
  return false;
}
function nextNade(p) {
  const owned = NADES.filter(n => p.nades[n] > 0);
  if (!owned.length) return null;
  const cur = owned.indexOf(p.weapon);
  return owned[(cur + 1) % owned.length];
}
function playerThrow() {
  const p = G.player, type = p.weapon;
  if (p.nades[type] <= 0) return;
  G.firedThisPress = true;
  PW.fireCd = 0.7; PW.knifeT = 0.35;
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  const right = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation);
  const origin = camera.position.clone().addScaledVector(dir, 0.4).addScaledVector(right, 0.12);
  const vel = dir.clone().multiplyScalar(17).add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(p.vel, 0.6);
  throwNade(p, type, origin, vel);
  setTimeout(() => {
    if (G.player.weapon !== type || !G.player.alive) return;
    if (G.player.nades[type] > 0) { buildViewModel(); return; }
    const nx = nextNade(G.player);
    if (nx) { G.player.weapon = nx; PW.switchT = 0.3; buildViewModel(); }
    else switchWeapon(G.player.loadout[1] ? 1 : 2);
  }, 350);
}
function botThrow(a, type, target) {
  const origin = new THREE.Vector3(a.pos.x, a.pos.y + 1.6, a.pos.z);
  const dx = target.x - origin.x, dz = target.z - origin.z;
  const dist = Math.hypot(dx, dz);
  const t = Math.max(0.45, Math.min(1.5, dist / 15));
  const vy = ((target.y + 0.3) - origin.y + 0.5 * 18 * t * t) / t;
  const vel = new THREE.Vector3(dx / t, vy, dz / t);
  origin.x += dx / dist * 0.4; origin.z += dz / dist * 0.4;
  throwNade(a, type, origin, vel);
  a.ai.fireCd = 0.8;
}

// ---------- AI ----------
function initAI(a) {
  const w = G.world, def = G.mapDef;
  a.ai = {
    path: null, pi: 0, goal: null, state: 'move', holdT: 0, target: null, seeT: 0, reactT: 0,
    lastSeen: null, checkT: Math.random() * 0.2, fireCd: 0, reloadT: 0, burst: 0, burstPause: 0,
    strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, stuckT: 0, lastPos: a.pos.clone(), lookYaw: a.yaw,
    scanT: 0, alert: null, alertT: 0, offX: (Math.random() - .5) * w.cell * 0.45, offZ: (Math.random() - .5) * w.cell * 0.45,
    objective: null, waitStart: Math.random() * 2.5, blindT: 0, plantT: 0, defuseT: 0, fetchBomb: false, smoked: false, exact: null,
  };
  // objective
  let cells;
  if (def.weapons === 'sniper') {
    const lane = def.lanes[(Math.random() * def.lanes.length) | 0];
    cells = [lane];
  } else if (a.team === 'T') {
    const other = G.plan === 'A' ? 'B' : 'A';
    const site = Math.random() < 0.8 ? G.plan : other;
    cells = w.cellsOfType([site]);
  } else {
    const r = Math.random();
    cells = r < 0.4 ? w.cellsOfType(['A']) : r < 0.8 ? w.cellsOfType(['B']) : [def.lanes[0]];
  }
  a.ai.objective = cells[(Math.random() * cells.length) | 0];
}

function setGoal(a, cell) {
  const w = G.world;
  const [sx, sz] = w.toCell(a.pos.x, a.pos.z);
  const path = w.findPath(sx, sz, cell[0], cell[1]);
  a.ai.path = path; a.ai.pi = 0; a.ai.goal = cell;
  a.ai.offX = (Math.random() - .5) * w.cell * 0.45; a.ai.offZ = (Math.random() - .5) * w.cell * 0.45;
  return !!path;
}

function randomHuntCell(a) {
  const w = G.world, def = G.mapDef;
  const intel = G.intel[a.team];
  if (intel && G.time - intel.t < 10) return w.toCell(intel.pos.x, intel.pos.z);
  if (Math.random() < 0.5) {
    const l = def.lanes[(Math.random() * def.lanes.length) | 0]; return l;
  }
  const cells = w.cellsOfType(a.team === 'T' ? ['X', 'A', 'B', 'm'] : ['T', '.', 't', 'm']);
  return cells[(Math.random() * cells.length) | 0] || def.lanes[0];
}

const eyeA = new THREE.Vector3(), eyeB = new THREE.Vector3();
function canSee(a, b) {
  eyeA.set(a.pos.x, a.pos.y + 1.62, a.pos.z);
  eyeB.set(b.pos.x, b.pos.y + (b.crouch ? 1.1 : 1.55), b.pos.z);
  if (G.world.lineClear(eyeA, eyeB) && !smokeBlocks(eyeA, eyeB)) return true;
  eyeB.y = b.pos.y + 1.0;
  return G.world.lineClear(eyeA, eyeB) && !smokeBlocks(eyeA, eyeB);
}

function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function yawTo(from, to) { return Math.atan2(-(to.x - from.x), -(to.z - from.z)); }

function updateBot(a, dt) {
  const ai = a.ai, w = G.world, D = DIFF[settings.diff], wpn = WEAPONS[a.weapon];
  let moveX = 0, moveZ = 0, speed = 0;
  ai.fireCd -= dt; ai.alertT -= dt;
  if (ai.reloadT > 0) { ai.reloadT -= dt; if (ai.reloadT <= 0) { const am = a.ammo[a.weapon]; const need = wpn.mag - am.mag; const take = Math.min(need, am.res); am.mag += take; am.res -= take; } }

  // perception
  ai.checkT -= dt;
  if (ai.blindT > 0) { ai.blindT -= dt; ai.target = null; a.yaw += Math.sin(G.time * 3 + a.id) * dt; }
  if (ai.checkT <= 0 && ai.blindT <= 0) {
    ai.checkT = 0.12;
    let best = null, bd = 1e9;
    const fwdYaw = a.yaw;
    for (const e of G.actors) {
      if (!e.alive || e.team === a.team) continue;
      const d = a.pos.distanceTo(e.pos);
      if (d > 140) continue;
      const ang = Math.abs(angleDiff(fwdYaw, yawTo(a.pos, e.pos)));
      const inFov = ang < 1.3 || d < 6 || (ai.target === e);
      if (!inFov) continue;
      if (!canSee(a, e)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      if (ai.target !== best) {
        ai.target = best; ai.seeT = 0;
        ai.reactT = D.react * (0.8 + Math.random() * 0.6) * (wpn.scope ? 1.25 : 1);
        ai.plantT = 0; ai.defuseT = 0; a.crouch = false;
        if (G.bomb && G.bomb.defuser === a) G.bomb.defuser = null;
        if (G.phase === 'live' && bd > 10 && bd < 35 && a.nades.he > 0 && Math.random() < 0.3) botThrow(a, 'he', best.pos.clone().addScaledVector(best.vel, 0.6));
        else if (G.phase === 'live' && bd > 9 && bd < 28 && a.nades.flash > 0 && Math.random() < 0.15) botThrow(a, 'flash', best.pos);
      }
      best.spottedT = G.time;
      G.intel[a.team] = { pos: best.pos.clone(), t: G.time };
    } else if (ai.target) {
      ai.lastSeen = ai.target.pos.clone();
      ai.target = null;
      ai.state = 'move';
      if (a.nades.flash > 0 && Math.random() < 0.35) botThrow(a, 'flash', ai.lastSeen);
      if (!a.hasBomb && !(G.bombMode && G.bomb.state === 'planted' && a.team === 'CT')) setGoal(a, w.toCell(ai.lastSeen.x, ai.lastSeen.z));
      else ai.path = null;
    }
  }
  if (ai.target && !ai.target.alive) { ai.target = null; ai.state = 'move'; ai.path = null; }

  if (G.phase === 'freeze') { a.vel.set(0, 0, 0); animateBot(a, dt, 0); return; }
  if (ai.waitStart > 0) { ai.waitStart -= dt; }

  if (ai.target) {
    const t = ai.target;
    ai.seeT += dt;
    const aimY = t.pos.y + 1.35;
    const tyaw = yawTo(a.pos, t.pos);
    const dy = aimY - (a.pos.y + 1.62);
    const dist = Math.max(0.5, Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z));
    const tpitch = Math.atan2(dy, dist);
    const dyaw = angleDiff(a.yaw, tyaw);
    a.yaw += Math.sign(dyaw) * Math.min(Math.abs(dyaw), D.turn * dt);
    a.pitch += (tpitch - a.pitch) * Math.min(1, dt * 8);
    ai.reactT -= dt;
    // strafe
    if (!wpn.scope && ai.reloadT <= 0) {
      ai.strafeT -= dt;
      if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = 0.35 + Math.random() * 0.7; if (Math.random() < 0.3) ai.strafe = 0; }
      moveX = Math.cos(a.yaw) * ai.strafe; moveZ = -Math.sin(a.yaw) * ai.strafe;
      speed = 2.6;
    } else if (ai.reloadT > 0) {
      // back off while reloading
      moveX = Math.sin(a.yaw); moveZ = Math.cos(a.yaw); speed = 2.2;
    }
    const am = a.ammo[a.weapon];
    if (ai.reactT <= 0 && Math.abs(dyaw) < 0.12 && ai.fireCd <= 0 && ai.reloadT <= 0 && G.phase !== 'end') {
      if (am.mag <= 0) { ai.reloadT = wpn.reload; }
      else if (ai.burstPause > 0) { ai.burstPause -= dt; }
      else botShoot(a, t, D, wpn, dist, speed > 0);
    }
    if (ai.burstPause > 0) ai.burstPause -= dt;
  } else {
    // alert turn
    if (ai.alert && ai.alertT > 0) {
      const ty = yawTo(a.pos, ai.alert);
      const d = angleDiff(a.yaw, ty);
      a.yaw += Math.sign(d) * Math.min(Math.abs(d), D.turn * 0.8 * dt);
      if (ai.alertT < 0.2 && Math.random() < 0.5 && ai.state === 'hold') { ai.state = 'move'; setGoal(a, w.toCell(ai.alert.x, ai.alert.z)); }
    }
    const busy = botBombAction(a, dt);
    if (busy) { a.pitch += (-0.5 - a.pitch) * Math.min(1, dt * 5); }
    else if (ai.waitStart <= 0) {
      if (ai.state === 'move') {
        if (!ai.path) {
          const goal = bombGoal(a) || (ai.objective && !ai.reachedObj ? ai.objective : randomHuntCell(a));
          if (!setGoal(a, goal)) setGoal(a, w.walkableCells()[(Math.random() * 50) | 0]);
          ai.exact = (G.bombMode && G.bomb.state === 'planted' && a.team === 'CT') ? G.bomb.pos : (G.bombMode && G.bomb.state === 'dropped' && ai.fetchBomb ? G.bomb.pos : null);
        }
        // smoke the site on approach
        if (G.bombMode && a.team === 'T' && a.nades.smoke > 0 && !ai.smoked && G.bomb.state === 'carried') {
          const sc = G.mapDef.labels[G.plan];
          const sx = sc[0] * w.cell, sz = sc[1] * w.cell;
          const dd = Math.hypot(sx - a.pos.x, sz - a.pos.z);
          if (dd < 26 && dd > 12 && Math.random() < 0.02) {
            const ct = w.cellsOfType(['X'])[0];
            const cx = ct[0] * w.cell, cz = ct[1] * w.cell;
            const dl = Math.hypot(cx - sx, cz - sz) || 1;
            botThrow(a, 'smoke', new THREE.Vector3(sx + (cx - sx) / dl * 5, 0, sz + (cz - sz) / dl * 5));
            ai.smoked = true;
          }
        }
        if (ai.path) {
          if (ai.pi >= ai.path.length) {
            ai.path = null;
            if (ai.objective && !ai.reachedObj) { ai.reachedObj = true; ai.state = 'hold'; ai.holdT = 4 + Math.random() * 10; }
            else if (Math.random() < 0.4) { ai.state = 'hold'; ai.holdT = 2 + Math.random() * 5; }
          } else {
            const [cx, cz] = ai.path[ai.pi];
            const last = ai.pi === ai.path.length - 1;
            let [tx, tz] = w.center(cx, cz);
            tx += ai.offX * (last ? 1 : 0.5); tz += ai.offZ * (last ? 1 : 0.5);
            if (last && ai.exact) { tx = ai.exact.x + 0.5; tz = ai.exact.z; }
            const dx = tx - a.pos.x, dz = tz - a.pos.z, dd = Math.hypot(dx, dz);
            if (dd < (last ? 0.5 : 1.2)) ai.pi++;
            else {
              moveX = dx / dd; moveZ = dz / dd; speed = wpn.speed * 0.92;
              const ty = Math.atan2(-moveX, -moveZ);
              const d = angleDiff(a.yaw, ty);
              a.yaw += Math.sign(d) * Math.min(Math.abs(d), 6 * dt);
            }
          }
          // stuck detection
          ai.stuckT += dt;
          if (ai.stuckT > 1.2) {
            if (a.pos.distanceTo(ai.lastPos) < 0.6 && speed > 0) { ai.path = null; ai.offX = ai.offZ = 0; ai.objective = null; }
            ai.lastPos.copy(a.pos); ai.stuckT = 0;
          }
        }
      } else if (ai.state === 'hold') {
        ai.holdT -= dt;
        ai.scanT -= dt;
        if (ai.scanT <= 0) {
          ai.scanT = 1 + Math.random() * 2;
          // look toward an open direction
          const opts = [];
          for (let k = 0; k < 8; k++) {
            const ang = k * Math.PI / 4;
            const dir = new THREE.Vector3(-Math.sin(ang), 0, -Math.cos(ang));
            const o = new THREE.Vector3(a.pos.x, 1.6, a.pos.z);
            const h = w.raycast(o, dir, 60);
            opts.push([h ? h.t : 60, ang]);
          }
          opts.sort((x, y) => y[0] - x[0]);
          ai.lookYaw = opts[(Math.random() * 3) | 0][1];
        }
        const d = angleDiff(a.yaw, ai.lookYaw);
        a.yaw += Math.sign(d) * Math.min(Math.abs(d), 2.5 * dt);
        a.pitch *= 0.95;
        const huntTime = G.mapDef.weapons === 'sniper' ? 25 : 60;
        const guardBomb = G.bombMode && G.bomb.state === 'planted' && a.team === 'T';
        if (!guardBomb && (ai.holdT <= 0 || G.roundT < (G.mapDef.weapons === 'sniper' ? 90 : 115) - huntTime)) { ai.state = 'move'; ai.path = null; }
      }
    }
  }

  // physics
  const accel = 12;
  a.vel.x += (moveX * speed - a.vel.x) * Math.min(1, accel * dt);
  a.vel.z += (moveZ * speed - a.vel.z) * Math.min(1, accel * dt);
  a.vel.y -= 18 * dt;
  w.move(a, a.vel.x * dt, a.vel.y * dt, a.vel.z * dt, 0.32, 1.8);
  const hs = Math.hypot(a.vel.x, a.vel.z);
  if (hs > 3.5) {
    a.stepT -= dt;
    if (a.stepT <= 0) { a.stepT = 0.38; if (a.pos.distanceTo(camera.position) < 30) audio.step(new THREE.Vector3(a.pos.x, 0.1, a.pos.z), 0.5); }
  }
  animateBot(a, dt, hs);
}

const v3 = new THREE.Vector3();
function botShoot(a, t, D, wpn, dist, moving) {
  const ai = a.ai;
  ai.fireCd = 60 / wpn.rpm * (wpn.auto ? 1 : 1.25 + Math.random() * 0.6);
  const am = a.ammo[a.weapon];
  am.mag--;
  ai.burst++;
  if (wpn.auto && ai.burst >= D.burst + ((Math.random() * 3) | 0)) { ai.burst = 0; ai.burstPause = 0.25 + Math.random() * 0.35; }
  const head = Math.random() < D.head;
  const target = new THREE.Vector3(t.pos.x, t.pos.y + (head ? (t.crouch ? 1.2 : 1.66) : (t.crouch ? 0.9 : 1.3)), t.pos.z);
  const origin = new THREE.Vector3(a.pos.x, a.pos.y + 1.6, a.pos.z);
  const dir = target.sub(origin).normalize();
  let err = D.err * (moving ? 1.5 : 1) * Math.max(0.45, 1.3 - ai.seeT * 0.6);
  if (wpn.scope) err *= 0.55;
  if (wpn.auto) err += Math.min(ai.burst, 8) * wpn.recoil * 0.15;
  const tVel = Math.hypot(t.vel.x, t.vel.z);
  err *= 1 + Math.min(1, tVel / 5) * 0.5;
  dir.x += gauss() * err; dir.y += gauss() * err * 0.7; dir.z += gauss() * err;
  dir.normalize();
  const muzzle = a.model.userData.muzzle ? a.model.userData.muzzle.getWorldPosition(v3).clone() : origin.clone();
  fireRay(a, origin, dir, wpn, muzzle);
  addWorldFlash(muzzle, botFlashLight);
  audio.shot(wpn.sound, origin);
  alertBots(a, wpn.sound === 'sniper' ? 45 : 30);
}
function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

function animateBot(a, dt, hs) {
  const m = a.model;
  if (!m) return;
  m.position.copy(a.pos);
  m.rotation.y = a.yaw;
  const ud = m.userData;
  ud.anim.update(dt, hs, !!a.ai?.target);
  ud.torso.rotation.x += -a.pitch * 0.6;
  if (a.crouch) {
    ud.hips.position.y = 0.62;
    ud.legs.forEach(l => { l.thigh.rotation.x = 1.25; l.knee.rotation.x = -1.9; });
  }
}

function updateDead(a, dt) {
  if (!a.model || a.deathAnim <= 0) return;
  if (a.deathAnim < 1) {
    a.deathAnim = Math.min(1, a.deathAnim + dt * 2.4);
    const k = a.deathAnim, e = 1 - Math.pow(1 - k, 3);
    const body = a.model.userData.body;
    body.rotation.x = e * 1.45;
    body.rotation.z = e * 0.25 * a.deathDir;
    body.position.y = -e * 0.05;
    body.position.z = e * 0.25;
    a.model.userData.legs.forEach(l => { l.knee.rotation.x = -e * 0.5; });
  }
}

// ---------- player update ----------
function updatePlayer(dt) {
  const p = G.player, w = G.world, wpn = WEAPONS[p.weapon];
  const k = G.keys;
  // timers
  PW.fireCd -= dt; PW.knifeT = Math.max(0, PW.knifeT - dt);
  if (PW.switchT > 0) PW.switchT = Math.max(0, PW.switchT - dt);
  if (PW.boltT > 0) {
    PW.boltT -= dt;
    if (PW.boltT <= 0 && PW.wantScope && p.ammo[p.weapon].mag > 0) PW.scope = PW.wantScope;
  }
  if (PW.reloadT > 0) {
    PW.reloadT -= dt;
    if (PW.reloadT <= 0) {
      const am = p.ammo[p.weapon]; const need = wpn.mag - am.mag; const take = Math.min(need, am.res);
      am.mag += take; am.res -= take;
    }
  }
  // recoil recovery
  if (G.time - PW.lastShot > 0.12 && PW.recoilAcc > 0) {
    const r = PW.recoilAcc * Math.min(1, dt * 7);
    p.pitch -= r; PW.recoilAcc -= r;
  }
  if (G.mouseDown && G.state === 'playing' && $('buy').classList.contains('hidden')) playerFire();

  // bomb interaction (hold E)
  let busy = false;
  if (G.bombMode && G.phase === 'live') {
    const b = G.bomb;
    if (p.hasBomb && k.KeyE && p.onGround && siteOf(p.pos)) {
      if (G.planting === 0) audio.beep(500, 0.05, 0.12);
      G.planting += dt; busy = true;
      if (G.planting >= PLANT_TIME) { G.planting = 0; plantBomb(p); }
    } else G.planting = 0;
    const near = b.state === 'planted' && Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) < 2 && Math.abs(p.pos.y - b.pos.y) < 1.6;
    if (p.team === 'CT' && near && k.KeyE && (!b.defuser || b.defuser === p)) {
      if (G.defusing === 0) audio.beep(700, 0.05, 0.12);
      b.defuser = p; G.defusing += dt; busy = true;
      if (G.defusing >= (p.kit ? 5 : 10)) { G.defusing = 0; defuseBomb(p); }
    } else { if (b.defuser === p) b.defuser = null; G.defusing = 0; }
  }
  // movement
  const frozen = G.phase === 'freeze' || busy;
  let fx_ = 0, fz_ = 0;
  if (!frozen) {
    if (k.KeyW) fz_ -= 1; if (k.KeyS) fz_ += 1; if (k.KeyA) fx_ -= 1; if (k.KeyD) fx_ += 1;
  }
  const len = Math.hypot(fx_, fz_);
  if (len) { fx_ /= len; fz_ /= len; }
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const wx = fx_ * cos + fz_ * sin, wz = -fx_ * sin + fz_ * cos;
  const wantCrouch = !!(k.ControlLeft || k.ControlRight || k.KeyC);
  if (wantCrouch) p.crouch = true;
  else if (p.crouch && !w.overlaps(p.pos.x - 0.3, p.pos.y + 1.3, p.pos.z - 0.3, p.pos.x + 0.3, p.pos.y + 1.8, p.pos.z + 0.3)) p.crouch = false;
  let maxSp = wpn.speed * (p.crouch ? 0.42 : (k.ShiftLeft || k.ShiftRight) ? 0.52 : 1) * (PW.scope ? 0.6 : 1);
  if (p.onGround) {
    const ax = wx * maxSp - p.vel.x, az = wz * maxSp - p.vel.z;
    const a = len ? 11 : 13;
    p.vel.x += ax * Math.min(1, a * dt); p.vel.z += az * Math.min(1, a * dt);
    if (k.Space && !G.jumpHeld && !frozen) { p.vel.y = 6.2; p.onGround = false; G.jumpHeld = true; }
  } else {
    p.vel.x += wx * 8 * dt; p.vel.z += wz * 8 * dt;
    const hs = Math.hypot(p.vel.x, p.vel.z);
    if (hs > wpn.speed * 1.05) { p.vel.x *= wpn.speed * 1.05 / hs; p.vel.z *= wpn.speed * 1.05 / hs; }
  }
  if (!k.Space) G.jumpHeld = false;
  p.vel.y -= 18 * dt;
  const wasAir = !p.onGround;
  w.move(p, p.vel.x * dt, p.vel.y * dt, p.vel.z * dt, 0.3, p.crouch ? 1.3 : 1.8);
  if (wasAir && p.onGround) audio.step(null, 0.35);
  const targetEye = p.crouch ? 1.12 : 1.62;
  p.eye += (targetEye - p.eye) * Math.min(1, dt * 12);

  const hs = Math.hypot(p.vel.x, p.vel.z);
  if (p.onGround && hs > 3.6) {
    p.stepT -= dt;
    if (p.stepT <= 0) { p.stepT = 0.36; audio.step(null, 0.22); }
    PW.bob += dt * hs * 1.9;
  } else PW.bob += dt * 2 * (hs > 0.5 ? 1 : 0);

  // camera
  p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
  const bobY = p.onGround ? Math.abs(Math.sin(PW.bob)) * 0.035 * Math.min(1, hs / 5) : 0;
  camera.position.set(p.pos.x, p.pos.y + p.eye + bobY, p.pos.z);
  camera.rotation.set(p.pitch, p.yaw, 0);
  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt * 1.5);
    camera.rotation.x += (Math.random() - 0.5) * G.shake * 0.06;
    camera.rotation.y += (Math.random() - 0.5) * G.shake * 0.06;
  }
  const baseFov = settings.fov;
  const tf = PW.scope === 1 ? 34 : PW.scope === 2 ? 12 : baseFov;
  if (Math.abs(camera.fov - tf) > 0.05) { camera.fov += (tf - camera.fov) * Math.min(1, dt * 25); camera.updateProjectionMatrix(); }
  updateViewModel(dt, hs);
}

function updateViewModel(dt, hs) {
  if (!vmRoot) return;
  const p = G.player, w = WEAPONS[p.weapon];
  const base = vmRoot.userData.base;
  PW.kick = Math.max(0, PW.kick - dt * 9);
  PW.swayX *= Math.max(0, 1 - dt * 8); PW.swayY *= Math.max(0, 1 - dt * 8);
  const moveK = Math.min(1, hs / 5) * (p.onGround ? 1 : 0.3);
  let x = base.x + Math.sin(PW.bob * 0.5) * 0.012 * moveK - PW.swayX * 0.02;
  let y = base.y + Math.abs(Math.cos(PW.bob * 0.5)) * 0.01 * moveK + PW.swayY * 0.02 - (p.crouch ? 0.01 : 0);
  let z = base.z + PW.kick * (w.scope ? 0.09 : 0.045);
  let rx = PW.kick * (w.slot === 2 ? 0.25 : 0.08), ry = 0, rz = 0;
  if (PW.switchT > 0) { const s = PW.switchT / 0.45; y -= s * 0.3; rx -= s * 0.6; }
  if (G.planting > 0 || G.defusing > 0) { y -= 0.28; rx -= 0.5; }
  if (PW.reloadT > 0) {
    const r = 1 - PW.reloadT / w.reload; const s = Math.sin(r * Math.PI);
    y -= s * 0.1; rx -= s * 0.35; rz += s * 0.5;
  }
  if (PW.boltT > 0) { const r = 1 - PW.boltT / w.bolt; const s = Math.sin(r * Math.PI); rz += s * 0.25; y -= s * 0.03; }
  if (PW.knifeT > 0) { const s = Math.sin((1 - PW.knifeT / 0.35) * Math.PI); x -= s * 0.15; z -= s * 0.12; ry += s * 0.9; rx -= s * 0.3; }
  vmRoot.position.set(x, y, z);
  vmRoot.rotation.set(rx, ry, rz);
  vmRoot.visible = PW.scope === 0 && p.alive;
}

// ---------- spectate ----------
function updateSpectate(dt) {
  const p = G.player;
  G.deathT += dt;
  if (G.killcam) { updateKillcam(dt); return; }
  if (G.deathT < 1.6 && !G.killcamDone) {
    const k = Math.min(1, G.deathT / 0.8);
    camera.position.set(p.pos.x, p.pos.y + p.eye * (1 - k * 0.8) + 0.2, p.pos.z);
    camera.rotation.set(p.pitch - k * 0.6, p.yaw, k * 0.4);
    return;
  }
  const mates = G.actors.filter(a => a.alive && a.team === p.team && !a.isPlayer);
  if (!mates.length) return;
  if (!G.spectate || !G.spectate.alive || G.specNext) {
    if (G.spectate && G.spectate.model) G.spectate.model.visible = true;
    const idx = G.spectate ? (mates.indexOf(G.spectate) + 1) % mates.length : 0;
    G.spectate = mates[Math.max(0, idx)];
    G.specNext = false;
  }
  const s = G.spectate;
  if (s.model) s.model.visible = false;
  camera.position.set(s.pos.x, s.pos.y + 1.62, s.pos.z);
  camera.rotation.set(s.pitch, s.yaw, 0);
  $('center-msg').textContent = `İzleniyor: ${s.name} · ${WEAPONS[s.weapon].name} · ${Math.max(0, Math.round(s.hp))} HP   (Sol tık: değiştir)`;
}

// ---------- HUD ----------
let bannerT = 0;
function showBanner(title, sub, team, dur) {
  const b = $('banner');
  b.querySelector('.title').textContent = title;
  b.querySelector('.title').className = 'title ' + (team || '');
  b.querySelector('.sub').textContent = sub || '';
  b.classList.add('on'); bannerT = dur;
}
function showCenter(t) { $('center-msg').textContent = t; }
let hitT = 0;
function showHit(head) { const h = $('hitmarker'); h.style.opacity = 1; h.classList.toggle('head', head); hitT = 0.15; }

function addKillfeed(killer, victim, w, head) {
  const kf = $('killfeed');
  const d = document.createElement('div');
  d.className = 'k' + (killer.isPlayer || victim.isPlayer ? ' me' : '');
  d.innerHTML = `<span class="${killer.team}">${killer.name}</span><span class="w">[${w.name}]</span>${head ? '<span class="hs">◉</span>' : ''}<span class="${victim.team}">${victim.name}</span>`;
  kf.prepend(d);
  while (kf.children.length > 6) kf.lastChild.remove();
  setTimeout(() => d.remove(), 6000);
}

function scoreboardHTML() {
  let html = '';
  for (const team of ['T', 'CT']) {
    const list = G.actors.filter(a => a.team === team).sort((a, b) => b.kills - a.kills);
    const mine = team === G.player.team && G.bombMode;
    html += `<div class="sb-team ${team}"><h4>${TEAM_NAME[team]} — ${G.score[team]}</h4><div class="sb-row head"><span>OYUNCU</span><span>${mine ? 'PARA' : ''}</span><span>K</span><span>Ö</span><span>HS</span></div>`;
    for (const a of list) html += `<div class="sb-row ${a.isPlayer ? 'me' : ''} ${a.alive ? '' : 'dead'}"><span>${a.name}${a.hasBomb && mine ? ' 💣' : ''}</span><span>${mine ? '$' + a.money : ''}</span><span>${a.kills}</span><span>${a.deaths}</span><span>${a.hs}</span></div>`;
    html += '</div>';
  }
  return html;
}

function fmtTime(t) { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }

let hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHUD(dt) {
  const p = G.player, w = WEAPONS[p.weapon], am = p.ammo[p.weapon];
  setText('hp', Math.max(0, Math.round(p.hp)));
  setText('armor', Math.round(p.armor));
  $('hp').parentElement.classList.toggle('low', p.hp <= 25);
  setText('weaponName', w.name);
  setText('ammo', w.melee ? '—' : w.nade ? p.nades[w.id] : am.mag);
  setText('reserve', w.melee || w.nade ? '' : am.res);
  document.querySelector('#bottomright .sep').style.display = w.melee || w.nade ? 'none' : '';
  setText('money', G.bombMode ? p.money : '—');
  $('money').parentElement.style.display = G.bombMode ? '' : 'none';
  setText('scoreT', G.score.T); setText('scoreCT', G.score.CT);
  setText('roundNo', `ROUND ${G.round}`);
  const planted = G.bombMode && G.bomb.state === 'planted';
  setText('timer', planted ? '💣' : G.phase === 'freeze' ? fmtTime(G.freezeT) : fmtTime(G.roundT));
  $('timer').classList.toggle('bomb', planted);
  $('timer').style.color = G.phase === 'freeze' ? '#f0a64a' : G.roundT < 10 ? '#ff5050' : '#fff';
  // bomb info + progress
  let info = '';
  if (G.bombMode && p.alive) {
    const b = G.bomb;
    if (p.hasBomb) info = siteOf(p.pos) ? '💣 Bomba bölgesindesin — kurmak için E basılı tut' : `💣 Bomba sende — A veya B bölgesine götür (plan: ${G.plan}) · G: bırak`;
    else if (b.state === 'dropped' && p.team === 'T') info = '💣 Bomba yerde! Almak için üzerinden geç';
    else if (b.state === 'planted' && p.team === 'CT') info = Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) < 2 ? 'İmha etmek için E basılı tut' + (p.kit ? ' (kit: 5 sn)' : ' (10 sn)') : `💣 Bomba ${b.site} bölgesine kuruldu — imha et!`;
    else if (b.state === 'planted' && p.team === 'T') info = `💣 Bomba ${b.site} bölgesinde — koru!`;
  }
  setText('bombInfo', info);
  const prog = G.planting > 0 ? G.planting / PLANT_TIME : G.defusing > 0 ? G.defusing / (p.kit ? 5 : 10) : 0;
  $('progress').classList.toggle('on', prog > 0);
  if (prog > 0) {
    setText('progLabel', G.planting > 0 ? 'BOMBA KURULUYOR' : 'BOMBA İMHA EDİLİYOR');
    $('progress').querySelector('i').style.width = (prog * 100).toFixed(1) + '%';
  }
  for (const team of ['T', 'CT']) {
    const list = G.actors.filter(a => a.team === team);
    const key = list.map(a => a.alive ? 1 : 0).join('');
    if (hudCache['alive' + team] !== key) {
      hudCache['alive' + team] = key;
      $('alive' + team).innerHTML = list.map(a => `<b class="${a.alive ? '' : 'dead'}"></b>`).join('');
    }
  }
  const nadeTxt = NADES.filter(n => p.nades[n] > 0).map(n => ({ he: 'HE', flash: 'FL', smoke: 'SM' }[n] + (p.nades[n] > 1 ? '×' + p.nades[n] : ''))).join(' ');
  const slotKey = [1, 2, 3].map(s => p.loadout[s] ? (p.loadout[s] === p.weapon ? '*' : '') + s + WEAPONS[p.loadout[s]].name : '').join('|') + nadeTxt + p.weapon;
  if (hudCache.slots !== slotKey) {
    hudCache.slots = slotKey;
    $('slots').innerHTML = [1, 2, 3].filter(s => p.loadout[s]).map(s => `<span class="${p.loadout[s] === p.weapon ? 'on' : ''}">${s} ${WEAPONS[p.loadout[s]].name}</span>`).join('')
      + (nadeTxt ? `<span class="${WEAPONS[p.weapon].nade ? 'on' : ''}">4 ${nadeTxt}</span>` : '');
  }
  // crosshair
  const ch = $('crosshair');
  ch.style.display = p.alive && PW.scope === 0 ? 'block' : 'none';
  if (p.alive && PW.scope === 0) {
    const dyn = settings.ch.dynamic && !w.melee && !w.nade ? currentSpread() * window.innerHeight * 0.6 : 0;
    const g = Math.round(Math.min(80, settings.ch.gap + dyn));
    if (hudCache.chGap !== g || hudCache.chScope !== !!w.scope) {
      hudCache.chGap = g; hudCache.chScope = !!w.scope;
      applyCrosshair(ch, g);
      if (w.scope) for (let i = 0; i < 4; i++) ch.children[i].style.display = 'none';
      if (w.scope) ch.children[5].style.display = 'none';
      if (w.scope) ch.children[4].style.display = 'block';
    }
  }
  $('scope').classList.toggle('on', PW.scope > 0 && p.alive);
  hitT -= dt; if (hitT <= 0) $('hitmarker').style.opacity = 0;
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('on'); }
  // hint
  let hint = '';
  const buyTxt = G.bombMode ? 'B: Satın al' : 'B: Silah seç';
  if (G.phase === 'freeze') hint = `Hazırlık ${Math.ceil(G.freezeT)} · ${buyTxt}`;
  else if (p.alive && G.roundT > (G.mapDef.weapons === 'sniper' ? 80 : 95)) hint = buyTxt;
  if (!$('buy').classList.contains('hidden')) { if (!canBuy()) $('buy').classList.add('hidden'); else if (G.bombMode && hudCache.buyMoney !== p.money) { hudCache.buyMoney = p.money; renderBuy(); } }
  if (PW.reloadT > 0) hint = 'Şarjör değiştiriliyor...';
  setText('hint', hint);
  if (p.alive && G.phase !== 'end' && $('center-msg').textContent && !G.test) $('center-msg').textContent = '';
  drawRadar();
}

// ---------- radar ----------
let radarBase = null, radarScale = 2;
function buildRadarBase() {
  const w = G.world, C = w.cell;
  const S = 4; // px per meter on base
  const c = document.createElement('canvas');
  c.width = w.w * C * S; c.height = w.h * C * S;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, c.width, c.height);
  for (let z = 0; z < w.h; z++) for (let xx = 0; xx < w.w; xx++) {
    if (w.isSolid(xx, z)) continue;
    const t = w.grid[z][xx];
    x.fillStyle = t === 'A' || t === 'B' ? '#8a6a4a' : t === 'T' ? '#6e5a3a' : t === 'X' ? '#4a5a6e' : t === 't' ? '#4f4a44' : '#7a6a55';
    x.fillRect(xx * C * S, z * C * S, C * S + 1, C * S + 1);
  }
  x.fillStyle = '#3a2f25';
  for (const cc of w.colliders) if (cc.kind === 'crate' || cc.kind === 'door') x.fillRect(cc.min[0] * S, cc.min[2] * S, (cc.max[0] - cc.min[0]) * S, (cc.max[2] - cc.min[2]) * S);
  x.font = `bold ${C * S * 1.4}px sans-serif`; x.fillStyle = 'rgba(255,90,70,0.9)'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const k in G.mapDef.labels) { const [lx, lz] = G.mapDef.labels[k]; x.fillText(k, lx * C * S, lz * C * S); }
  radarBase = { c, S };
  radarScale = G.mapDef.id === 'bazaar' ? 3.0 : 1.9;
}
function drawRadar() {
  const cv = $('radar'), x = cv.getContext('2d');
  const p = G.player;
  const view = !p.alive && G.spectate ? G.spectate : p;
  x.clearRect(0, 0, 200, 200);
  x.save();
  x.beginPath(); x.roundRect ? x.roundRect(0, 0, 200, 200, 10) : x.rect(0, 0, 200, 200); x.clip();
  x.translate(100, 100);
  x.rotate(view.yaw);
  x.scale(radarScale, radarScale);
  x.translate(-view.pos.x, -view.pos.z);
  x.globalAlpha = 0.85;
  x.drawImage(radarBase.c, 0, 0, radarBase.c.width / radarBase.S, radarBase.c.height / radarBase.S);
  x.globalAlpha = 1;
  for (const a of G.actors) {
    if (a === view) continue;
    const mate = a.team === p.team;
    if (!mate && (G.time - a.spottedT > 2 || !a.alive)) continue;
    x.fillStyle = !a.alive ? 'rgba(200,200,200,0.5)' : mate ? (a.team === 'T' ? '#f0a64a' : '#5fb3ff') : '#ff3030';
    x.beginPath(); x.arc(a.pos.x, a.pos.z, 3.2 / radarScale * 2, 0, 7); x.fill();
    if (a.hasBomb && mate) { x.strokeStyle = '#ff3030'; x.lineWidth = 1.2 / radarScale * 2; x.stroke(); }
  }
  if (G.bombMode) {
    const b = G.bomb;
    if (b.state === 'planted' || (b.state === 'dropped' && p.team === 'T')) {
      const blink = b.state !== 'planted' || Math.sin(G.time * 10) > 0;
      if (blink) { x.fillStyle = '#ff2a2a'; x.fillRect(b.pos.x - 2.2, b.pos.z - 1.4, 4.4, 2.8); x.fillStyle = '#ffd24a'; x.fillRect(b.pos.x - 0.8, b.pos.z - 0.6, 1.6, 1.2); }
    }
  }
  for (const sm of smokes) { x.fillStyle = 'rgba(210,210,210,0.45)'; x.beginPath(); x.arc(sm.pos.x, sm.pos.z, 3.6, 0, 7); x.fill(); }
  x.restore();
  // player arrow
  x.fillStyle = '#fff';
  x.beginPath(); x.moveTo(100, 92); x.lineTo(106, 106); x.lineTo(100, 102); x.lineTo(94, 106); x.closePath(); x.fill();
}

// ---------- buy menu ----------
function renderBuy() {
  const p = G.player;
  if (G.bombMode) {
    const list = buyList(p.team);
    let html = `<div class="buy-money">$${p.money}</div><div class="buy-grid">`;
    list.forEach((it, i) => {
      const key = i === 9 ? 0 : i + 1;
      const price = itemPrice(p, it.k);
      const owned = itemOwned(p, it.k);
      const cls = owned ? 'owned' : p.money < price ? 'poor' : '';
      html += `<div class="item ${cls}"><b>${key}</b><span class="nm">${it.label}<small>${it.cat}</small></span><span class="pr">${owned ? '✓' : '$' + price}</span></div>`;
    });
    $('buyBody').innerHTML = html + '</div>';
    return;
  }
  const prim = ['awm'];
  const items = [...prim.map(id => ({ id, on: G.loadout.primary === id })), ...SECONDARIES.map(id => ({ id, on: G.loadout.secondary === id }))];
  $('buyBody').innerHTML = '<div class="buy-grid">' + items.map((it, i) => `<div class="item ${it.on ? 'on' : ''}"><b>${i + 1}</b><span class="nm">${WEAPONS[it.id].name}</span><span class="pr">ücretsiz</span></div>`).join('') + '</div>';
}
function canBuy() { return G.player.alive && (G.phase === 'freeze' || G.roundT > (G.mapDef.weapons === 'sniper' ? 80 : 95)); }
function buyPick(n) {
  const p = G.player;
  if (!canBuy()) return;
  if (G.bombMode) {
    const it = buyList(p.team)[n - 1];
    if (!it) return;
    const r = buyItem(p, it.k);
    if (r === 'ok') {
      audio.buy();
      const w = WEAPONS[it.k];
      if (w && !w.nade) { p.weapon = it.k; PW.scope = 0; PW.reloadT = 0; PW.switchT = 0.45; buildViewModel(); }
    } else audio.beep(220, 0.08, 0.15);
    renderBuy();
    return;
  }
  const order = ['awm', ...SECONDARIES];
  const id = order[n - 1];
  if (!id) return;
  if (WEAPONS[id].slot === 1) G.loadout.primary = id; else G.loadout.secondary = id;
  giveWeapon(p, id);
  p.weapon = id; PW.scope = 0; PW.reloadT = 0; PW.switchT = 0.45;
  buildViewModel();
  renderBuy();
  audio.beep(1200, 0.04, 0.15);
}

// ---------- input ----------
function locked() { return document.pointerLockElement === canvas; }
document.addEventListener('keydown', e => {
  G.keys[e.code] = true;
  if (G.state !== 'playing') return;
  if (e.code === 'Tab') { e.preventDefault(); $('scoreboard').innerHTML = scoreboardHTML(); $('scoreboard').classList.remove('hidden'); }
  const buyOpen = !$('buy').classList.contains('hidden');
  if (e.code === 'KeyB') {
    if (buyOpen) $('buy').classList.add('hidden');
    else if (canBuy()) { renderBuy(); $('buy').classList.remove('hidden'); }
  }
  const digit = e.code.startsWith('Digit') ? +e.code.slice(5) : -1;
  if (digit >= 0) {
    if (buyOpen) buyPick(digit === 0 ? 10 : digit);
    else if (digit >= 1 && digit <= 4) switchWeapon(digit);
  }
  if (e.code === 'KeyG' && G.player.alive && G.player.hasBomb && G.phase === 'live') dropBomb(G.player);
  if (e.code === 'KeyQ') { const p = G.player; const cur = WEAPONS[p.weapon].slot; switchWeapon(G.lastSlot && G.lastSlot !== cur ? G.lastSlot : (cur === 1 ? 2 : 1)); G.lastSlot = cur; }
  if (e.code === 'KeyR') tryReload();
  if (e.code === 'ControlLeft') e.preventDefault();
});
document.addEventListener('keyup', e => {
  G.keys[e.code] = false;
  if (e.code === 'Tab') $('scoreboard').classList.add('hidden');
});
window.addEventListener('blur', () => { G.keys = {}; G.mouseDown = false; });
canvas.addEventListener('mousedown', e => {
  if (G.state !== 'playing') return;
  if (!locked() && !G.test) { canvas.requestPointerLock(); return; }
  if (e.button === 0) {
    if (!G.player.alive) { G.specNext = true; return; }
    G.mouseDown = true; G.firedThisPress = false;
    $('buy').classList.add('hidden');
  }
  if (e.button === 2) {
    const w = WEAPONS[G.player.weapon];
    if (w.scope && PW.boltT <= 0 && PW.reloadT <= 0 && PW.switchT <= 0) { PW.scope = (PW.scope + 1) % 3; audio.beep(2000, 0.02, 0.08); }
  }
});
document.addEventListener('mouseup', e => { if (e.button === 0) { G.mouseDown = false; G.firedThisPress = false; } });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('wheel', e => {
  if (G.state !== 'playing' || !G.player.alive) return;
  const cur = WEAPONS[G.player.weapon].slot;
  let s = cur;
  for (let i = 0; i < 4; i++) { s = ((s - 1 + (e.deltaY > 0 ? 1 : -1) + 4) % 4) + 1; if (s === 4 ? totalNades(G.player) > 0 : G.player.loadout[s]) break; }
  switchWeapon(s);
});
document.addEventListener('mousemove', e => {
  if (G.state !== 'playing' || !locked() || !G.player.alive) return;
  const zoom = camera.fov / settings.fov;
  const s = settings.sens * 0.0021 * zoom;
  G.player.yaw -= e.movementX * s;
  G.player.pitch -= e.movementY * s;
  PW.swayX += e.movementX * 0.002; PW.swayY += e.movementY * 0.002;
});
document.addEventListener('pointerlockchange', () => {
  if (!locked() && G.state === 'playing' && !G.test) pause();
});

function pause() {
  G.state = 'paused';
  G.keys = {}; G.mouseDown = false;
  $('pause').classList.remove('hidden');
}
function resume() {
  $('pause').classList.add('hidden');
  G.state = 'playing';
  canvas.requestPointerLock();
}
function toMenu() {
  G.state = 'menu';
  if (document.pointerLockElement) document.exitPointerLock();
  $('pause').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.add('hidden');
  $('menu').classList.remove('hidden');
}
$('resume').onclick = resume;
$('quit').onclick = toMenu;
$('endMenu').onclick = toMenu;
$('again').onclick = () => { audio.init(); startMatch(); canvas.requestPointerLock(); };

// ---------- menu ----------
function mapPreview(def) {
  const c = document.createElement('canvas'); c.width = c.height = 150;
  const x = c.getContext('2d');
  const s = Math.min(140 / def.w, 140 / def.h);
  const ox = (150 - def.w * s) / 2, oz = (150 - def.h * s) / 2;
  x.fillStyle = '#15110c'; x.fillRect(0, 0, 150, 150);
  for (let z = 0; z < def.h; z++) for (let xx = 0; xx < def.w; xx++) {
    const t = def.grid[z][xx];
    if (t === '#') continue;
    x.fillStyle = t === 'A' || t === 'B' ? '#c08a52' : t === 'T' ? '#a07a46' : t === 'X' ? '#5f7896' : t === 't' ? '#6a5f52' : t === 'm' ? '#b5776a' : '#9c8662';
    x.fillRect(ox + xx * s, oz + z * s, s + 0.5, s + 0.5);
  }
  x.fillStyle = '#3b2c1e';
  for (const [cx, cz] of def.crates) x.fillRect(ox + (cx + 0.3) * s, oz + (cz + 0.3) * s, s * 0.4, s * 0.4);
  x.font = 'bold 18px sans-serif'; x.fillStyle = '#ff5a46'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const k in def.labels) x.fillText(k, ox + def.labels[k][0] * s, oz + def.labels[k][1] * s);
  return c;
}
function buildMenu() {
  const maps = $('maps'); maps.innerHTML = '';
  for (const id in MAPS) {
    const def = MAPS[id]();
    const card = document.createElement('div');
    card.className = 'mapcard' + (settings.map === id ? ' on' : '');
    card.appendChild(mapPreview(def));
    const info = document.createElement('div'); info.className = 'info';
    info.innerHTML = `<div class="name">${def.name.toUpperCase()}</div><div class="desc">${def.desc}</div><div class="meta">${def.weapons === 'sniper' ? 'SADECE AWM' : 'TÜM SİLAHLAR'} · ÖNERİLEN ${def.teamSizeDefault}v${def.teamSizeDefault}</div>`;
    card.appendChild(info);
    card.onclick = () => {
      settings.map = id; settings.size = def.teamSizeDefault; saveSettings(); buildMenu(); syncSegs();
    };
    maps.appendChild(card);
  }
}
function seg(id, key, num) {
  const el = $(id);
  el.querySelectorAll('button').forEach(b => {
    b.onclick = () => { settings[key] = num ? +b.dataset.v : b.dataset.v; saveSettings(); syncSegs(); };
  });
}
function syncSegs() {
  for (const [id, key] of [['teamSel', 'team'], ['diffSel', 'diff'], ['sizeSel', 'size']]) {
    $(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', String(settings[key]) === b.dataset.v));
  }
}
seg('teamSel', 'team'); seg('diffSel', 'diff', true); seg('sizeSel', 'size', true);
function slider(id, key, fmt) {
  const el = $(id), v = $(id + 'V');
  el.value = settings[key]; v.textContent = fmt(settings[key]);
  el.oninput = () => { settings[key] = +el.value; v.textContent = fmt(settings[key]); saveSettings(); if (key === 'vol') audio.setVolume(settings.vol); if (key === 'fov') { camera.fov = settings.fov; camera.updateProjectionMatrix(); } };
}
slider('sens', 'sens', v => (+v).toFixed(2));
slider('fov', 'fov', v => v);
slider('vol', 'vol', v => Math.round(v * 100));
$('quality').value = settings.quality;
$('quality').onchange = () => { settings.quality = +$('quality').value; saveSettings(); location.reload(); };
buildMenu(); syncSegs();
$('play').onclick = () => {
  audio.init(); audio.setVolume(settings.vol);
  G.loadout = { primary: null, secondary: null };
  startMatch();
  canvas.requestPointerLock();
};

// ---------- skin previews ----------
let previewR = null, previewScene = null, previewCam = null;
const previewCache = {};
function skinPreview(skinId) {
  if (previewCache[skinId]) return previewCache[skinId];
  if (!previewR) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 150;
    previewR = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
    previewR.outputColorSpace = THREE.SRGBColorSpace;
    previewR.toneMapping = THREE.ACESFilmicToneMapping;
    previewScene = new THREE.Scene();
    previewScene.environment = new THREE.PMREMGenerator(previewR).fromScene(new RoomEnvironment(), 0.04).texture;
    previewScene.environmentIntensity = 0.9;
    previewScene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.4));
    const d = new THREE.DirectionalLight(0xffffff, 2.5); d.position.set(1, 2, 1.5); previewScene.add(d);
    previewCam = new THREE.OrthographicCamera(-0.6, 0.6, 0.28, -0.28, 0.01, 10);
  }
  const def = SKINS[skinId];
  const g = buildGun(def.weapon, tex, skinId);
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  g.position.sub(ctr);
  const holder = new THREE.Group(); holder.add(g);
  holder.rotation.set(0.12, -Math.PI / 2, 0);
  previewScene.add(holder);
  const span = Math.max(size.z, 0.3) * 0.62;
  previewCam.left = -span; previewCam.right = span; previewCam.top = span * 150 / 320; previewCam.bottom = -span * 150 / 320;
  previewCam.position.set(0, 0, 3); previewCam.lookAt(0, 0, 0); previewCam.updateProjectionMatrix();
  previewR.setClearColor(0x000000, 0);
  previewR.render(previewScene, previewCam);
  const url = previewR.domElement.toDataURL('image/png');
  previewScene.remove(holder);
  previewCache[skinId] = url;
  return url;
}

function skinCardHTML(skinId, extra = '') {
  const d = SKINS[skinId], r = RARITY[d.rarity];
  return `<img src="${skinPreview(skinId)}"><div class="wn">${WEAPONS[d.weapon].name}</div><div class="sn">${d.name}</div><div class="rr" style="color:${r.color}">${r.name}</div><div class="bar" style="background:${r.color}"></div>${extra}`;
}

function updateGoldUI() {
  $('goldVal').textContent = inv.gold;
  document.querySelectorAll('.goldVal2').forEach(e => { e.textContent = inv.gold; });
}

let invTab = 'all';
function renderInventory() {
  updateGoldUI();
  const weapons = ['all', ...new Set(Object.values(SKINS).map(s => s.weapon))];
  $('invTabs').innerHTML = weapons.map(w => `<button data-w="${w}" class="${invTab === w ? 'on' : ''}">${w === 'all' ? 'TÜMÜ' : WEAPONS[w].name}</button>`).join('');
  $('invTabs').querySelectorAll('button').forEach(b => { b.onclick = () => { invTab = b.dataset.w; renderInventory(); }; });
  const items = inv.items.filter(i => SKINS[i.skin] && (invTab === 'all' || SKINS[i.skin].weapon === invTab))
    .sort((a, b) => RARITY_ORDER.indexOf(SKINS[b.skin].rarity) - RARITY_ORDER.indexOf(SKINS[a.skin].rarity));
  if (!items.length) { $('invGrid').innerHTML = '<div class="empty">Henüz skinin yok. KASALAR bölümünden kasa açabilirsin.</div>'; return; }
  $('invGrid').innerHTML = items.map(it => {
    const eq = inv.equipped[SKINS[it.skin].weapon] === it.uid;
    return `<div class="skin-card ${eq ? 'equipped' : ''}" data-uid="${it.uid}">${skinCardHTML(it.skin, (eq ? '<span class="eq">KUŞANILDI</span>' : '') + `<span class="sellbtn" data-sell="${it.uid}">Sat ◆${RARITY[SKINS[it.skin].rarity].sell}</span>`)}</div>`;
  }).join('');
  $('invGrid').querySelectorAll('.skin-card').forEach(c => {
    c.onclick = (e) => {
      const sellId = e.target.dataset.sell;
      if (sellId) { sell(+sellId); audio.init(); audio.buy(); renderInventory(); return; }
      equip(+c.dataset.uid); audio.init(); audio.beep(1500, 0.04, 0.12); renderInventory();
    };
  });
}

function renderCases() {
  updateGoldUI();
  $('caseList').innerHTML = Object.entries(CASES).map(([id, c]) => `
    <div class="case-row">
      <div class="case-box" style="background:linear-gradient(135deg, ${c.color}, #1b1b22); box-shadow: 0 0 30px ${c.color}55">◈</div>
      <div class="case-info"><h3>${c.name}</h3><div class="case-skins">${c.skins.map(k => `<span style="border-color:${RARITY[SKINS[k].rarity].color}">${WEAPONS[SKINS[k].weapon].name} | ${SKINS[k].name}</span>`).join('')}</div></div>
      <button class="play" data-case="${id}" ${inv.gold < c.price ? 'disabled style="opacity:.4"' : ''}>AÇ ◆${c.price}</button>
    </div>`).join('');
  $('caseList').querySelectorAll('button[data-case]').forEach(b => { b.onclick = () => openCase(b.dataset.case); });
}

function openCase(caseId) {
  const c = CASES[caseId];
  if (inv.gold < c.price) return;
  audio.init();
  inv.gold -= c.price; saveInv(); updateGoldUI();
  const result = rollCase(caseId);
  const item = addItem(result);
  const N = 46, WIN = 40;
  const strip = [];
  for (let i = 0; i < N; i++) strip.push(i === WIN ? result : rollCase(caseId));
  $('openTitle').textContent = c.name.toUpperCase();
  $('reel').innerHTML = strip.map(k => `<div class="skin-card">${skinCardHTML(k)}</div>`).join('');
  $('openResult').innerHTML = '';
  $('casePanel').classList.add('hidden');
  $('openPanel').classList.remove('hidden');
  const reel = $('reel');
  reel.style.transition = 'none'; reel.style.transform = 'translateX(0px)';
  const cardW = 166, wrapW = reel.parentElement.clientWidth;
  const target = WIN * cardW + cardW / 2 - wrapW / 2 + (Math.random() - 0.5) * 120;
  void reel.offsetWidth;
  const dur = 5.5;
  reel.style.transition = `transform ${dur}s cubic-bezier(0.08, 0.6, 0.12, 1)`;
  reel.style.transform = `translateX(${-target}px)`;
  // ticking sound as cards pass the marker
  let lastIdx = -1;
  const t0 = performance.now();
  const tick = () => {
    const m = new DOMMatrix(getComputedStyle(reel).transform);
    const idx = Math.floor((-m.m41 + wrapW / 2) / cardW);
    if (idx !== lastIdx) { lastIdx = idx; audio.tick(); }
    if (performance.now() - t0 < dur * 1000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => {
    const d = SKINS[result], r = RARITY[d.rarity];
    audio.reveal(RARITY_ORDER.indexOf(d.rarity));
    $('openResult').innerHTML = `<div class="win" style="background:radial-gradient(circle, ${r.color}44, transparent 70%); border:1px solid ${r.color}">
      <img src="${skinPreview(result)}"><div class="wn">${WEAPONS[d.weapon].name}</div><div class="sn" style="font-size:24px">${d.name}</div><div class="rr" style="color:${r.color}">${r.name}</div></div>
      <div class="btns"><button class="play" id="oEquip">KUŞAN</button><button class="ghost" id="oSell">SAT ◆${r.sell}</button><button class="ghost" id="oAgain">TEKRAR AÇ ◆${c.price}</button><button class="ghost" id="oClose">KAPAT</button></div>`;
    $('oEquip').onclick = () => { if (inv.equipped[d.weapon] !== item.uid) equip(item.uid); $('openPanel').classList.add('hidden'); $('invPanel').classList.remove('hidden'); renderInventory(); };
    $('oSell').onclick = () => { sell(item.uid); updateGoldUI(); $('openPanel').classList.add('hidden'); $('casePanel').classList.remove('hidden'); renderCases(); };
    $('oAgain').onclick = () => { if (inv.gold >= c.price) openCase(caseId); };
    $('oAgain').style.opacity = inv.gold >= c.price ? 1 : 0.4;
    $('oClose').onclick = () => { $('openPanel').classList.add('hidden'); $('casePanel').classList.remove('hidden'); renderCases(); };
  }, dur * 1000 + 150);
}

$('btnInv').onclick = () => { audio.init(); renderInventory(); $('invPanel').classList.remove('hidden'); };
$('btnCases').onclick = () => { audio.init(); renderCases(); $('casePanel').classList.remove('hidden'); };
document.querySelectorAll('.panel .close').forEach(b => { b.onclick = () => b.closest('.panel').classList.add('hidden'); });
updateGoldUI();

// ---------- statistics panel ----------
function renderStats() {
  const s = stats;
  const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
  const hsp = s.kills ? Math.round(s.hs / s.kills * 100) : 0;
  const acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0;
  const wr = s.matches ? Math.round(s.wins / s.matches * 100) : 0;
  const ids = [...new Set([...Object.keys(s.weaponKills), ...Object.keys(s.weaponShots)])].filter(id => WEAPONS[id]);
  ids.sort((a, b) => (s.weaponKills[b] || 0) - (s.weaponKills[a] || 0) || (s.weaponShots[b] || 0) - (s.weaponShots[a] || 0));
  const fav = ids[0] ? WEAPONS[ids[0]].name : '—';
  const favMap = Object.entries(s.mapPlays).sort((a, b) => b[1] - a[1])[0];
  const maxK = Math.max(1, ...ids.map(id => s.weaponKills[id] || 0));
  const card = (v, k, hl) => `<div class="st-card ${hl ? 'hl' : ''}"><div class="v">${v}</div><div class="k">${k}</div></div>`;
  let html = '<div class="st-grid">' +
    card(s.kills, 'TOPLAM KILL', true) + card(kd, 'K/D ORANI', true) + card('%' + hsp, 'KAFA VURUŞU ORANI', true) + card(fav, 'EN ÇOK KULLANILAN SİLAH', true) +
    card(s.deaths, 'ÖLÜM') + card(s.hs, 'KAFA VURUŞU') + card('%' + acc, 'İSABET ORANI') + card(s.shots, 'ATILAN MERMİ') +
    card(s.matches, 'MAÇ') + card(s.wins + ` <small style="font-size:14px;opacity:.6">(%${wr})</small>`, 'GALİBİYET') + card(s.roundsWon, 'KAZANILAN ROUND') + card(favMap ? favMap[0][0].toUpperCase() + favMap[0].slice(1) : '—', 'EN ÇOK OYNANAN HARİTA') +
    '</div>';
  html += '<div class="st-row head"><span>SİLAH</span><span></span><span>KILL</span><span>MERMİ</span></div>';
  html += ids.length ? ids.map(id => `<div class="st-row"><span>${WEAPONS[id].name}</span><span class="bar"><i style="width:${((s.weaponKills[id] || 0) / maxK * 100).toFixed(0)}%"></i></span><span>${s.weaponKills[id] || 0}</span><span>${s.weaponShots[id] || 0}</span></div>`).join('')
    : '<div class="empty">Henüz istatistik yok. Bir maç oyna!</div>';
  $('statsBody').innerHTML = html;
}
$('btnStats').onclick = () => { audio.init(); renderStats(); $('statsPanel').classList.remove('hidden'); };
$('statsReset').onclick = () => {
  if (!confirm('Tüm istatistikler sıfırlansın mı?')) return;
  Object.assign(stats, { kills: 0, deaths: 0, hs: 0, shots: 0, hits: 0, matches: 0, wins: 0, roundsWon: 0, roundsPlayed: 0, goldEarned: 0, weaponKills: {}, weaponShots: {}, mapPlays: {} });
  saveStats(); renderStats();
};

// ---------- crosshair panel ----------
const CH_COLORS = ['#4dff7a', '#ff3b3b', '#ffe14d', '#3bf0ff', '#ffffff', '#ff4fd8', '#ff9a2e', '#000000'];
function renderChPanel() {
  const c = settings.ch;
  $('chStyle').querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === c.style); b.onclick = () => { c.style = b.dataset.v; chChanged(); }; });
  $('chColors').innerHTML = CH_COLORS.map(col => `<button style="background:${col}" data-c="${col}" class="${c.color === col ? 'on' : ''}"></button>`).join('') + `<input type="color" id="chCustom" value="${c.color}">`;
  $('chColors').querySelectorAll('button').forEach(b => { b.onclick = () => { c.color = b.dataset.c; chChanged(); }; });
  $('chCustom').oninput = (e) => { c.color = e.target.value; chChanged(false); };
  for (const [id, key] of [['chSize', 'size'], ['chThick', 'thick'], ['chGap', 'gap']]) {
    $(id).value = c[key]; $(id + 'V').textContent = c[key];
    $(id).oninput = () => { c[key] = +$(id).value; $(id + 'V').textContent = c[key]; chChanged(false); };
  }
  $('chOutline').checked = c.outline; $('chOutline').onchange = () => { c.outline = $('chOutline').checked; chChanged(false); };
  $('chDynamic').checked = c.dynamic; $('chDynamic').onchange = () => { c.dynamic = $('chDynamic').checked; chChanged(false); };
  $('optDmg').checked = settings.dmgNums; $('optDmg').onchange = () => { settings.dmgNums = $('optDmg').checked; saveSettings(); };
  $('optKillcam').checked = settings.killcam; $('optKillcam').onchange = () => { settings.killcam = $('optKillcam').checked; saveSettings(); };
  applyCrosshair($('chPreview'), c.gap);
}
function chChanged(rerender = true) {
  saveSettings(); hudCache.chGap = -1;
  if (rerender) renderChPanel(); else applyCrosshair($('chPreview'), settings.ch.gap);
}
$('btnCh').onclick = () => { audio.init(); renderChPanel(); $('chPanel').classList.remove('hidden'); };
$('chReset').onclick = () => { settings.ch = { ...CH_DEFAULT }; chChanged(); };

document.querySelectorAll('.panel .close').forEach(b => { b.onclick = () => b.closest('.panel').classList.add('hidden'); });
// menu background scene
function menuBackground() {
  buildMap('sandstorm');
  G.menuCam = 0;
}
menuBackground();

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick(dt);
  render();
}
function tick(dt) {
  if (G.state === 'menu') {
    G.menuCam += dt * 0.05;
    const W = G.world.w * G.world.cell, H = G.world.h * G.world.cell;
    camera.position.set(W / 2 + Math.cos(G.menuCam) * 30, 22, H / 2 + Math.sin(G.menuCam) * 30);
    camera.lookAt(W / 2, 0, H / 2 - 10);
    if (vmRoot) vmRoot.visible = false;
    return;
  }
  if (G.state !== 'playing') return;
  G.time += dt;
  if (G.phase === 'freeze') {
    G.freezeT -= dt;
    if (G.freezeT <= 0) { G.phase = 'live'; audio.beep(990, 0.15); }
  } else if (G.phase === 'live') {
    G.roundT -= dt;
    if (G.roundT <= 0 && !(G.bombMode && G.bomb.state === 'planted')) {
      if (G.mapDef.weapons === 'sniper') {
        const t = G.actors.filter(a => a.team === 'T' && a.alive).length, c = G.actors.filter(a => a.team === 'CT' && a.alive).length;
        endRound(t > c ? 'T' : 'CT', 'Süre doldu');
      } else endRound('CT', 'Süre doldu — bomba kurulamadı');
    }
  } else if (G.phase === 'end') {
    G.endT -= dt;
    if (G.endT <= 0) {
      if (G.score.T >= WIN_ROUNDS || G.score.CT >= WIN_ROUNDS) { endMatch(); return; }
      G.round++; startRound();
    }
  }
  if (G.player.alive) updatePlayer(dt);
  else { updateSpectate(dt); if (vmRoot) vmRoot.visible = false; }
  for (const a of G.actors) {
    if (a.isPlayer) continue;
    if (a.alive) updateBot(a, dt); else updateDead(a, dt);
  }
  recordFrame();
  updateDmgNums(dt);
  updateBomb(dt);
  updateNades(dt);
  updateFx(dt);
  updateHUD(dt);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  audio.listener(camera.position, fwd);
}
function render() {
  if (G.sky) G.sky.position.copy(camera.position);
  renderer.clear();
  const restore = G.killcam ? applyKillcamPose() : null;
  if (composer) composer.render(); else renderer.render(scene, camera);
  if (restore) restore();
  if (G.state !== 'menu' && vmRoot && vmRoot.visible) {
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);
  }
}
requestAnimationFrame(frame);

// ---------- test hooks ----------
window.__sz = {
  G, settings, PW, camera,
  start(opts = {}) { Object.assign(settings, opts); G.test = true; G.loadout = { primary: null, secondary: null }; startMatch(); },
  tick(n = 1, dt = 1 / 60, draw = true) { for (let i = 0; i < n; i++) tick(dt); if (draw) render(); },
  renderer, scene,
  render,
  view(x, y, z, yaw, pitch) { const p = G.player; p.pos.set(x, y, z); p.yaw = yaw; p.pitch = pitch; },
  fire() { G.firedThisPress = false; playerFire(); },
  stats, inv, equip, addItem, switchWeapon, buyPick, throwNade, nadeList, smokes, plantBomb, explodeBomb,
};
