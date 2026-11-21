import * as THREE from 'three';

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const S = 512;
function cv(size = S) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function speckle(x, amt, r, size = S) {
  const im = x.getImageData(0, 0, size, size), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  x.putImageData(im, 0, 0);
}

// seamless blotches (drawn with wrap-around)
function blot(x, r, count, minR, maxR, colors, alpha, size = S) {
  for (let i = 0; i < count; i++) {
    const px = r() * size, py = r() * size;
    const rad = minR + r() * (maxR - minR);
    const col = colors[(r() * colors.length) | 0];
    const a = alpha * (0.4 + r() * 0.6);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const cx = px + ox * size, cy = py + oy * size;
      if (cx + rad < 0 || cx - rad > size || cy + rad < 0 || cy - rad > size) continue;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, hexA(col, a));
      g.addColorStop(1, hexA(col, 0));
      x.fillStyle = g;
      x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, Math.round(v * f)));
  return '#' + [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function crack(x, r, count, color, size = S) {
  x.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    let px = r() * size, py = r() * size;
    x.lineWidth = 0.6 + r() * 1.2;
    x.beginPath(); x.moveTo(px, py);
    const steps = 4 + (r() * 8) | 0;
    let ang = r() * Math.PI * 2;
    for (let s = 0; s < steps; s++) {
      ang += (r() - 0.5) * 1.2;
      px += Math.cos(ang) * (6 + r() * 14);
      py += Math.sin(ang) * (6 + r() * 14);
      x.lineTo(px, py);
    }
    x.stroke();
  }
}

function toTex(c, renderer) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  t.needsUpdate = true;
  return t;
}

// ---------- generators ----------
function sand() {
  const [c, x] = cv(); const r = rng(11);
  x.fillStyle = '#c7a06a'; x.fillRect(0, 0, S, S);
  blot(x, r, 140, 30, 110, ['#b48c58', '#d8b47c', '#bf955f', '#cfa974'], 0.35);
  blot(x, r, 900, 1, 3.5, ['#8c6a40', '#e9cf9f', '#a07c4a', '#6f5434'], 0.9);
  crack(x, r, 6, 'rgba(110,80,45,0.25)');
  speckle(x, 30, r);
  return c;
}

function sandstone(seed = 21, base = '#cfa56d') {
  const [c, x] = cv(); const r = rng(seed);
  x.fillStyle = shade(base, 0.72); x.fillRect(0, 0, S, S); // mortar
  const rows = 8, bh = S / rows;
  for (let row = 0; row < rows; row++) {
    const bw = 128 + ((row % 3) * 16);
    const off = (row % 2) * (bw / 2);
    for (let bx = -bw; bx < S + bw; bx += bw) {
      const f = 0.88 + r() * 0.22;
      x.fillStyle = shade(base, f);
      const X = bx + off + 3, Y = row * bh + 3, W = bw - 6, H = bh - 6;
      x.fillRect(X, Y, W, H);
      // edge shading
      x.fillStyle = 'rgba(255,240,210,0.12)'; x.fillRect(X, Y, W, 3);
      x.fillStyle = 'rgba(60,40,20,0.18)'; x.fillRect(X, Y + H - 4, W, 4);
      // chips
      for (let k = 0; k < 3; k++) {
        x.fillStyle = `rgba(90,65,35,${0.15 + r() * 0.2})`;
        x.beginPath(); x.arc(X + r() * W, Y + r() * H, 1 + r() * 3, 0, 7); x.fill();
      }
    }
  }
  blot(x, r, 60, 20, 90, ['#8d6d45', '#e6c99a', '#7a5a35'], 0.22);
  crack(x, r, 10, 'rgba(80,55,30,0.35)');
  speckle(x, 26, r);
  return c;
}

