import * as THREE from 'three';
import { rng } from './textures.js';

// ---------- geometry builder with world-space UVs ----------
class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  quad(a, b, c, d, nx, ny, nz, uvs) {
    const base = this.p.length / 3;
    for (const v of [a, b, c, d]) this.p.push(v[0], v[1], v[2]);
    for (let k = 0; k < 4; k++) this.n.push(nx, ny, nz);
    for (const u of uvs) this.uv.push(u[0], u[1]);
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  // faces: object {px,nx,py,ny,pz,nz} booleans; faceUV -> 0..1 per face
  box(x0, y0, z0, x1, y1, z1, tile = 2, faces = null, faceUV = false) {
    const f = faces || { px: 1, nx: 1, py: 1, ny: 0, pz: 1, nz: 1 };
    const U = (a, b) => faceUV ? null : [a / tile, b / tile];
    const fu = (u0, v0, u1, v1, a0, b0, a1, b1) => faceUV
      ? [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
      : [U(a0, b0), U(a1, b0), U(a1, b1), U(a0, b1)];
    if (f.pz) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, fu(0, 0, 1, 1, x0, y0, x1, y1));
    if (f.nz) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, fu(0, 0, 1, 1, -x1, y0, -x0, y1));
    if (f.px) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, fu(0, 0, 1, 1, -z1, y0, -z0, y1));
    if (f.nx) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, fu(0, 0, 1, 1, z0, y0, z1, y1));
    if (f.py) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, fu(0, 0, 1, 1, x0, -z1, x1, -z0));
    if (f.ny) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0, fu(0, 0, 1, 1, x0, z0, x1, z1));
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
  get empty() { return this.p.length === 0; }
}

// ---------- ray helpers ----------
export function rayAABB(o, d, b, tMax) {
  let tmin = 0, tmax = tMax, axis = -1, sign = 0;
  for (let a = 0; a < 3; a++) {
    const oa = a === 0 ? o.x : a === 1 ? o.y : o.z;
    const da = a === 0 ? d.x : a === 1 ? d.y : d.z;
    const mn = b.min[a], mx = b.max[a];
    if (Math.abs(da) < 1e-9) { if (oa < mn || oa > mx) return -1; continue; }
    let t1 = (mn - oa) / da, t2 = (mx - oa) / da, s = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  rayAABB.axis = axis; rayAABB.sign = sign;
  return tmin;
}

export function rayVCyl(o, d, cx, cz, r, y0, y1, tMax) {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return -1;
  const b = 2 * (ox * d.x + oz * d.z);
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
    if (t < 0 || t > tMax) continue;
    const y = o.y + d.y * t;
    if (y >= y0 && y <= y1) return t;
  }
  return -1;
}

export function raySphere(o, d, cx, cy, cz, r, tMax) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  if (t < 0 || t > tMax) return -1;
  return t;
}

// ---------- world ----------
export class World {
  constructor(scene, def, tex) {
    this.scene = scene; this.def = def; this.tex = tex;
    this.cell = def.cell; this.w = def.w; this.h = def.h; this.grid = def.grid;
    this.colliders = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.r = rng(1234);
    this.mats = {};
    this.builders = {};
    this.crateCells = new Set();
    this.build();
  }

  mat(key, opts = {}) {
    if (!this.mats[key]) {
      const t = this.tex[key];
      this.mats[key] = new THREE.MeshStandardMaterial({
        map: t, bumpMap: t, bumpScale: opts.bump ?? 1.2, roughness: opts.rough ?? 0.92,
        metalness: opts.metal ?? 0.0, color: opts.color ?? 0xffffff,
      });
    }
    return this.mats[key];
  }
  B(key) { return this.builders[key] || (this.builders[key] = new GeoBuilder()); }

