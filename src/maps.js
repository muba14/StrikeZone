// Map definitions. Each map is a grid of cells; '#' = solid wall.
// Floor types: '.' street, 'A' A-site, 'B' B-site, 'T' attacker spawn, 'X' defender spawn,
// 't' tunnel (has ceiling), 'm' middle tiles

function grid(w, h) {
  const g = [];
  for (let z = 0; z < h; z++) g.push(new Array(w).fill('#'));
  return g;
}
function carve(g, x0, z0, x1, z1, t) {
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g[z][x] = t;
}

function sandstorm() {
  const w = 30, h = 30, g = grid(w, h);
  carve(g, 1, 1, 8, 8, 'B');        // B site
  carve(g, 21, 1, 28, 8, 'A');      // A site
  carve(g, 11, 1, 18, 5, 'X');      // CT spawn
  carve(g, 9, 2, 10, 4, '.');       // CT -> B
  carve(g, 19, 2, 20, 4, '.');      // CT -> A
  carve(g, 13, 7, 16, 20, '.');     // Mid
  carve(g, 14, 6, 15, 6, '.');      // Mid doors
  carve(g, 9, 7, 12, 8, '.');       // lower mid -> B (B door)
  carve(g, 17, 9, 22, 10, '.');     // Catwalk / short A
  carve(g, 25, 9, 28, 19, '.');     // Long A
  carve(g, 25, 20, 26, 20, '.');    // Long doors
  carve(g, 23, 21, 27, 23, '.');    // outside long
  carve(g, 8, 22, 22, 27, 'T');     // T spawn
  carve(g, 14, 21, 15, 21, '.');    // mid -> T spawn
  carve(g, 3, 10, 6, 20, 't');      // Upper B tunnels
  carve(g, 3, 9, 5, 9, '.');        // B entrance
  carve(g, 3, 21, 7, 23, 't');      // tunnels -> T
  carve(g, 7, 14, 12, 15, 't');     // lower tunnels -> mid
  return {
    id: 'sandstorm',
    name: 'Sandstorm',
    desc: 'Klasik çöl bomba haritası: Uzun A, Kısa A, Orta ve B tünelleri.',
    cell: 4, w, h, grid: g,
    wallMin: 6, wallMax: 10,
    teamSizeDefault: 5,
    weapons: 'all',
    mode: 'bomb',
    crates: [
      [23, 3, 2], [24, 3, 1], [26, 6, 1], [22, 6, 1], [27, 2, 2], [24, 7, 1],
      [2, 2, 2], [3, 2, 1], [6, 5, 1], [5, 6, 2], [2, 7, 1],
      [13, 12, 1], [16, 16, 1], [28, 14, 2], [25, 12, 1], [12, 2, 1],
      [10, 24, 1], [20, 25, 2], [18, 10, 1], [27, 22, 1],
    ],
    arches: [
      // [x0,z0,x1,z1, axis] axis = direction of travel
      [14, 6, 15, 6, 'z', 'metalBlue'],
      [25, 20, 26, 20, 'z', 'metalBlue'],
      [14, 21, 15, 21, 'z', 'wood'],
      [3, 9, 5, 9, 'z', 'wood'],
      [11, 7, 11, 8, 'x', 'metalGreen'],
    ],
    palms: [[9, 26], [21, 23], [17, 1], [11, 5], [28, 1], [1, 1], [8, 22]],
    barrels: [[19, 27], [22, 22], [28, 19], [13, 20], [1, 8], [8, 1], [16, 7]],
    labels: { A: [24.5, 4.5], B: [4.5, 4.5] },
    sites: { A: [21, 1, 28, 8], B: [1, 1, 8, 8] },
    lanes: [[14, 12], [26, 14], [4, 15], [19, 9], [10, 15], [10, 7], [25, 22]],
    env: {
      sunDir: [0.45, 0.85, 0.3], sunColor: 0xfff1d6, sunInt: 2.9,
      skyTop: 0x4f8fd8, skyHorizon: 0xe9dcc3, groundColor: 0xb58c5a, hemiInt: 0.8,
      fog: 0xe5d6b8, fogNear: 70, fogFar: 330, exposure: 0.9,
    },
    floorMat: { '.': 'sand', 'T': 'sand', 'X': 'concrete', 'A': 'pavers', 'B': 'pavers2', 't': 'concreteDark' },
    wallMats: ['sandstone', 'sandstone2', 'plasterSand', 'plasterSand2'],
  };
}

function bazaar() {
  const w = 24, h = 13, g = grid(w, h);
  carve(g, 1, 4, 3, 8, 'T');
  carve(g, 1, 1, 3, 3, '.');
  carve(g, 1, 9, 3, 11, '.');
  carve(g, 20, 4, 22, 8, 'X');
  carve(g, 20, 1, 22, 3, '.');
  carve(g, 20, 9, 22, 11, '.');
  carve(g, 4, 1, 19, 2, 'm');   // top lane
  carve(g, 4, 10, 19, 11, 'm'); // bottom lane
  carve(g, 4, 5, 19, 7, 'm');   // middle
  carve(g, 6, 3, 7, 4, 'm');
  carve(g, 16, 3, 17, 4, 'm');
  carve(g, 6, 8, 7, 9, 'm');
  carve(g, 16, 8, 17, 9, 'm');
  carve(g, 11, 3, 12, 9, 'm');
  return {
    id: 'bazaar',
    name: 'Bazaar',
    desc: 'Hint çarşısı temalı simetrik keskin nişancı düello haritası. Sadece AWM.',
    cell: 3, w, h, grid: g,
    wallMin: 7, wallMax: 11,
    teamSizeDefault: 3,
    weapons: 'sniper',
    mode: 'duel',
    crates: [
      [5, 6, 1], [18, 6, 1], [9, 5, 2], [14, 7, 2], [11, 1, 1], [12, 11, 1],
      [8, 2, 1], [15, 10, 1], [2, 2, 1], [21, 10, 1], [12, 6, 1],
    ],
    arches: [
      [6, 3, 7, 3, 'z', 'wood'], [16, 3, 17, 3, 'z', 'wood'],
      [6, 9, 7, 9, 'z', 'wood'], [16, 9, 17, 9, 'z', 'wood'],
      [11, 3, 12, 3, 'z', 'metalBlue'], [11, 9, 12, 9, 'z', 'metalBlue'],
    ],
    palms: [[1, 1], [22, 11], [1, 11], [22, 1]],
    barrels: [[3, 9], [20, 3], [10, 10], [13, 2]],
    banners: true,
    domes: true,
    labels: {},
    sites: {},
    lanes: [[8, 1], [15, 1], [8, 11], [15, 11], [11, 6], [6, 6], [17, 6], [11, 4], [12, 8]],
    env: {
      sunDir: [-0.7, 0.42, 0.35], sunColor: 0xffc58a, sunInt: 3.0,
      skyTop: 0x3c5fa0, skyHorizon: 0xf2b27a, groundColor: 0x9c6b48, hemiInt: 1.0,
      fog: 0xe8b98c, fogNear: 50, fogFar: 240, exposure: 1.0,
    },
    floorMat: { '.': 'pavers2', 'T': 'pavers', 'X': 'pavers', 'm': 'tiles' },
    wallMats: ['saffron', 'pink', 'teal', 'cream'],
  };
}

export const MAPS = { sandstorm, bazaar };
