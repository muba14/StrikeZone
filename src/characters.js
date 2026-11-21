import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildGun } from './weapons.js';

const geo = {};
function G(key, fn) { return geo[key] || (geo[key] = fn()); }
const RB = (w, h, d, r = 0.02) => G(`rb${w}_${h}_${d}_${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
const CAP = (r, l) => G(`cap${r}_${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 12));

const palettes = {
  T: { shirt: 0x6e5b3c, pants: 0x5a4d38, vest: 0x3d3a2a, strap: 0x2c2a20, head: 0x24221f, skin: 0xc4926f, glove: 0x1c1a18, boot: 0x3a2c20, accent: 0x7a2e22, scarf: 0x8a7a5a },
  CT: { shirt: 0x3b4a5c, pants: 0x2e3946, vest: 0x1f2832, strap: 0x151b22, head: 0x2b3542, skin: 0xd2a183, glove: 0x161616, boot: 0x1c1c1c, accent: 0x2f6fae, scarf: 0x22303d },
};
const matCache = {};
function mat(color, rough = 0.85, metal = 0) {
  const k = color + '_' + rough + '_' + metal;
  return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
}

function mesh(g, m, parent, x, y, z, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
  o.castShadow = true; o.receiveShadow = true;
  parent.add(o); return o;
}