function plaster(seed, base, band) {
  const [c, x] = cv(); const r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  blot(x, r, 90, 30, 140, [shade(base, 0.86), shade(base, 1.08), shade(base, 0.93)], 0.3);
  // exposed bricks patches
  for (let i = 0; i < 2; i++) {
    const px = r() * S, py = r() * S, w = 40 + r() * 50, h = 28 + r() * 28;
    for (let yy = 0; yy < h; yy += 14) for (let xx = (yy / 14 % 2) * 14; xx < w; xx += 28) {
      x.fillStyle = shade('#9a6b44', 0.85 + r() * 0.3);
      x.fillRect((px + xx) % S, (py + yy) % S, 25, 11);
    }
  }
  if (band) {
    x.fillStyle = band; x.fillRect(0, S - 56, S, 24);
    x.fillStyle = shade(band, 0.7);
    for (let i = 0; i < S; i += 32) { x.beginPath(); x.arc(i + 16, S - 44, 7, 0, 7); x.fill(); }
  }
  blot(x, r, 14, 5, 30, ['#5d4630', '#3d2f22'], 0.08);
  // vertical rain streaks
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(70,50,30,${0.03 + r() * 0.05})`; x.fillRect(r() * S, 0, 2 + r() * 6, S); }
  crack(x, r, 10, 'rgba(60,45,30,0.3)');
  speckle(x, 18, r);
  return c;
}

function crate() {
  const [c, x] = cv(); const r = rng(31);
  x.fillStyle = '#8a6239'; x.fillRect(0, 0, S, S);
  // planks
  for (let i = 0; i < 5; i++) {
    x.fillStyle = shade('#9b7044', 0.85 + r() * 0.3);
    x.fillRect(48, 48 + i * 84, S - 96, 80);
    x.strokeStyle = 'rgba(60,38,18,0.35)';
    for (let g = 0; g < 9; g++) {
      x.lineWidth = 1; x.beginPath();
      const yy = 52 + i * 84 + r() * 72;
      x.moveTo(48, yy); x.bezierCurveTo(200, yy + (r() - .5) * 8, 330, yy + (r() - .5) * 8, S - 48, yy);
      x.stroke();
    }
  }
  // diagonal brace
  x.save(); x.translate(S / 2, S / 2); x.rotate(Math.PI / 4);
  x.fillStyle = '#7a5530'; x.fillRect(-330, -34, 660, 68);
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(-330, 30, 660, 6);
  x.restore();
  // frame
  x.lineWidth = 48; x.strokeStyle = '#6e4a28'; x.strokeRect(24, 24, S - 48, S - 48);
  x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,0.4)'; x.strokeRect(48, 48, S - 96, S - 96);
  x.strokeStyle = 'rgba(255,230,190,0.2)'; x.strokeRect(2, 2, S - 4, S - 4);
  // nails
  x.fillStyle = '#3a3530';
  for (const p of [[24, 24], [S - 24, 24], [24, S - 24], [S - 24, S - 24], [S / 2, 24], [S / 2, S - 24], [24, S / 2], [S - 24, S / 2]]) {
    x.beginPath(); x.arc(p[0], p[1], 5, 0, 7); x.fill();
  }
  // stencil
  x.fillStyle = 'rgba(30,20,10,0.45)'; x.font = 'bold 34px monospace'; x.textAlign = 'center';
  x.fillText('CARGO 7.62', S / 2, S / 2 - 120);
  blot(x, r, 30, 10, 60, ['#3b2812', '#c9a06a'], 0.2);
  speckle(x, 22, r);
  return c;
}

function pavers(seed = 41, base = '#b9a283') {
  const [c, x] = cv(); const r = rng(seed);
  x.fillStyle = shade(base, 0.6); x.fillRect(0, 0, S, S);
  const n = 4, w = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const ox = (i % 2) * 0, f = 0.85 + r() * 0.25;
    x.fillStyle = shade(base, f);
    x.fillRect(i * w + 4 + ox, j * w + 4, w - 8, w - 8);
    x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(i * w + 4, j * w + 4, w - 8, 4);
  }
  blot(x, r, 80, 10, 70, ['#7d6a51', '#d9c7a8', '#6a5a45'], 0.25);
  blot(x, r, 400, 1, 3, ['#5f5040', '#e0d2b8'], 0.7);
  crack(x, r, 12, 'rgba(50,40,30,0.4)');
  speckle(x, 24, r);
  return c;
}

function concrete(seed = 51, base = '#a89b88') {
  const [c, x] = cv(); const r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  blot(x, r, 160, 10, 90, [shade(base, 0.8), shade(base, 1.1), shade(base, 0.9)], 0.3);
  blot(x, r, 1200, 0.5, 2, ['#5b5246', '#d8cfc0'], 0.7);
  x.strokeStyle = 'rgba(40,35,30,0.35)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 2); x.lineTo(S, 2); x.moveTo(2, 0); x.lineTo(2, S); x.stroke();
  crack(x, r, 8, 'rgba(50,45,40,0.35)');
  speckle(x, 20, r);
  return c;
}

function metal(seed, base) {
  const [c, x] = cv(); const r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) {
    x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(i * 128 + 60, 0, 8, S);
    x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(i * 128 + 68, 0, 3, S);
  }
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, 250, S, 10);
  blot(x, r, 70, 4, 40, ['#7a3b16', '#5a2a10', '#9c5527'], 0.55);
  x.strokeStyle = 'rgba(220,220,220,0.18)';
  for (let i = 0; i < 80; i++) {
    x.lineWidth = 0.7; x.beginPath();
    const px = r() * S, py = r() * S; x.moveTo(px, py); x.lineTo(px + (r() - .5) * 40, py + (r() - .5) * 10); x.stroke();
  }
  speckle(x, 18, r);
  return c;
}

function darkWood(seed = 61) {
  const [c, x] = cv(); const r = rng(seed);
  x.fillStyle = '#5b3a20'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 8; i++) {
    x.fillStyle = shade('#6b4526', 0.8 + r() * 0.35); x.fillRect(0, i * 64 + 2, S, 60);
    x.strokeStyle = 'rgba(30,18,8,0.4)';
    for (let g = 0; g < 7; g++) {
      x.lineWidth = 1; x.beginPath(); const yy = i * 64 + 4 + r() * 56;
      x.moveTo(0, yy); x.bezierCurveTo(170, yy + (r() - .5) * 6, 340, yy + (r() - .5) * 6, S, yy); x.stroke();
    }
  }
  speckle(x, 16, r);
  return c;
}

function tiles(seed = 71) {
  const [c, x] = cv(); const r = rng(seed);
  x.fillStyle = '#7d6650'; x.fillRect(0, 0, S, S);
  const n = 4, w = S / n;
  const pal = [['#e6d6b5', '#2f7f7a', '#c9662a'], ['#ddc9a3', '#b23a3a', '#2f6f99']];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p = pal[(i + j) % 2];
    const X = i * w + 3, Y = j * w + 3, W = w - 6;
    x.fillStyle = p[0]; x.fillRect(X, Y, W, W);
    x.fillStyle = p[1];
    x.save(); x.translate(X + W / 2, Y + W / 2);
    for (let k = 0; k < 8; k++) { x.rotate(Math.PI / 4); x.fillRect(-6, 8, 12, W * 0.34); }
    x.fillStyle = p[2]; x.beginPath(); x.arc(0, 0, W * 0.16, 0, 7); x.fill();
    x.fillStyle = p[0]; x.beginPath(); x.arc(0, 0, W * 0.07, 0, 7); x.fill();
    x.restore();
    x.fillStyle = p[2];
    for (const q of [[X, Y], [X + W, Y], [X, Y + W], [X + W, Y + W]]) { x.beginPath(); x.arc(q[0], q[1], 10, 0, 7); x.fill(); }
  }
  blot(x, r, 90, 10, 70, ['#5b4838', '#3b2e24', '#e8dcc5'], 0.25);
  crack(x, r, 10, 'rgba(50,40,30,0.4)');
  speckle(x, 22, r);
  return c;
}

function cloth(seed, a, b) {
  const [c, x] = cv(256); const r = rng(seed);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * 32, 0, 32, 256); }
  x.fillStyle = 'rgba(255,220,120,0.5)';
  for (let i = 0; i < 256; i += 16) { x.fillRect(0, i, 256, 2); }
  blot(x, r, 40, 5, 40, ['#000000', '#ffffff'], 0.08, 256);
  speckle(x, 14, r, 256);
  return c;
}

function decal() {
  const [c, x] = cv(64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(10,8,6,1)'); g.addColorStop(0.25, 'rgba(25,18,12,0.95)');
  g.addColorStop(0.5, 'rgba(50,38,25,0.5)'); g.addColorStop(1, 'rgba(60,45,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function flash() {
  const [c, x] = cv(128);
  x.translate(64, 64);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 60);
  g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.2, 'rgba(255,210,120,0.95)');
  g.addColorStop(0.5, 'rgba(255,140,40,0.4)'); g.addColorStop(1, 'rgba(255,100,0,0)');
  x.fillStyle = g;
  for (let i = 0; i < 6; i++) {
    x.rotate(Math.PI / 3);
    x.beginPath(); x.moveTo(0, -8); x.lineTo(62, 0); x.lineTo(0, 8); x.fill();
  }
  x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function puff() {
  const [c, x] = cv(64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function palmLeaf() {
  const [c, x] = cv(256);
  x.translate(128, 0);
  x.fillStyle = '#3f6b2a';
  x.fillRect(-3, 0, 6, 256);
  for (let i = 10; i < 250; i += 8) {
    const len = 100 * Math.sin((i / 256) * Math.PI) + 10;
    x.fillStyle = i % 16 ? '#4d7d31' : '#3b6624';
    x.beginPath(); x.moveTo(0, i); x.lineTo(-len, i + 18); x.lineTo(-len + 6, i + 22); x.lineTo(0, i + 6); x.fill();
    x.beginPath(); x.moveTo(0, i); x.lineTo(len, i + 18); x.lineTo(len - 6, i + 22); x.lineTo(0, i + 6); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createTextures(renderer) {
  return {
    sand: toTex(sand(), renderer),
    sandstone: toTex(sandstone(21, '#cfa56d'), renderer),
    sandstone2: toTex(sandstone(22, '#c29763'), renderer),
    plasterSand: toTex(plaster(81, '#d6b888', null), renderer),
    plasterSand2: toTex(plaster(82, '#c8a575', '#9c6b3e'), renderer),
    crate: toTex(crate(), renderer),
    pavers: toTex(pavers(41, '#b9a283'), renderer),
    pavers2: toTex(pavers(42, '#a99577'), renderer),
    concrete: toTex(concrete(51, '#a89b88'), renderer),
    concreteDark: toTex(concrete(52, '#7c7366'), renderer),
    metalBlue: toTex(metal(91, '#2f6f86'), renderer),
    metalGreen: toTex(metal(92, '#4f6b3a'), renderer),
    wood: toTex(darkWood(), renderer),
    tiles: toTex(tiles(), renderer),
    saffron: toTex(plaster(101, '#d58a3e', '#7b2d2d'), renderer),
    pink: toTex(plaster(102, '#c76f6a', '#e8cf8a'), renderer),
    teal: toTex(plaster(103, '#3e8b86', '#e0c27a'), renderer),
    cream: toTex(plaster(104, '#e0cfa9', '#2f6f99'), renderer),
    clothA: toTex(cloth(111, '#b2283a', '#e0a530'), renderer),
    clothB: toTex(cloth(112, '#2e6f9e', '#e8dcc0'), renderer),
    clothC: toTex(cloth(113, '#c9662a', '#5a2d6e'), renderer),
    decal: decal(),
    flash: flash(),
    puff: puff(),
    palm: palmLeaf(),
  };
}