  isSolid(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return true;
    return this.grid[cz][cx] === '#';
  }
  cellType(cx, cz) { return this.isSolid(cx, cz) ? '#' : this.grid[cz][cx]; }
  hash(cx, cz, s = 0) {
    let h = (Math.imul(cx | 0, 374761393) + Math.imul(cz | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  wallH(cx, cz) {
    const d = this.def;
    const v = this.hash(Math.floor(cx / 2), Math.floor(cz / 2), 7);
    return d.wallMin + Math.round(v * (d.wallMax - d.wallMin) / 2) * 2;
  }
  addCollider(x0, y0, z0, x1, y1, z1, kind = 'wall') {
    const c = { min: [x0, y0, z0], max: [x1, y1, z1], kind };
    this.colliders.push(c);
    return c;
  }
  center(cx, cz) { return [(cx + 0.5) * this.cell, (cz + 0.5) * this.cell]; }
  toCell(x, z) { return [Math.floor(x / this.cell), Math.floor(z / this.cell)]; }

  build() {
    const d = this.def, C = this.cell;
    // crates set
    for (const [cx, cz] of d.crates) this.crateCells.add(cz * this.w + cx);

    // floors + ceilings
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) {
      if (this.isSolid(x, z)) continue;
      const t = this.grid[z][x];
      const key = d.floorMat[t] || 'sand';
      this.B(key).box(x * C, -0.3, z * C, (x + 1) * C, 0, (z + 1) * C, key === 'tiles' ? 3 : 4, { py: 1 });
      if (t === 't') {
        this.B('concreteDark').box(x * C, 4.2, z * C, (x + 1) * C, 4.7, (z + 1) * C, 4, { ny: 1 });
        this.B('wood').box(x * C, 3.95, z * C + C / 2 - 0.15, (x + 1) * C, 4.2, z * C + C / 2 + 0.15, 2);
        this.addCollider(x * C, 4.2, z * C, (x + 1) * C, 5, (z + 1) * C, 'ceil');
        if ((x + z) % 3 === 0) this.lamp((x + 0.5) * C, 3.9, (z + 0.5) * C);
      }
    }

    // walls
    const mats = d.wallMats;
    for (let z = -1; z <= this.h; z++) for (let x = -1; x <= this.w; x++) {
      if (!this.isSolid(x, z)) continue;
      let border = false;
      for (let dz = -1; dz <= 1 && !border; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!this.isSolid(x + dx, z + dz)) { border = true; break; }
      }
      if (!border) continue;
      const H = this.wallH(x, z);
      const key = mats[Math.floor(this.hash(Math.floor(x / 3), Math.floor(z / 3), 3) * mats.length)];
      const x0 = x * C, z0 = z * C, x1 = x0 + C, z1 = z0 + C;
      this.B(key).box(x0, 0, z0, x1, H, z1, 4);
      this.addCollider(x0, -1, z0, x1, H + 20, z1);
      // cornice + skirt
      const e = 0.14;
      this.B('concrete').box(x0 - e, H - 0.35, z0 - e, x1 + e, H, z1 + e, 2);
      this.B('concreteDark').box(x0 - 0.05, 0, z0 - 0.05, x1 + 0.05, 0.45, z1 + 0.05, 2, { px: 1, nx: 1, pz: 1, nz: 1, py: 1 });
      // details on faces toward floor
      const faces = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [fx, fz] of faces) {
        if (this.isSolid(x + fx, z + fz)) continue;
        const r = this.hash(x, z, fx * 3 + fz * 7 + 11);
        if (r < 0.22 && H >= 6) this.window(x0, z0, fx, fz, H);
        else if (r < 0.3) this.awning(x0, z0, fx, fz);
        else if (r < 0.36 && this.def.id === 'bazaar') this.lantern(x0, z0, fx, fz);
      }
      if (d.domes && this.hash(x, z, 99) < 0.12) {
        this.dome((x + 0.5) * C, H, (z + 0.5) * C, C * 0.42);
      }
    }

    // crates
    for (const [cx, cz, stack] of d.crates) {
      const [wx, wz] = this.center(cx, cz);
      const s = 1.05;
      this.crate(wx, 0, wz, s);
      if (stack === 2) this.crate(wx + 0.05, s, wz - 0.03, s * 0.98);
    }
    // arches/doors
    for (const a of d.arches) this.arch(...a);
    for (const [cx, cz] of d.palms) { const [wx, wz] = this.center(cx, cz); this.palm(wx + 1.0, wz + 1.0); }
    for (const [cx, cz] of d.barrels) {
      const [wx, wz] = this.center(cx, cz);
      const ox = (this.hash(cx, cz, 5) - 0.5) * C * 0.6, oz = (this.hash(cx, cz, 6) - 0.5) * C * 0.6;
      this.barrel(wx + ox, wz + oz);
    }
    if (d.banners) this.banners();
    this.siteLabels();

    // finalize merged meshes
    for (const key in this.builders) {
      const b = this.builders[key];
      if (b.empty) continue;
      const opts = key === 'metalBlue' || key === 'metalGreen' ? { metal: 0.35, rough: 0.6, bump: 0.6 }
        : key === 'crate' ? { bump: 2.0, rough: 0.85 } : key === 'tiles' ? { rough: 0.6, bump: 0.8 }
        : /plaster|saffron|pink|teal|cream/.test(key) ? { bump: 0.25 } : {};
      const m = new THREE.Mesh(b.build(), this.mat(key, opts));
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
    }
    this.buildNav();
  }

