import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { skinMaterial } from './skins.js';

export const WEAPONS = {
  ak: { id: 'ak', name: 'AK-47', slot: 1, dmg: 36, rpm: 600, auto: true, mag: 30, reserve: 90, reload: 2.4, spread: 0.0035, moveSpread: 0.055, airSpread: 0.15, recoil: 0.016, head: 4, armorPen: 0.78, speed: 5.0, sound: 'rifle', range: 250 },
  m4: { id: 'm4', name: 'M4A1', slot: 1, dmg: 32, rpm: 690, auto: true, mag: 30, reserve: 90, reload: 2.2, spread: 0.003, moveSpread: 0.045, airSpread: 0.15, recoil: 0.0135, head: 4, armorPen: 0.7, speed: 5.1, sound: 'rifle2', range: 250 },
  awm: { id: 'awm', name: 'AWM', slot: 1, dmg: 115, rpm: 42, auto: false, mag: 5, reserve: 25, reload: 3.4, spread: 0.0006, unscoped: 0.09, moveSpread: 0.12, airSpread: 0.3, recoil: 0.06, head: 4, armorPen: 0.97, speed: 4.4, sound: 'sniper', scope: true, bolt: 1.35, range: 400 },
  mp5: { id: 'mp5', name: 'MP5', slot: 1, dmg: 26, rpm: 800, auto: true, mag: 30, reserve: 120, reload: 2.0, spread: 0.006, moveSpread: 0.03, airSpread: 0.1, recoil: 0.009, head: 4, armorPen: 0.6, speed: 5.4, sound: 'smg', range: 120 },
  glock: { id: 'glock', name: 'Glock-18', slot: 2, dmg: 28, rpm: 400, auto: false, mag: 20, reserve: 60, reload: 2.0, spread: 0.006, moveSpread: 0.03, airSpread: 0.1, recoil: 0.018, head: 4, armorPen: 0.47, speed: 5.5, sound: 'pistol', range: 100 },
  deagle: { id: 'deagle', name: 'Desert Eagle', slot: 2, dmg: 62, rpm: 230, auto: false, mag: 7, reserve: 35, reload: 2.2, spread: 0.004, moveSpread: 0.06, airSpread: 0.2, recoil: 0.05, head: 4, armorPen: 0.93, speed: 5.4, sound: 'deagle', range: 150 },
  knife: { id: 'knife', name: 'Bıçak', slot: 3, dmg: 55, rpm: 110, auto: true, melee: true, mag: 0, reserve: 0, reload: 0, spread: 0, moveSpread: 0, recoil: 0, head: 1, armorPen: 0.85, speed: 6.0, sound: 'knife', range: 2.2 },
  he: { id: 'he', name: 'HE Bombası', slot: 4, nade: true, dmg: 100, rpm: 60, auto: false, mag: 0, reserve: 0, reload: 0, spread: 0, moveSpread: 0, airSpread: 0, recoil: 0, head: 1, armorPen: 0.57, speed: 5.6, sound: 'knife', range: 0 },
  flash: { id: 'flash', name: 'Flaş Bombası', slot: 4, nade: true, dmg: 0, rpm: 60, auto: false, mag: 0, reserve: 0, reload: 0, spread: 0, moveSpread: 0, airSpread: 0, recoil: 0, head: 1, armorPen: 1, speed: 5.6, sound: 'knife', range: 0 },
  smoke: { id: 'smoke', name: 'Sis Bombası', slot: 4, nade: true, dmg: 0, rpm: 60, auto: false, mag: 0, reserve: 0, reload: 0, spread: 0, moveSpread: 0, airSpread: 0, recoil: 0, head: 1, armorPen: 1, speed: 5.6, sound: 'knife', range: 0 },
};

export const PRIMARIES = ['ak', 'm4', 'awm', 'mp5'];
export const SECONDARIES = ['glock', 'deagle'];
export const NADES = ['he', 'flash', 'smoke'];
export const NADE_MAX = { he: 1, flash: 2, smoke: 1 };

export const PRICES = {
  glock: 200, deagle: 700, mp5: 1500, ak: 2700, m4: 3100, awm: 4750,
  kevlar: 650, helmet: 1000, he: 300, flash: 200, smoke: 300, kit: 400,
};
export const KILL_REWARD = { knife: 1500, mp5: 600, awm: 100, he: 300 };
export function killReward(id) { return KILL_REWARD[id] ?? 300; }

