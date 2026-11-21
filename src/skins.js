import * as THREE from 'three';
import { rng } from './textures.js';

export const RARITY = {
  common: { name: 'Sıradan', color: '#9aa4b1', weight: 55, sell: 20 },
  uncommon: { name: 'Az Bulunur', color: '#4b8bff', weight: 25, sell: 45 },
  rare: { name: 'Nadir', color: '#a463ff', weight: 13, sell: 90 },
  epic: { name: 'Efsanevi', color: '#ff4fa3', weight: 6, sell: 200 },
  mythic: { name: 'Mitik', color: '#ffc933', weight: 1, sell: 600 },
};
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'mythic'];

export const SKINS = {
  ak_desert: { weapon: 'ak', name: 'Çöl Kamuflajı', rarity: 'common', pattern: 'camo', colors: ['#c2a274', '#8f7650', '#5e4c33', '#d8c29a'] },
  m4_sand: { weapon: 'm4', name: 'Kum Fırtınası', rarity: 'common', pattern: 'digital', colors: ['#cbb48a', '#a08a62', '#7a6648', '#e2d3b0'] },
  glock_earth: { weapon: 'glock', name: 'Toprak', rarity: 'common', pattern: 'camo', colors: ['#6b4f36', '#8d6d4a', '#3e2e20', '#a88a64'] },
  mp5_scorpion: { weapon: 'mp5', name: 'Akrep', rarity: 'uncommon', pattern: 'tiger', colors: ['#d8a43a', '#1a1208'] },
  deagle_redsand: { weapon: 'deagle', name: 'Kızıl Kum', rarity: 'uncommon', pattern: 'geo', colors: ['#a51d24', '#1a1a1a', '#e8d3b0'] },
  ak_tiger: { weapon: 'ak', name: 'Kaplan', rarity: 'rare', pattern: 'tiger', colors: ['#ff8a1e', '#140c06'] },
  awm_pharaoh: { weapon: 'awm', name: 'Altın Firavun', rarity: 'epic', pattern: 'gold', colors: ['#f6d36b', '#b8892c', '#2a6fb5'] },
  knife_damascus: { weapon: 'knife', name: 'Şam Çeliği', rarity: 'mythic', pattern: 'damascus', colors: ['#d9dde2', '#6b7178'] },

  glock_neon: { weapon: 'glock', name: 'Neon Dalga', rarity: 'common', pattern: 'neon', colors: ['#0c0f1a', '#19f0ff', '#ff2bd6'] },
  mp5_carbon: { weapon: 'mp5', name: 'Karbon', rarity: 'common', pattern: 'carbon', colors: ['#16181c', '#2b2f36'] },
  m4_glacier: { weapon: 'm4', name: 'Buzul', rarity: 'uncommon', pattern: 'ice', colors: ['#cfefff', '#5fb7e8', '#ffffff'] },
  awm_toxic: { weapon: 'awm', name: 'Zehir', rarity: 'uncommon', pattern: 'toxic', colors: ['#7dff2a', '#111111'] },
  deagle_galaxy: { weapon: 'deagle', name: 'Galaksi', rarity: 'rare', pattern: 'galaxy', colors: ['#0b0620', '#7b2cff', '#ff4fd8'] },
  ak_lava: { weapon: 'ak', name: 'Lav', rarity: 'epic', pattern: 'lava', colors: ['#120806', '#ff5a00', '#ffd000'] },
  m4_dragon: { weapon: 'm4', name: 'Neon Ejder', rarity: 'epic', pattern: 'dragon', colors: ['#0a0f12', '#00ffa2', '#00a3ff'] },
  knife_galaxy: { weapon: 'knife', name: 'Galaksi', rarity: 'mythic', pattern: 'galaxy', colors: ['#0b0620', '#2c6bff', '#ff4fd8'] },
};

