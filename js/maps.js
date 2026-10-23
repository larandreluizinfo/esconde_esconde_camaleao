'use strict';

/* ============================================================
   Cenários do Esconde-Esconde Camaleão
   Cada mapa desenha um fundo procedural e oferece uma paleta
   de cores que combina com o terreno (para a camuflagem).
   ============================================================ */

const MAP_W = 960;
const MAP_H = 620;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rnd(rng, min, max) { return min + (max - min) * rng(); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function blob(ctx, x, y, rx, ry, rot, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function leafCluster(ctx, x, y, r, color, rng) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rnd(rng, 0, Math.PI));
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  for (let j = 0; j < 5; j++) {
    ctx.beginPath();
    ctx.ellipse(Math.cos(j * 1.7) * r, Math.sin(j * 1.7) * r, r * 0.95, r * 0.45, j * 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------- FLORESTA ------------------------- */
function drawForest(ctx, W, H, rng) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#16301c');
  g.addColorStop(0.45, '#2a4a2c');
  g.addColorStop(1, '#1d3a22');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const patches = ['#1e3a22', '#28502c', '#2f6b3a', '#3c7a45', '#4a8a4f', '#5c9b5a', '#2a4530', '#6b7d3a', '#8a9a4a'];
  for (let i = 0; i < 120; i++) {
    blob(ctx, rnd(rng, -60, W + 60), rnd(rng, -60, H + 60),
      rnd(rng, 30, 160), rnd(rng, 20, 95), rnd(rng, 0, Math.PI), pick(rng, patches), rnd(rng, 0.2, 0.55));
  }

  for (let i = 0; i < 300; i++) {
    leafCluster(ctx, rnd(rng, 0, W), rnd(rng, 0, H), rnd(rng, 3, 8),
      pick(rng, ['#3c7a45', '#4a8a4f', '#5c9b5a', '#2f6b3a', '#6b8a4a', '#7a9a52']), rng);
  }

  // troncos
  for (let i = 0; i < 11; i++) {
    const x = rnd(rng, 0, W), y = rnd(rng, 0, H), w = rnd(rng, 10, 24), h = rnd(rng, 110, 240);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd(rng, -0.35, 0.35));
    const tg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    tg.addColorStop(0, '#2a1d13');
    tg.addColorStop(0.5, '#4a3524');
    tg.addColorStop(1, '#241a11');
    ctx.fillStyle = tg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 9);
    else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#1a1209';
    for (let k = 0; k < 6; k++) {
      ctx.fillRect(-w / 2 + rnd(rng, 1, w * 0.65), -h / 2 + rnd(rng, 0, h * 0.9), 2, rnd(rng, 10, 30));
    }
    ctx.restore();
  }

  // feixes de luz
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x = rnd(rng, 0, W);
    const lg = ctx.createLinearGradient(x, 0, x + 120, H);
    lg.addColorStop(0, 'rgba(190,240,160,0.10)');
    lg.addColorStop(1, 'rgba(190,240,160,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + rnd(rng, 40, 140), 0);
    ctx.lineTo(x + rnd(rng, 120, 260), H);
    ctx.lineTo(x + rnd(rng, 40, 120), H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* -------------------------- DESERTO -------------------------- */
function drawDesert(ctx, W, H, rng) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#e3c48f');
  g.addColorStop(0.55, '#d8b57e');
  g.addColorStop(1, '#c9a26b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const sands = ['#e8d3a6', '#e3c48f', '#d8b57e', '#c9a26b', '#b8935f', '#a67f50', '#f0e0bd', '#d9a86a'];
  for (let i = 0; i < 90; i++) {
    blob(ctx, rnd(rng, -80, W + 80), rnd(rng, -60, H + 60),
      rnd(rng, 60, 220), rnd(rng, 14, 55), rnd(rng, -0.25, 0.25), pick(rng, sands), rnd(rng, 0.25, 0.6));
  }

  // dunas em curva
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const y = rnd(rng, 0, H);
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.bezierCurveTo(W * 0.3, y - rnd(rng, 20, 70), W * 0.7, y + rnd(rng, 20, 70), W + 20, y - rnd(rng, 0, 30));
    ctx.strokeStyle = 'rgba(120,88,55,0.18)';
    ctx.lineWidth = rnd(rng, 2, 6);
    ctx.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const x = rnd(rng, -50, W), y = rnd(rng, 0, H), len = rnd(rng, 60, 300);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + len * 0.3, y - rnd(rng, 4, 14), x + len * 0.7, y + rnd(rng, 4, 14), x + len, y);
    ctx.strokeStyle = 'rgba(140,106,69,0.22)';
    ctx.lineWidth = rnd(rng, 1, 2.4);
    ctx.stroke();
  }
  ctx.restore();

  // pedras
  for (let i = 0; i < 60; i++) {
    const x = rnd(rng, 0, W), y = rnd(rng, 0, H), r = rnd(rng, 3, 14);
    blob(ctx, x, y, r, r * rnd(rng, 0.55, 0.85), rnd(rng, 0, Math.PI), pick(rng, ['#8c6a45', '#a67f50', '#6d5236', '#b8935f']), rnd(rng, 0.5, 0.9));
    blob(ctx, x - r * 0.25, y - r * 0.3, r * 0.5, r * 0.3, 0, 'rgba(255,236,200,0.25)', 1);
  }

  // arbustos secos
  for (let i = 0; i < 26; i++) {
    const x = rnd(rng, 0, W), y = rnd(rng, 0, H);
    ctx.save();
    ctx.strokeStyle = pick(rng, ['#8a7a3a', '#7d6b33', '#9a8347']);
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 7; k++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rnd(rng, -14, 14), y - rnd(rng, 5, 18));
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* --------------------------- NEVE --------------------------- */
function drawSnow(ctx, W, H, rng) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#eef4f8');
  g.addColorStop(0.5, '#e6edf2');
  g.addColorStop(1, '#d4e2ec');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const snows = ['#f4f8fa', '#eaf1f5', '#dfe8ee', '#d4e2ec', '#cbd8e2', '#e2eaf0'];
  for (let i = 0; i < 100; i++) {
    blob(ctx, rnd(rng, -60, W + 60), rnd(rng, -60, H + 60),
      rnd(rng, 50, 190), rnd(rng, 16, 70), rnd(rng, -0.3, 0.3), pick(rng, snows), rnd(rng, 0.3, 0.7));
  }

  // sombras azuladas
  const shadows = ['#b9c9d6', '#a9bccb', '#9fb4c4'];
  for (let i = 0; i < 45; i++) {
    blob(ctx, rnd(rng, 0, W), rnd(rng, 0, H), rnd(rng, 30, 110), rnd(rng, 8, 30),
      rnd(rng, -0.3, 0.3), pick(rng, shadows), rnd(rng, 0.18, 0.4));
  }

  // rachaduras de gelo
  ctx.save();
  ctx.strokeStyle = 'rgba(130,158,180,0.35)';
  for (let i = 0; i < 22; i++) {
    let x = rnd(rng, 0, W), y = rnd(rng, 0, H);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = rnd(rng, 0.8, 1.8);
    for (let k = 0; k < 4; k++) {
      x += rnd(rng, -60, 60);
      y += rnd(rng, -40, 40);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // pedras e pinheiros escuros
  for (let i = 0; i < 26; i++) {
    const x = rnd(rng, 0, W), y = rnd(rng, 0, H), r = rnd(rng, 5, 20);
    blob(ctx, x, y, r, r * rnd(rng, 0.5, 0.8), rnd(rng, 0, Math.PI), pick(rng, ['#9fb4c4', '#8ea6b8', '#b3c6d3']), 0.7);
  }
  for (let i = 0; i < 12; i++) {
    const x = rnd(rng, 0, W), y = rnd(rng, 0, H), h = rnd(rng, 30, 70);
    ctx.fillStyle = 'rgba(95,122,134,0.55)';
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + h * 0.32, y);
    ctx.lineTo(x - h * 0.32, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(244,248,250,0.5)';
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + h * 0.12, y - h * 0.35);
    ctx.lineTo(x - h * 0.12, y - h * 0.35);
    ctx.closePath();
    ctx.fill();
  }
}

/* -------------------------- CAVERNA -------------------------- */
function drawCave(ctx, W, H, rng) {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.4, 40, W * 0.5, H * 0.5, W * 0.75);
  g.addColorStop(0, '#2a2e32');
  g.addColorStop(0.55, '#1f2326');
  g.addColorStop(1, '#141719');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const rocks = ['#26292c', '#31353a', '#3c4147', '#474d54', '#555c64', '#5f666e', '#2a2d31', '#3a3f45', '#454b52'];
  for (let i = 0; i < 150; i++) {
    const x = rnd(rng, -50, W + 50), y = rnd(rng, -50, H + 50), r = rnd(rng, 20, 120);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd(rng, 0, Math.PI));
    ctx.beginPath();
    const sides = 5 + Math.floor(rng() * 3);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const rr = r * rnd(rng, 0.6, 1.1);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.65;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = pick(rng, rocks);
    ctx.globalAlpha = rnd(rng, 0.35, 0.8);
    ctx.fill();
    ctx.restore();
  }

  // estalactites
  for (let i = 0; i < 16; i++) {
    const x = rnd(rng, 0, W), w = rnd(rng, 16, 60), h = rnd(rng, 40, 150);
    const lg = ctx.createLinearGradient(x, 0, x, h);
    lg.addColorStop(0, '#3a3f45');
    lg.addColorStop(1, '#1b1e21');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, 0);
    ctx.lineTo(x + w / 2, 0);
    ctx.lineTo(x + rnd(rng, -10, 10), h);
    ctx.closePath();
    ctx.fill();
  }

  // poças
  for (let i = 0; i < 6; i++) {
    const x = rnd(rng, 0, W), y = rnd(rng, 0, H);
    blob(ctx, x, y, rnd(rng, 40, 130), rnd(rng, 14, 40), rnd(rng, -0.2, 0.2), pick(rng, ['#2f4652', '#34505d', '#28414c']), 0.55);
    blob(ctx, x - 10, y - 5, rnd(rng, 14, 45), rnd(rng, 4, 12), 0, 'rgba(140,190,210,0.12)', 1);
  }

  // brilhos
  ctx.save();
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(190,215,230,${rnd(rng, 0.05, 0.22)})`;
    ctx.beginPath();
    ctx.arc(rnd(rng, 0, W), rnd(rng, 0, H), rnd(rng, 0.6, 1.8), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* --------------------------- MAPAS --------------------------- */
const MAPS = [
  {
    id: 'floresta',
    name: 'Floresta Densa',
    emoji: '🌿',
    tagline: 'Verde por todo lado.',
    seed: 20261023,
    palette: ['#1e3a22', '#28502c', '#2f6b3a', '#3c7a45', '#4a8a4f', '#5c9b5a', '#2a4530', '#16301c', '#6b7d3a', '#8a9a4a'],
    draw: drawForest,
  },
  {
    id: 'deserto',
    name: 'Deserto Ardente',
    emoji: '🏜️',
    tagline: 'Areia, dunas e pouca sombra.',
    seed: 777001,
    palette: ['#e8d3a6', '#e3c48f', '#d8b57e', '#c9a26b', '#b8935f', '#a67f50', '#f0e0bd', '#d9a86a', '#8c6a45', '#c98f52'],
    draw: drawDesert,
  },
  {
    id: 'neve',
    name: 'Pico Nevado',
    emoji: '❄️',
    tagline: 'Branco, gelo e sombras azuis.',
    seed: 414242,
    palette: ['#f4f8fa', '#eaf1f5', '#dfe8ee', '#d4e2ec', '#cbd8e2', '#e2eaf0', '#b9c9d6', '#a9bccb', '#9fb4c4', '#8ea6b8'],
    draw: drawSnow,
  },
  {
    id: 'caverna',
    name: 'Caverna Sombria',
    emoji: '🕳️',
    tagline: 'Pedra escura e poças frias.',
    seed: 909090,
    palette: ['#26292c', '#31353a', '#3c4147', '#474d54', '#555c64', '#5f666e', '#2a2d31', '#3a3f45', '#454b52', '#6a727b'],
    draw: drawCave,
  },
];

const mapCanvasCache = new Map();

function getMapCanvas(map) {
  if (mapCanvasCache.has(map.id)) return mapCanvasCache.get(map.id);
  const c = document.createElement('canvas');
  c.width = MAP_W;
  c.height = MAP_H;
  map.draw(c.getContext('2d'), MAP_W, MAP_H, mulberry32(map.seed));
  mapCanvasCache.set(map.id, c);
  return c;
}