export function createSoldier(team, weaponId, tex, skinId = null) {
  const p = palettes[team];
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);

  // ---- legs ----
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(s * 0.11, 0, 0); hips.add(thigh);
    const th = mesh(CAP(0.09, 0.28), mat(p.pants, 0.95), thigh, 0, -0.22, 0); th.scale.set(1, 1, 1.05);
    // cargo pocket
    mesh(RB(0.05, 0.12, 0.1, 0.012), mat(p.pants, 0.95), thigh, s * 0.085, -0.24, -0.01);
    if (s === 1) { // holster
      mesh(RB(0.06, 0.16, 0.09, 0.012), mat(p.strap, 0.7), thigh, 0.1, -0.18, 0.0);
      mesh(RB(0.035, 0.07, 0.05, 0.008), mat(0x1a1a1a, 0.5, 0.3), thigh, 0.1, -0.07, 0.0);
    }
    const knee = new THREE.Group(); knee.position.y = -0.44; thigh.add(knee);
    mesh(CAP(0.078, 0.28), mat(p.pants, 0.95), knee, 0, -0.2, 0);
    mesh(RB(0.11, 0.11, 0.06, 0.02), mat(p.strap, 0.8), knee, 0, -0.01, -0.075);
    // boot
    const boot = new THREE.Group(); boot.position.y = -0.42; knee.add(boot);
    mesh(RB(0.12, 0.13, 0.15, 0.03), mat(p.boot, 0.7), boot, 0, 0.0, 0.0);
    mesh(RB(0.12, 0.07, 0.29, 0.03), mat(p.boot, 0.7), boot, 0, -0.035, -0.05);
    mesh(RB(0.125, 0.025, 0.3, 0.01), mat(0x111111, 0.9), boot, 0, -0.07, -0.05);
    legs.push({ thigh, knee });
  }
  mesh(RB(0.38, 0.08, 0.25, 0.03), mat(p.strap, 0.75), hips, 0, 0.03, 0);
  mesh(RB(0.06, 0.05, 0.03, 0.01), mat(0x8a8a80, 0.4, 0.8), hips, 0, 0.03, -0.13);
  for (const x of [-0.14, 0.14]) mesh(RB(0.07, 0.09, 0.06, 0.015), mat(p.vest, 0.9), hips, x, 0.0, -0.12);

  // ---- torso ----
  const torso = new THREE.Group(); hips.add(torso);
  const tm = mesh(CAP(0.17, 0.26), mat(p.shirt, 0.95), torso, 0, 0.3, 0); tm.scale.set(1.28, 1, 0.82);
  // plate carrier
  mesh(RB(0.38, 0.36, 0.08, 0.025), mat(p.vest, 0.88), torso, 0, 0.33, -0.12);
  mesh(RB(0.38, 0.36, 0.08, 0.025), mat(p.vest, 0.88), torso, 0, 0.33, 0.12);
  mesh(RB(0.42, 0.12, 0.3, 0.03), mat(p.vest, 0.88), torso, 0, 0.18, 0);
  for (const x of [-0.13, 0.13]) mesh(RB(0.06, 0.04, 0.27, 0.015), mat(p.strap, 0.8), torso, x, 0.53, 0);
  // mag pouches
  for (const x of [-0.12, -0.04, 0.04, 0.12]) {
    mesh(RB(0.07, 0.11, 0.05, 0.012), mat(p.vest, 0.92), torso, x, 0.24, -0.175);
    mesh(RB(0.072, 0.025, 0.055, 0.008), mat(p.strap, 0.8), torso, x, 0.3, -0.176);
  }
  mesh(RB(0.07, 0.04, 0.012, 0.004), mat(p.accent, 0.5), torso, 0.1, 0.44, -0.165);
  // radio + antenna
  mesh(RB(0.07, 0.15, 0.05, 0.012), mat(0x1d1d1d, 0.6, 0.2), torso, -0.17, 0.36, 0.17);
  mesh(G('ant', () => new THREE.CylinderGeometry(0.005, 0.005, 0.35, 5)), mat(0x111111, 0.6), torso, -0.18, 0.58, 0.18);
  // backpack / hydration
  mesh(RB(0.28, 0.32, 0.1, 0.04), mat(p.strap, 0.9), torso, 0.02, 0.3, 0.2);
  // shoulder pads
  for (const s of [-1, 1]) mesh(RB(0.11, 0.06, 0.15, 0.03), mat(p.vest, 0.9), torso, s * 0.22, 0.52, 0, 0, 0, s * -0.4);
  // neck + scarf
  mesh(G('neck', () => new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10)), mat(p.skin), torso, 0, 0.6, 0);
  mesh(G('scarf', () => new THREE.TorusGeometry(0.075, 0.035, 8, 14)), mat(p.scarf, 0.98), torso, 0, 0.6, 0, Math.PI / 2, 0, 0);

  // ---- head ----
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head);
  const hd = mesh(G('head', () => new THREE.SphereGeometry(0.11, 20, 16)), mat(team === 'T' ? p.head : p.skin, 0.8), head, 0, 0, 0);
  hd.scale.set(0.95, 1.08, 1.02);
  if (team === 'T') {
    mesh(RB(0.15, 0.04, 0.04, 0.012), mat(p.skin), head, 0, 0.02, -0.088);
    for (const x of [-0.035, 0.035]) mesh(G('eye', () => new THREE.SphereGeometry(0.011, 8, 6)), mat(0x0d0d0d, 0.3), head, x, 0.022, -0.106);
    const cap = mesh(G('beanie', () => new THREE.SphereGeometry(0.118, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)), mat(0x4a4030, 0.98), head, 0, 0.025, 0);
    cap.scale.set(1, 0.85, 1);
    // shemagh around lower face
    mesh(G('shemagh', () => new THREE.TorusGeometry(0.09, 0.03, 8, 16)), mat(p.scarf, 0.98), head, 0, -0.05, -0.01, Math.PI / 2, 0, 0);
  } else {
    // face details
    for (const x of [-0.036, 0.036]) mesh(G('eye', () => new THREE.SphereGeometry(0.011, 8, 6)), mat(0x0d0d0d, 0.3), head, x, 0.02, -0.1);
    mesh(RB(0.025, 0.04, 0.03, 0.01), mat(p.skin), head, 0, -0.005, -0.108);
    // helmet
    const hel = mesh(G('helmet', () => new THREE.SphereGeometry(0.135, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)), mat(p.head, 0.6, 0.15), head, 0, 0.03, 0.005);
    hel.scale.set(1.02, 1, 1.06);
    mesh(RB(0.06, 0.04, 0.03, 0.008), mat(0x111111, 0.5, 0.4), head, 0, 0.11, -0.12); // NVG mount
    for (const s of [-1, 1]) {
      mesh(G('ear', () => new THREE.CylinderGeometry(0.045, 0.045, 0.04, 14)), mat(0x1a1a1a, 0.6), head, s * 0.115, 0.0, 0.0, 0, 0, Math.PI / 2);
      mesh(RB(0.02, 0.04, 0.12, 0.008), mat(0x222222, 0.7), head, s * 0.14, 0.07, 0.0);
    }
    const gog = mesh(RB(0.2, 0.055, 0.04, 0.015), mat(0x0a0a0a, 0.15, 0.7), head, 0, 0.075, -0.115);
    gog.rotation.x = -0.2;
    mesh(RB(0.15, 0.06, 0.035, 0.015), mat(0x2a2a2a, 0.9), head, 0, -0.06, -0.095); // face mask
  }

  // ---- arms (aim pose) ----
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.24, 0.5, 0); torso.add(sh);
    mesh(CAP(0.062, 0.2), mat(p.shirt, 0.95), sh, 0, -0.14, 0);
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    mesh(CAP(0.055, 0.2), mat(p.shirt, 0.95), el, 0, -0.12, 0);
    mesh(G('cuff', () => new THREE.CylinderGeometry(0.058, 0.058, 0.04, 10)), mat(p.strap), el, 0, -0.22, 0);
    mesh(RB(0.07, 0.09, 0.09, 0.025), mat(p.glove, 0.7), el, 0, -0.29, 0);
    arms.push({ sh, el, s });
  }
  arms[1].sh.rotation.set(1.05, 0, -0.15); arms[1].el.rotation.set(0.9, 0, 0);
  arms[0].sh.rotation.set(1.35, 0, 0.55); arms[0].el.rotation.set(0.35, 0, -0.1);

  const gunHolder = new THREE.Group();
  gunHolder.position.set(0.06, 0.36, -0.38);
  torso.add(gunHolder);
  let gun = null;
  const setWeapon = (id, skin = null) => {
    if (gun) gunHolder.remove(gun);
    gun = buildGun(id, tex, skin);
    gun.scale.setScalar(0.95);
    gunHolder.add(gun);
    root.userData.muzzle = gun.userData.muzzle;
  };
  setWeapon(weaponId, skinId);

  const anim = {
    phase: 0,
    update(dt, speed, aiming) {
      this.phase += dt * speed * 2.4;
      const a = Math.min(1, speed / 4);
      for (let i = 0; i < 2; i++) {
        const ph = this.phase + i * Math.PI;
        legs[i].thigh.rotation.x = Math.sin(ph) * 0.65 * a;
        legs[i].knee.rotation.x = -Math.max(0, Math.sin(ph + 1.4)) * 0.9 * a;
      }
      hips.position.y = 0.95 - Math.abs(Math.sin(this.phase)) * 0.035 * a;
      torso.rotation.y = Math.sin(this.phase) * 0.06 * a;
      torso.rotation.x = aiming ? -0.05 : -0.12 * a;
    },
  };

  root.userData = { ...root.userData, body, hips, torso, head, legs, arms, anim, setWeapon };
  return root;
}