  crate(x, y, z, s) {
    const h = s / 2;
    this.B('crate').box(x - h, y, z - h, x + h, y + s, z + h, 1, { px: 1, nx: 1, py: 1, pz: 1, nz: 1 }, true);
    this.addCollider(x - h, y, z - h, x + h, y + s, z + h, 'crate');
  }

  window(x0, z0, fx, fz, H) {
    const C = this.cell;
    const y0 = H > 7 ? 3.8 : 3.2, y1 = y0 + 1.6;
    const along = fx !== 0 ? 'z' : 'x';
    const mid = along === 'x' ? x0 + C / 2 : z0 + C / 2;
    const fp = fx > 0 ? x0 + C : fx < 0 ? x0 : fz > 0 ? z0 + C : z0; // face plane
    const s = fx + fz; // outward sign
    const w = 0.9;
    const box = (a0, a1, b0, b1, yA, yB, key) => {
      if (along === 'x') this.B(key).box(a0, yA, Math.min(b0, b1), a1, yB, Math.max(b0, b1), 2);
      else this.B(key).box(Math.min(b0, b1), yA, a0, Math.max(b0, b1), yB, a1, 2);
    };
    // dark recess
    box(mid - w / 2, mid + w / 2, fp, fp + s * 0.02, y0, y1, 'concreteDark');
    // frame + shutters
    box(mid - w / 2 - 0.12, mid - w / 2, fp, fp + s * 0.1, y0 - 0.1, y1 + 0.1, 'wood');
    box(mid + w / 2, mid + w / 2 + 0.12, fp, fp + s * 0.1, y0 - 0.1, y1 + 0.1, 'wood');
    box(mid - w / 2 - 0.15, mid + w / 2 + 0.15, fp, fp + s * 0.18, y0 - 0.2, y0 - 0.06, 'concrete');
    box(mid - w / 2 - 0.12, mid + w / 2 + 0.12, fp, fp + s * 0.1, y1, y1 + 0.12, 'wood');
    // open shutter
    box(mid + w / 2 + 0.12, mid + w / 2 + 0.6, fp + s * 0.1, fp + s * 0.14, y0, y1, this.def.id === 'bazaar' ? 'metalBlue' : 'wood');
  }