export const CASES = {
  desert: { name: 'Çöl Operasyonu Kasası', price: 100, color: '#d9a25a', skins: ['ak_desert', 'm4_sand', 'glock_earth', 'mp5_scorpion', 'deagle_redsand', 'ak_tiger', 'awm_pharaoh', 'knife_damascus'] },
  neon: { name: 'Neon Gece Kasası', price: 100, color: '#19d3ff', skins: ['glock_neon', 'mp5_carbon', 'm4_glacier', 'awm_toxic', 'deagle_galaxy', 'ak_lava', 'm4_dragon', 'knife_galaxy'] },
};

export function rollCase(caseId) {
  const c = CASES[caseId];
  const total = c.skins.reduce((s, k) => s + RARITY[SKINS[k].rarity].weight, 0);
  let r = Math.random() * total;
  for (const k of c.skins) { r -= RARITY[SKINS[k].rarity].weight; if (r <= 0) return k; }
  return c.skins[0];
}

// ---------- inventory (localStorage) ----------
const KEY = 'sz_inventory_v1';
export const inv = { gold: 300, items: [], equipped: {}, nextId: 1 };
try { Object.assign(inv, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
export function saveInv() { try { localStorage.setItem(KEY, JSON.stringify(inv)); } catch (e) { /* ignore */ } }
export function addItem(skin) { const it = { uid: inv.nextId++, skin }; inv.items.push(it); saveInv(); return it; }
export function equippedSkin(weapon) {
  const uid = inv.equipped[weapon];
  if (!uid) return null;
  const it = inv.items.find(i => i.uid === uid);
  return it ? it.skin : null;
}
export function equip(uid) {
  const it = inv.items.find(i => i.uid === uid); if (!it) return;
  const w = SKINS[it.skin].weapon;
  if (inv.equipped[w] === uid) delete inv.equipped[w]; else inv.equipped[w] = uid;
  saveInv();
}
export function sell(uid) {
  const i = inv.items.findIndex(x => x.uid === uid); if (i < 0) return 0;
  const it = inv.items[i];
  const v = RARITY[SKINS[it.skin].rarity].sell;
  const w = SKINS[it.skin].weapon;
  if (inv.equipped[w] === uid) delete inv.equipped[w];
  inv.items.splice(i, 1); inv.gold += v; saveInv();
  return v;
}

// ---------- pattern textures ----------
const S = 512;
function cv() { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; }
function blobs(x, r, cols, n, min, max) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = cols[(r() * cols.length) | 0];
    const cx = r() * S, cy = r() * S, rad = min + r() * (max - min);
    for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
      x.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * Math.PI * 2, rr = rad * (0.6 + r() * 0.6);
        const px = cx + ox + Math.cos(a) * rr, py = cy + oy + Math.sin(a) * rr * 0.7;
        k ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath(); x.fill();
    }
  }
}
function grain(x, r, amt) {
  const im = x.getImageData(0, 0, S, S), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(im, 0, 0);
}
function wear(x, r) {
  x.fillStyle = 'rgba(200,200,200,0.25)';
  for (let i = 0; i < 160; i++) { x.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 2); }
}