// ---------- shared materials ----------
let M = null;
export function gunMats(tex) {
  if (M) return M;
  M = {
    metal: new THREE.MeshStandardMaterial({ color: 0x3c3e42, metalness: 0.8, roughness: 0.42 }),
    poly: new THREE.MeshStandardMaterial({ color: 0x26282b, metalness: 0.1, roughness: 0.7 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xd08848, roughness: 0.5, map: tex.wood }),
    bakelite: new THREE.MeshStandardMaterial({ color: 0x6b2a12, roughness: 0.45, metalness: 0.1 }),
    olive: new THREE.MeshStandardMaterial({ color: 0x4c5634, roughness: 0.7, metalness: 0.15 }),
    tan: new THREE.MeshStandardMaterial({ color: 0xa08a62, roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xcfd3d6, metalness: 1.0, roughness: 0.2 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 1.0, roughness: 0.28 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0a1a2a, metalness: 0.9, roughness: 0.05, emissive: 0x05243a, emissiveIntensity: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 2 }),
  };
  return M;
}

const rbCache = new Map();
function roundedBox(w, h, d) {
  const key = `${w}_${h}_${d}`;
  if (!rbCache.has(key)) {
    const r = Math.min(0.009, Math.min(w, h, d) * 0.3);
    rbCache.set(key, r > 0.0015 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d));
  }
  return rbCache.get(key);
}
function bx(g, w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(roundedBox(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m); return m;
}
let skinCtx = null; // { skin, base } while building a skinned gun
function cyl(g, r1, r2, len, x, y, z, mat, axis = 'z', seg = 14) {
  if (skinCtx && mat === skinCtx.skin) mat = skinCtx.base.metal; // barrels, scopes stay gunmetal
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, seg), mat);
  m.position.set(x, y, z);
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  m.castShadow = true;
  g.add(m); return m;
}

let nadeMats = null;
export function buildNadeModel(g, id, m) {
  if (!nadeMats) {
    nadeMats = {
      he: new THREE.MeshStandardMaterial({ color: 0x4a5a2e, roughness: 0.6, metalness: 0.2 }),
      flash: new THREE.MeshStandardMaterial({ color: 0x8c9196, roughness: 0.4, metalness: 0.6 }),
      smoke: new THREE.MeshStandardMaterial({ color: 0x5d6368, roughness: 0.5, metalness: 0.4 }),
      band: new THREE.MeshStandardMaterial({ color: 0x3fae4a, roughness: 0.5 }),
      bandF: new THREE.MeshStandardMaterial({ color: 0xe8d23a, roughness: 0.5 }),
    };
  }
  if (id === 'he') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 10), nadeMats.he);
    b.scale.y = 1.2; b.castShadow = true; g.add(b);
  } else {
    cyl(g, 0.03, 0.03, 0.1, 0, 0, 0, nadeMats[id], 'y');
    cyl(g, 0.0305, 0.0305, 0.015, 0, 0.02, 0, id === 'smoke' ? nadeMats.band : nadeMats.bandF, 'y');
  }
  cyl(g, 0.014, 0.016, 0.03, 0, 0.06, 0, m.metal, 'y');
  bx(g, 0.012, 0.075, 0.008, 0.018, 0.035, 0, m.metal, 0, 0, -0.15);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.002, 6, 12), m.steel);
  ring.position.set(-0.02, 0.07, 0); g.add(ring);
}