  awning(x0, z0, fx, fz) {
    const C = this.cell;
    const keys = this.def.id === 'bazaar' ? ['clothA', 'clothB', 'clothC'] : ['clothC', 'clothB'];
    const key = keys[Math.floor(this.hash(x0, z0, 77) * keys.length)];
    const y = 3.0, depth = 1.3;
    const geo = new THREE.PlaneGeometry(C * 0.8, depth * 1.12);
    const mesh = new THREE.Mesh(geo, this.clothMat(key));
    const fpX = fx > 0 ? x0 + C : fx < 0 ? x0 : x0 + C / 2;
    const fpZ = fz > 0 ? z0 + C : fz < 0 ? z0 : z0 + C / 2;
    mesh.position.set(fpX + fx * depth / 2, y, fpZ + fz * depth / 2);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = Math.atan2(fx, fz);
    mesh.rotation.x = -Math.PI / 2 + 0.45;
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);
    // poles
    for (const s of [-1, 1]) {
      const px = fpX + fx * depth + (fz !== 0 ? s * C * 0.38 : 0);
      const pz = fpZ + fz * depth + (fx !== 0 ? s * C * 0.38 : 0);
      this.B('wood').box(px - 0.04, 0, pz - 0.04, px + 0.04, y - 0.25, pz + 0.04, 1);
    }
  }

  clothMat(key) {
    const k = 'cloth_' + key;
    if (!this.mats[k]) this.mats[k] = new THREE.MeshStandardMaterial({ map: this.tex[key], side: THREE.DoubleSide, roughness: 0.95 });
    return this.mats[k];
  }

  lantern(x0, z0, fx, fz) {
    const C = this.cell;
    const fpX = fx > 0 ? x0 + C : fx < 0 ? x0 : x0 + C / 2;
    const fpZ = fz > 0 ? z0 + C : fz < 0 ? z0 : z0 + C / 2;
    const px = fpX + fx * 0.5, pz = fpZ + fz * 0.5;
    this.B('metalGreen').box(Math.min(fpX, px) - 0.03, 3.6, Math.min(fpZ, pz) - 0.03, Math.max(fpX, px) + 0.03, 3.66, Math.max(fpZ, pz) + 0.03, 1);
    if (!this.lanternMat) this.lanternMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a1c, emissiveIntensity: 2.2 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.32, 8), this.lanternMat);
    m.position.set(px, 3.35, pz);
    this.group.add(m);
  }

  lamp(x, y, z) {
    if (!this.lampMat) this.lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd27a, emissiveIntensity: 3 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), this.lampMat);
    m.position.set(x, y - 0.1, z);
    this.group.add(m);
  }

  dome(x, y, z, r) {
    if (!this.domeMat) this.domeMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.7, map: this.tex.cream });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r, 0.8, 20), this.mat('concrete'));
    base.position.set(x, y + 0.4, z);
    const dm = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), this.domeMat);
    dm.position.set(x, y + 0.8, z); dm.scale.y = 1.25;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.9, roughness: 0.3 }));
    spire.position.set(x, y + 0.8 + r * 1.25 + 0.4, z);
    for (const m of [base, dm, spire]) { m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
  }

  arch(cx0, cz0, cx1, cz1, axis, doorKey) {
    const C = this.cell;
    const x0 = cx0 * C, x1 = (cx1 + 1) * C, z0 = cz0 * C, z1 = (cz1 + 1) * C;
    const top = Math.max(this.wallH(cx0 - 1, cz0), this.wallH(cx1 + 1, cz1), 6);
    const ly = 3.6;
    const th = 0.6; // lintel thickness along travel
    if (axis === 'z') {
      const zm = (z0 + z1) / 2;
      this.B('sandstone2').box(x0, ly, zm - th, x1, top, zm + th, 4);
      this.B('wood').box(x0, ly - 0.2, zm - th - 0.05, x1, ly, zm + th + 0.05, 2);
      this.addCollider(x0, ly, zm - th, x1, top + 20, zm + th);
      // pillars narrowing the gap
      const pw = (x1 - x0) * 0.18;
      this.B('sandstone2').box(x0, 0, zm - th, x0 + pw, ly, zm + th, 4);
      this.B('sandstone2').box(x1 - pw, 0, zm - th, x1, ly, zm + th, 4);
      this.addCollider(x0, 0, zm - th, x0 + pw, ly, zm + th);
      this.addCollider(x1 - pw, 0, zm - th, x1, ly, zm + th);
      // opened door leaves
      const lw = (x1 - x0 - 2 * pw) / 2;
      this.B(doorKey).box(x0 + pw, 0.02, zm + th, x0 + pw + 0.08, ly - 0.25, zm + th + lw * 0.9, 2);
      this.B(doorKey).box(x1 - pw - 0.08, 0.02, zm + th, x1 - pw, ly - 0.25, zm + th + lw * 0.9, 2);
      this.addCollider(x0 + pw, 0, zm + th, x0 + pw + 0.08, ly, zm + th + lw * 0.9, 'door');
      this.addCollider(x1 - pw - 0.08, 0, zm + th, x1 - pw, ly, zm + th + lw * 0.9, 'door');
    } else {
      const xm = (x0 + x1) / 2;
      this.B('sandstone2').box(xm - th, ly, z0, xm + th, top, z1, 4);
      this.B('wood').box(xm - th - 0.05, ly - 0.2, z0, xm + th + 0.05, ly, z1, 2);
      this.addCollider(xm - th, ly, z0, xm + th, top + 20, z1);
      const pw = (z1 - z0) * 0.18;
      this.B('sandstone2').box(xm - th, 0, z0, xm + th, ly, z0 + pw, 4);
      this.B('sandstone2').box(xm - th, 0, z1 - pw, xm + th, ly, z1, 4);
      this.addCollider(xm - th, 0, z0, xm + th, ly, z0 + pw);
      this.addCollider(xm - th, 0, z1 - pw, xm + th, ly, z1);
      const lw = (z1 - z0 - 2 * pw) / 2;
      this.B(doorKey).box(xm + th, 0.02, z0 + pw, xm + th + lw * 0.9, ly - 0.25, z0 + pw + 0.08, 2);
      this.B(doorKey).box(xm + th, 0.02, z1 - pw - 0.08, xm + th + lw * 0.9, ly - 0.25, z1 - pw, 2);
      this.addCollider(xm + th, 0, z0 + pw, xm + th + lw * 0.9, ly, z0 + pw + 0.08, 'door');
      this.addCollider(xm + th, 0, z1 - pw - 0.08, xm + th + lw * 0.9, ly, z1 - pw, 'door');
    }
  }

  palm(x, z) {
    const g = new THREE.Group();
    const h = 6 + this.r() * 3;
    if (!this.trunkMat) {
      this.trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1, map: this.tex.wood });
      this.leafMat = new THREE.MeshStandardMaterial({ map: this.tex.palm, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
    }
    const segs = 6;
    let px = 0, pz = 0, lean = (this.r() - 0.5) * 0.25;
    for (let i = 0; i < segs; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.17 - i * 0.012, 0.2 - i * 0.012, h / segs + 0.05, 9), this.trunkMat);
      seg.position.set(px, (i + 0.5) * h / segs, pz);
      px += lean * 0.25; pz += lean * 0.15;
      seg.rotation.z = -lean * 0.3;
      seg.castShadow = true; g.add(seg);
    }
    const n = 9;
    for (let i = 0; i < n; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.6, 1, 4), this.leafMat);
      // droop
      const pos = leaf.geometry.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const y = pos.getY(v) + 1.8; pos.setZ(v, -0.12 * y * y);
      }
      leaf.geometry.computeVertexNormals();
      leaf.geometry.translate(0, 1.8, 0);
      const holder = new THREE.Group();
      holder.position.set(px, h, pz);
      holder.rotation.y = (i / n) * Math.PI * 2 + this.r() * 0.3;
      leaf.rotation.x = -1.0 - this.r() * 0.4;
      holder.add(leaf);
      leaf.castShadow = true;
      g.add(holder);
    }
    g.position.set(x, 0, z);
    this.group.add(g);
    this.addCollider(x - 0.2, 0, z - 0.2, x + 0.2, h, z + 0.2, 'prop');
  }

  barrel(x, z) {
    if (!this.barrelMats) {
      this.barrelMats = [this.tex.metalBlue, this.tex.metalGreen].map(t => new THREE.MeshStandardMaterial({ map: t, metalness: 0.4, roughness: 0.55 }));
    }
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.25, 18), this.barrelMats[this.r() < 0.5 ? 0 : 1]);
    m.position.set(x, 0.625, z);
    m.castShadow = true; m.receiveShadow = true;
    this.group.add(m);
    for (const y of [0.25, 1.0]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.025, 6, 20), this.barrelMats[0]);
      ring.rotation.x = Math.PI / 2; ring.position.set(x, y, z); this.group.add(ring);
    }
    this.addCollider(x - 0.4, 0, z - 0.4, x + 0.4, 1.25, z + 0.4, 'prop');
  }

  banners() {
    const C = this.cell;
    const keys = ['clothA', 'clothB', 'clothC'];
    // strings of flags across top and bottom lanes
    for (const zc of [1, 10, 5]) {
      for (let x = 5; x < 19; x += 3) {
        const z0 = zc * C, z1 = (zc + (zc === 5 ? 3 : 2)) * C;
        const geo = new THREE.PlaneGeometry(1.0, z1 - z0, 1, 8);
        const pos = geo.attributes.position;
        for (let v = 0; v < pos.count; v++) { const y = pos.getY(v) / (z1 - z0); pos.setZ(v, -(0.25 - y * y) * 2.4); }
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, this.clothMat(keys[x % 3]));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x * C + 1.5, 6.2, (z0 + z1) / 2);
        m.castShadow = true;
        this.group.add(m);
      }
    }
  }

  siteLabels() {
    for (const k in this.def.labels) {
      const [cx, cz] = this.def.labels[k];
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const x = c.getContext('2d');
      x.font = 'bold 200px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(200,40,30,0.85)'; x.fillText(k, 128, 140);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx * this.cell, 0.02, cz * this.cell);
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  // ---------- navigation ----------
  buildNav() {
    this.walk = new Uint8Array(this.w * this.h);
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) {
      this.walk[z * this.w + x] = (!this.isSolid(x, z) && !this.crateCells.has(z * this.w + x)) ? 1 : 0;
    }
  }
  walkable(x, z) { return x >= 0 && z >= 0 && x < this.w && z < this.h && this.walk[z * this.w + x] === 1; }

  findPath(sx, sz, gx, gz) {
    if (!this.walkable(gx, gz)) return null;
    if (!this.walkable(sx, sz)) {
      // find nearest walkable
      let best = null, bd = 1e9;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (this.walkable(sx + dx, sz + dz)) {
        const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [sx + dx, sz + dz]; }
      }
      if (!best) return null;[sx, sz] = best;
    }
    const W = this.w, N = W * this.h;
    const g = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const open = [];
    const s = sz * W + sx, goal = gz * W + gx;
    g[s] = 0; open.push([this.heur(sx, sz, gx, gz), s]);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open[bi]; open.splice(bi, 1);
      if (cur === goal) break;
      if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!this.walkable(nx, nz)) continue;
        if (dx && dz && (!this.walkable(cx + dx, cz) || !this.walkable(cx, cz + dz))) continue;
        const ni = nz * W + nx;
        const ng = g[cur] + (dx && dz ? 1.414 : 1);
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; open.push([ng + this.heur(nx, nz, gx, gz), ni]); }
      }
    }
    if (came[goal] === -1 && goal !== s) return null;
    const path = [];
    let c = goal;
    while (c !== -1 && c !== s) { path.push([c % W, (c / W) | 0]); c = came[c]; }
    path.reverse();
    return path;
  }
  heur(ax, az, bx, bz) { const dx = Math.abs(ax - bx), dz = Math.abs(az - bz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); }

  cellsOfType(types) {
    const out = [];
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) {
      if (types.includes(this.grid[z][x]) && this.walkable(x, z)) out.push([x, z]);
    }
    return out;
  }
  walkableCells() {
    const out = [];
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) if (this.walkable(x, z)) out.push([x, z]);
    return out;
  }

  // ---------- physics ----------
  overlaps(x0, y0, z0, x1, y1, z1) {
    for (const c of this.colliders) {
      if (x1 > c.min[0] && x0 < c.max[0] && y1 > c.min[1] && y0 < c.max[1] && z1 > c.min[2] && z0 < c.max[2]) return c;
    }
    return null;
  }

  // moves entity {pos:Vector3, vel, onGround}, half width r, height H
  move(ent, dx, dy, dz, r, H) {
    const p = ent.pos;
    // X
    if (dx) {
      p.x += dx;
      const c = this.overlaps(p.x - r, p.y + 0.01, p.z - r, p.x + r, p.y + H, p.z + r);
      if (c) {
        // step up for low obstacles
        const step = c.max[1] - p.y;
        if (step > 0 && step < 0.45 && ent.onGround && !this.overlaps(p.x - r, c.max[1] + 0.01, p.z - r, p.x + r, c.max[1] + H, p.z + r)) p.y = c.max[1];
        else { p.x = dx > 0 ? c.min[0] - r - 0.001 : c.max[0] + r + 0.001; ent.hitWall = true; }
      }
    }
    if (dz) {
      p.z += dz;
      const c = this.overlaps(p.x - r, p.y + 0.01, p.z - r, p.x + r, p.y + H, p.z + r);
      if (c) {
        const step = c.max[1] - p.y;
        if (step > 0 && step < 0.45 && ent.onGround && !this.overlaps(p.x - r, c.max[1] + 0.01, p.z - r, p.x + r, c.max[1] + H, p.z + r)) p.y = c.max[1];
        else { p.z = dz > 0 ? c.min[2] - r - 0.001 : c.max[2] + r + 0.001; ent.hitWall = true; }
      }
    }
    ent.onGround = false;
    p.y += dy;
    const c = this.overlaps(p.x - r, p.y, p.z - r, p.x + r, p.y + H, p.z + r);
    if (c) {
      if (dy <= 0) { p.y = c.max[1]; ent.onGround = true; ent.vel && (ent.vel.y = 0); }
      else { p.y = c.min[1] - H - 0.001; ent.vel && (ent.vel.y = 0); }
    }
    if (p.y <= 0) { p.y = 0; ent.onGround = true; if (ent.vel && ent.vel.y < 0) ent.vel.y = 0; }
    // ground probe (standing on crate)
    if (!ent.onGround && dy === 0) {
      if (this.overlaps(p.x - r, p.y - 0.05, p.z - r, p.x + r, p.y, p.z + r)) ent.onGround = true;
    }
  }

  raycast(o, d, maxDist) {
    let best = maxDist, hit = null, ax = -1, sg = 0;
    for (const c of this.colliders) {
      const t = rayAABB(o, d, c, best);
      if (t >= 0 && t < best) { best = t; hit = c; ax = rayAABB.axis; sg = rayAABB.sign; }
    }
    // floor
    if (d.y < 0) {
      const t = -o.y / d.y;
      if (t >= 0 && t < best) { best = t; hit = { kind: 'floor' }; ax = 1; sg = 1; }
    }
    if (!hit) return null;
    const n = new THREE.Vector3();
    if (ax >= 0) n.setComponent(ax, sg === 0 ? 1 : sg);
    else n.set(0, 1, 0);
    return { t: best, collider: hit, normal: n };
  }

  lineClear(a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length(); d.divideScalar(len);
    for (const c of this.colliders) {
      if (c.kind === 'prop') continue;
      const t = rayAABB(a, d, c, len);
      if (t >= 0 && t < len - 0.05) return false;
    }
    return true;
  }
}