function drawPattern(def, seed) {
  const [c, x] = cv(); const r = rng(seed);
  const C = def.colors;
  let emis = null;
  const glow = () => { if (!emis) { emis = cv(); emis[1].fillStyle = '#000'; emis[1].fillRect(0, 0, S, S); } return emis[1]; };
  switch (def.pattern) {
    case 'camo':
      x.fillStyle = C[0]; x.fillRect(0, 0, S, S);
      blobs(x, r, C.slice(1), 40, 30, 80); blobs(x, r, [C[2], C[3]], 30, 15, 40);
      grain(x, r, 18); wear(x, r); break;
    case 'digital': {
      x.fillStyle = C[0]; x.fillRect(0, 0, S, S);
      const p = 16;
      for (let i = 0; i < 1200; i++) {
        x.fillStyle = C[1 + ((r() * (C.length - 1)) | 0)];
        const gx = ((r() * S / p) | 0) * p, gy = ((r() * S / p) | 0) * p;
        x.fillRect(gx, gy, p * (1 + (r() * 3 | 0)), p * (1 + (r() * 2 | 0)));
      }
      grain(x, r, 14); break;
    }
    case 'tiger':
      x.fillStyle = C[0]; x.fillRect(0, 0, S, S);
      x.fillStyle = C[1];
      for (let i = 0; i < 26; i++) {
        const y0 = r() * S, th = 6 + r() * 14;
        x.beginPath(); x.moveTo(-10, y0);
        for (let xx = 0; xx <= S + 20; xx += 32) x.lineTo(xx, y0 + Math.sin(xx * 0.02 + i) * 22 + (r() - 0.5) * 10);
        for (let xx = S + 20; xx >= -10; xx -= 32) x.lineTo(xx, y0 + th * (0.3 + r()) + Math.sin(xx * 0.02 + i) * 22);
        x.fill();
      }
      grain(x, r, 16); break;
    case 'geo':
      x.fillStyle = C[1]; x.fillRect(0, 0, S, S);
      for (let i = 0; i < 70; i++) {
        x.fillStyle = C[r() < 0.6 ? 0 : 2];
        x.beginPath(); const px = r() * S, py = r() * S, s = 20 + r() * 70;
        x.moveTo(px, py); x.lineTo(px + s, py + (r() - .5) * s); x.lineTo(px + (r() - .5) * s, py + s); x.fill();
      }
      grain(x, r, 14); wear(x, r); break;
    case 'gold': {
      const g = x.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, C[0]); g.addColorStop(0.5, C[1]); g.addColorStop(1, C[0]);
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      x.strokeStyle = C[2]; x.lineWidth = 6;
      for (let i = 0; i < S; i += 64) { x.beginPath(); x.moveTo(0, i + 32); for (let xx = 0; xx <= S; xx += 32) x.lineTo(xx, i + 32 + ((xx / 32) % 2 ? -10 : 10)); x.stroke(); }
      x.fillStyle = C[2];
      for (let i = 0; i < 40; i++) { x.save(); x.translate(r() * S, r() * S); x.rotate(Math.PI / 4); x.fillRect(-5, -5, 10, 10); x.restore(); }
      grain(x, r, 10); break;
    }
    case 'damascus': {
      x.fillStyle = C[0]; x.fillRect(0, 0, S, S);
      x.strokeStyle = C[1]; x.lineWidth = 2;
      for (let i = -S; i < S * 2; i += 9) {
        x.beginPath();
        for (let xx = 0; xx <= S; xx += 8) x.lineTo(xx, i + Math.sin(xx * 0.03 + i * 0.05) * 30 + Math.sin(xx * 0.011) * 50);
        x.stroke();
      }
      grain(x, r, 10); break;
    }
    case 'neon': {
      x.fillStyle = C[0]; x.fillRect(0, 0, S, S);
      const e = glow();
      for (const ctx of [x, e]) {
        ctx.lineWidth = 5;
        for (let i = 0; i < 9; i++) {
          ctx.strokeStyle = C[1 + (i % 2)];
          ctx.beginPath();
          for (let xx = 0; xx <= S; xx += 8) ctx.lineTo(xx, i * 60 + 20 + Math.sin(xx * 0.025 + i) * 22);
          ctx.stroke();
        }
      }
      break;
    }
    case 'carbon': {
      for (let yy = 0; yy < S; yy += 16) for (let xx = 0; xx < S; xx += 16) {
        const f = ((xx + yy) / 16) % 2;
        const g = f ? x.createLinearGradient(xx, yy, xx + 16, yy) : x.createLinearGradient(xx, yy, xx, yy + 16);
        g.addColorStop(0, C[0]); g.addColorStop(0.5, C[1]); g.addColorStop(1, C[0]);
        x.fillStyle = g; x.fillRect(xx, yy, 16, 16);
      }
      break;
    }
    case 'ice': {
      const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, C[0]); g.addColorStop(1, C[1]);
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      x.strokeStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 60; i++) {
        x.lineWidth = 0.5 + r() * 2;
        let px = r() * S, py = r() * S; x.beginPath(); x.moveTo(px, py);
        for (let k = 0; k < 5; k++) { px += (r() - 0.5) * 80; py += (r() - 0.5) * 80; x.lineTo(px, py); }
        x.stroke();
      }
      blobs(x, r, ['rgba(255,255,255,0.25)'], 20, 20, 60);
      break;
    }
    case 'toxic': {
      x.fillStyle = C[1]; x.fillRect(0, 0, S, S);
      x.save(); x.rotate(-Math.PI / 4);
      x.fillStyle = C[0];
      for (let i = -S * 2; i < S * 2; i += 64) x.fillRect(i, -S, 30, S * 3);
      x.restore();
      const e = glow(); e.save(); e.rotate(-Math.PI / 4); e.fillStyle = '#2a5a10';
      for (let i = -S * 2; i < S * 2; i += 64) e.fillRect(i, -S, 30, S * 3);
      e.restore();
      wear(x, r); break;
    }
    case 'galaxy': {
      x.fillStyle = C[0]; x.fillRect(0, 0, S, S);
      blobs(x, r, [C[1] + '88', C[2] + '66', '#1a3aff55'], 30, 30, 120);
      const e = glow(); e.drawImage(c, 0, 0); e.fillStyle = 'rgba(0,0,0,0.6)'; e.fillRect(0, 0, S, S);
      for (const ctx of [x, e]) { ctx.fillStyle = '#fff'; for (let i = 0; i < 260; i++) { ctx.globalAlpha = r(); ctx.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); } ctx.globalAlpha = 1; }
      break;
    }
    case 'lava': {
      x.fillStyle = C[0]; x.fillRect(0, 0, S, S);
      const e = glow();
      for (const ctx of [x, e]) {
        for (let i = 0; i < 70; i++) {
          ctx.strokeStyle = i % 3 ? C[1] : C[2]; ctx.lineWidth = 1 + r() * 4;
          let px = r() * S, py = r() * S; ctx.beginPath(); ctx.moveTo(px, py);
          for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 70; py += (r() - 0.5) * 70; ctx.lineTo(px, py); }
          ctx.stroke();
        }
      }
      grain(x, r, 12); break;
    }
    case 'dragon': {
      x.fillStyle = C[0]; x.fillRect(0, 0, S, S);
      const e = glow();
      for (const ctx of [x, e]) {
        for (let i = 0; i < 14; i++) {
          ctx.strokeStyle = i % 2 ? C[1] : C[2]; ctx.lineWidth = 3;
          ctx.beginPath(); const cx = r() * S, cy = r() * S, rad = 20 + r() * 50;
          ctx.arc(cx, cy, rad, r() * 6, r() * 6 + 3); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx, cy, rad * 0.6, 0, 3); ctx.stroke();
        }
      }
      break;
    }
  }
  return { map: c, emissive: emis ? emis[0] : null };
}

const matCache = {};
export function skinMaterial(skinId) {
  if (!skinId || !SKINS[skinId]) return null;
  if (matCache[skinId]) return matCache[skinId];
  const def = SKINS[skinId];
  const { map, emissive } = drawPattern(def, skinId.length * 977 + skinId.charCodeAt(0) * 31);
  const t = new THREE.CanvasTexture(map); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  const metalish = ['gold', 'damascus', 'ice', 'carbon'].includes(def.pattern);
  const mat = new THREE.MeshStandardMaterial({
    map: t,
    metalness: def.pattern === 'gold' ? 1 : def.pattern === 'damascus' ? 0.95 : metalish ? 0.5 : 0.25,
    roughness: def.pattern === 'gold' ? 0.25 : def.pattern === 'damascus' ? 0.22 : def.pattern === 'carbon' ? 0.35 : 0.55,
  });
  if (emissive) {
    const et = new THREE.CanvasTexture(emissive); et.colorSpace = THREE.SRGBColorSpace;
    mat.emissiveMap = et; mat.emissive = new THREE.Color(0xffffff); mat.emissiveIntensity = 1.6;
  }
  matCache[skinId] = mat;
  return mat;
}