// gun built pointing -Z, origin roughly at the pistol grip/trigger
export function buildGun(id, tex, skinId = null) {
  const base = gunMats(tex);
  const sm = skinMaterial(skinId);
  const m = sm ? { ...base, metal: sm, poly: sm, wood: sm, bakelite: sm, olive: sm, chrome: sm, steel: sm, tan: sm } : base;
  skinCtx = sm && id !== 'knife' ? { skin: sm, base } : null;
  const g = new THREE.Group();
  const muzzle = new THREE.Object3D();
  let leftHand = new THREE.Vector3(0, -0.02, -0.3);
  switch (id) {
    case 'ak': {
      bx(g, 0.055, 0.075, 0.32, 0, 0.02, -0.06, m.metal);
      bx(g, 0.05, 0.03, 0.29, 0, 0.07, -0.05, m.metal);
      cyl(g, 0.011, 0.011, 0.44, 0, 0.035, -0.44, m.metal);
      cyl(g, 0.013, 0.013, 0.24, 0, 0.068, -0.33, m.metal);
      bx(g, 0.066, 0.058, 0.2, 0, 0.03, -0.31, m.wood);
      bx(g, 0.05, 0.035, 0.15, 0, 0.072, -0.32, m.wood);
      bx(g, 0.012, 0.05, 0.012, 0, 0.075, -0.6, m.metal);
      bx(g, 0.03, 0.02, 0.03, 0, 0.09, -0.1, m.metal);
      cyl(g, 0.017, 0.017, 0.06, 0, 0.035, -0.68, m.metal);
      [[-0.075, 0.12, -0.13], [-0.15, 0.34, -0.16], [-0.22, 0.56, -0.2]].forEach(([y, r, z]) => bx(g, 0.034, 0.09, 0.075, 0, y, z, m.bakelite, r));
      bx(g, 0.038, 0.11, 0.05, 0, -0.06, 0.07, m.wood, 0.35);
      bx(g, 0.05, 0.075, 0.27, 0, -0.005, 0.24, m.wood, -0.1);
      bx(g, 0.052, 0.11, 0.025, 0, -0.03, 0.37, m.poly, -0.1);
      bx(g, 0.008, 0.01, 0.07, 0, -0.035, 0.0, m.metal);
      muzzle.position.set(0, 0.035, -0.72);
      leftHand.set(0, 0.0, -0.32);
      break;
    }
    case 'm4': {
      bx(g, 0.055, 0.07, 0.28, 0, 0.025, -0.06, m.poly);
      bx(g, 0.03, 0.02, 0.42, 0, 0.07, -0.18, m.metal); // rail
      bx(g, 0.07, 0.07, 0.27, 0, 0.03, -0.33, m.poly);  // handguard
      for (let i = 0; i < 6; i++) bx(g, 0.074, 0.008, 0.02, 0, 0.03, -0.22 - i * 0.04, m.metal);
      cyl(g, 0.01, 0.01, 0.3, 0, 0.03, -0.58, m.metal);
      cyl(g, 0.016, 0.014, 0.06, 0, 0.03, -0.74, m.metal);
      // red dot
      bx(g, 0.035, 0.03, 0.06, 0, 0.095, -0.06, m.metal);
      cyl(g, 0.022, 0.022, 0.07, 0, 0.125, -0.06, m.metal);
      cyl(g, 0.017, 0.017, 0.072, 0, 0.125, -0.06, m.glass);
      bx(g, 0.004, 0.004, 0.004, 0, 0.125, -0.025, m.red);
      bx(g, 0.032, 0.17, 0.07, 0, -0.09, -0.14, m.metal, 0.12);
      bx(g, 0.036, 0.1, 0.045, 0, -0.06, 0.06, m.poly, 0.35);
      cyl(g, 0.015, 0.015, 0.2, 0, 0.02, 0.15, m.metal);
      bx(g, 0.045, 0.085, 0.16, 0, 0.0, 0.23, m.poly);
      bx(g, 0.048, 0.12, 0.025, 0, -0.01, 0.32, m.poly);
      muzzle.position.set(0, 0.03, -0.78);
      leftHand.set(0, -0.01, -0.34);
      break;
    }
    case 'awm': {
      bx(g, 0.07, 0.085, 0.45, 0, 0.0, -0.1, m.olive);
      bx(g, 0.05, 0.05, 0.22, 0, 0.055, -0.08, m.metal);
      cyl(g, 0.014, 0.012, 0.62, 0, 0.04, -0.62, m.metal);
      cyl(g, 0.02, 0.02, 0.07, 0, 0.04, -0.95, m.metal);
      // scope
      cyl(g, 0.024, 0.024, 0.28, 0, 0.13, -0.1, m.metal);
      cyl(g, 0.034, 0.026, 0.08, 0, 0.13, -0.28, m.metal);
      cyl(g, 0.03, 0.025, 0.06, 0, 0.13, 0.07, m.metal);
      cyl(g, 0.03, 0.03, 0.005, 0, 0.13, -0.32, m.glass);
      cyl(g, 0.016, 0.016, 0.03, 0, 0.165, -0.1, m.metal, 'y');
      cyl(g, 0.016, 0.016, 0.03, 0.03, 0.13, -0.1, m.metal, 'x');
      bx(g, 0.03, 0.04, 0.03, 0, 0.09, -0.18, m.metal);
      bx(g, 0.03, 0.04, 0.03, 0, 0.09, 0.0, m.metal);
      // bolt
      cyl(g, 0.006, 0.006, 0.07, 0.05, 0.055, 0.02, m.metal, 'x');
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), m.metal); ball.position.set(0.085, 0.055, 0.02); g.add(ball);
      bx(g, 0.04, 0.12, 0.08, 0, -0.08, -0.12, m.metal, 0.05);
      bx(g, 0.04, 0.11, 0.05, 0, -0.07, 0.07, m.olive, 0.3);
      bx(g, 0.06, 0.1, 0.3, 0, -0.02, 0.27, m.olive);
      bx(g, 0.06, 0.04, 0.12, 0, 0.055, 0.28, m.olive);
      bx(g, 0.065, 0.15, 0.03, 0, -0.01, 0.43, m.poly);
      bx(g, 0.018, 0.02, 0.2, 0.0, -0.05, -0.42, m.metal);
      muzzle.position.set(0, 0.04, -0.99);
      leftHand.set(0, -0.02, -0.36);
      break;
    }
    case 'mp5': {
      cyl(g, 0.03, 0.03, 0.3, 0, 0.04, -0.12, m.poly);
      bx(g, 0.05, 0.06, 0.2, 0, 0.0, -0.06, m.poly);
      bx(g, 0.06, 0.065, 0.16, 0, 0.02, -0.32, m.poly);
      cyl(g, 0.011, 0.011, 0.1, 0, 0.04, -0.45, m.metal);
      bx(g, 0.012, 0.04, 0.012, 0, 0.085, -0.27, m.metal);
      bx(g, 0.03, 0.03, 0.02, 0, 0.08, 0.02, m.metal);
      [[-0.07, 0.15, -0.17], [-0.15, 0.3, -0.19]].forEach(([y, r, z]) => bx(g, 0.026, 0.1, 0.045, 0, y, z, m.metal, r));
      bx(g, 0.036, 0.1, 0.045, 0, -0.07, 0.04, m.poly, 0.3);
      bx(g, 0.012, 0.012, 0.24, 0.022, 0.03, 0.16, m.metal);
      bx(g, 0.012, 0.012, 0.24, -0.022, 0.03, 0.16, m.metal);
      bx(g, 0.05, 0.08, 0.02, 0, 0.0, 0.28, m.metal);
      muzzle.position.set(0, 0.04, -0.5);
      leftHand.set(0, -0.01, -0.3);
      break;
    }
    case 'glock': {
      bx(g, 0.03, 0.035, 0.19, 0, 0.04, -0.07, m.poly);
      bx(g, 0.028, 0.025, 0.16, 0, 0.012, -0.06, m.poly);
      bx(g, 0.03, 0.11, 0.05, 0, -0.04, 0.0, m.poly, 0.3);
      bx(g, 0.005, 0.01, 0.005, 0, 0.062, -0.155, m.metal);
      muzzle.position.set(0, 0.04, -0.17);
      leftHand.set(0.0, -0.06, 0.02);
      break;
    }
    case 'deagle': {
      bx(g, 0.038, 0.045, 0.27, 0, 0.045, -0.09, m.chrome);
      bx(g, 0.03, 0.03, 0.22, 0, 0.012, -0.08, m.chrome);
      bx(g, 0.012, 0.012, 0.25, 0, 0.073, -0.09, m.chrome);
      bx(g, 0.034, 0.12, 0.055, 0, -0.045, 0.0, m.poly, 0.28);
      muzzle.position.set(0, 0.045, -0.23);
      leftHand.set(0.0, -0.06, 0.02);
      break;
    }
    case 'knife': {
      cyl(g, 0.016, 0.018, 0.12, 0, 0, 0.0, m.poly);
      bx(g, 0.05, 0.012, 0.012, 0, 0, -0.065, m.steel);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(0.2, 0.005); shape.quadraticCurveTo(0.25, 0.02, 0.27, 0.0);
      shape.lineTo(0.2, -0.03); shape.lineTo(0, -0.032); shape.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3.5, uv.getY(i) * 3.5);
      const blade = new THREE.Mesh(geo, m.steel);
      blade.rotation.y = Math.PI / 2; blade.position.set(0, 0.016, -0.07);
      g.add(blade);
      muzzle.position.set(0, 0, -0.3);
      leftHand = null;
      break;
    }
    case 'he':
    case 'flash':
    case 'smoke': {
      buildNadeModel(g, id, m);
      muzzle.position.set(0, 0.05, -0.05);
      leftHand = null;
      break;
    }
  }
  skinCtx = null;
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  g.userData.leftHand = leftHand;
  return g;
}
