'use strict';

/* ============================================================
   Esconde-Esconde Camaleão — lógica do jogo
   5 escondedores + 1 buscador
   1 min de camuflagem · 3 min de busca
   votação de mapa + sorteio do buscador a cada rodada
   ============================================================ */

const CFG = {
  hideTime: 60,
  seekTime: 180,
  hitRadius: 38,
  players: 6,
  hiders: 5,
};

const DEFAULT_NAMES = ['Rafael', 'João', 'Elisa', 'Jogador 4', 'Jogador 5', 'Jogador 6'];

const state = {
  round: 1,
  phase: 'setup',
  players: [],
  mapId: null,
  seekerId: null,
  hiders: [],
  effects: [],
  seekUsed: 0,
  seekStart: 0,
};

let activeHider = null;
let hideEditResolve = null;
let hideTimedOut = false;
let seekResolve = null;
let dragging = false;
let bgCanvas = null;
let currentScreen = 'screen-setup';
let toastTimer = 0;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function currentMap() {
  return MAPS.find((m) => m.id === state.mapId) || MAPS[0];
}

function randPos() {
  return {
    x: rnd(Math.random, 80, MAP_W - 80),
    y: rnd(Math.random, 80, MAP_H - 80),
  };
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/* ------------------------- DOM ------------------------- */
const overlay = $('#overlay');
const toastEl = $('#toast');
const hudRound = $('#hud-round');
const hudPhase = $('#hud-phase');
const hudTimer = $('#hud-timer');
const canvas = $('#board');
const ctx = canvas.getContext('2d');

function showScreen(id) {
  currentScreen = id;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

function setPhase(label) {
  hudPhase.textContent = label;
}

function setRound(n) {
  hudRound.textContent = `Rodada ${n}`;
}

/* ------------------------ TOAST ------------------------ */
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

/* ------------------------ SOM ------------------------ */
let audioCtx = null;
function beep(freq, dur, type, vol) {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const t = audioCtx.currentTime;
    const v = vol === undefined ? 0.035 : vol;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.08));
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + (dur || 0.08) + 0.02);
  } catch (e) { /* silencioso */ }
}

/* ------------------------ OVERLAY ------------------------ */
function openOverlay(html) {
  return new Promise((resolve) => {
    overlay.innerHTML = html;
    overlay.classList.add('show');
    $$('[data-choice]', overlay).forEach((btn) => {
      btn.addEventListener('click', () => {
        const choice = btn.dataset.choice;
        closeOverlay();
        resolve(choice);
      });
    });
  });
}

function closeOverlay() {
  overlay.classList.remove('show');
  overlay.innerHTML = '';
}

function passPrompt(title, text, label) {
  return openOverlay(`
    <div class="card overlay-card">
      <div class="overlay-icon">🤫</div>
      <h2>${title}</h2>
      <p class="muted">${text}</p>
      <div class="actions">
        <button class="btn primary" data-choice="ok">${label || 'Continuar'}</button>
      </div>
    </div>`);
}

/* ------------------------ RELÓGIO ------------------------ */
const clock = { running: false, paused: false, end: 0, remain: 0, onEnd: null, lastSec: null };

function startClock(seconds, onEnd) {
  clock.running = true;
  clock.paused = false;
  clock.end = performance.now() + seconds * 1000;
  clock.remain = seconds * 1000;
  clock.onEnd = onEnd;
  clock.lastSec = null;
}

function pauseClock() {
  if (!clock.running) return;
  clock.remain = Math.max(0, clock.end - performance.now());
  clock.running = false;
  clock.paused = true;
}

function resumeClock() {
  if (!clock.paused) return;
  clock.end = performance.now() + clock.remain;
  clock.paused = false;
  clock.running = true;
}

function stopClock() {
  clock.running = false;
  clock.paused = false;
  clock.onEnd = null;
  clock.remain = 0;
  clock.lastSec = null;
  paintTimer(null);
}

function clockRemaining() {
  if (clock.running) return Math.max(0, clock.end - performance.now());
  if (clock.paused) return clock.remain;
  return null;
}

function paintTimer(ms) {
  if (ms === null || ms === undefined) {
    hudTimer.textContent = '--:--';
    hudTimer.classList.add('idle');
    hudTimer.classList.remove('low');
    return;
  }
  const total = Math.ceil(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  hudTimer.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  hudTimer.classList.remove('idle');
  hudTimer.classList.toggle('low', total <= 15);

  if (clock.running && total <= 10 && total > 0 && clock.lastSec !== total) {
    beep(total <= 3 ? 1040 : 760, 0.045, 'square', 0.02);
  }
  clock.lastSec = total;
}

/* -------------------- CONFIGURAÇÃO -------------------- */
function loadNames() {
  try {
    const saved = JSON.parse(localStorage.getItem('camaleao_names') || 'null');
    if (Array.isArray(saved) && saved.length === CFG.players) {
      return saved.map((n, i) => String(n || '').trim() || DEFAULT_NAMES[i]);
    }
  } catch (e) { /* ignora */ }
  return DEFAULT_NAMES.slice();
}

function buildSetup() {
  const names = loadNames();
  const wrap = $('#player-inputs');
  wrap.innerHTML = '';
  names.forEach((name, i) => {
    const label = document.createElement('label');
    label.innerHTML = `<span>Jogador ${i + 1}</span>`;
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 18;
    input.value = name;
    input.dataset.index = String(i);
    input.setAttribute('autocomplete', 'off');
    label.appendChild(input);
    wrap.appendChild(label);
  });
}

function readPlayerNames() {
  return $$('#player-inputs input').map((input, i) => input.value.trim() || `Jogador ${i + 1}`);
}

async function startGame() {
  const names = readPlayerNames();
  try { localStorage.setItem('camaleao_names', JSON.stringify(names)); } catch (e) { /* ignora */ }
  state.players = names.map((name) => ({ name, wins: { seeker: 0, hider: 0 } }));
  state.round = 1;
  $('#btn-start').disabled = true;
  await runGame();
  $('#btn-start').disabled = false;
}

/* --------------------- VOTAÇÃO --------------------- */
function paintThumbs(root) {
  $$('[data-thumb]', root).forEach((el) => {
    const map = MAPS.find((m) => m.id === el.dataset.thumb);
    if (!map) return;
    const cv = document.createElement('canvas');
    cv.width = 260;
    cv.height = 168;
    cv.getContext('2d').drawImage(getMapCanvas(map), 0, 0, 260, 168);
    el.textContent = '';
    el.appendChild(cv);
  });
}

function renderVoteChoices(player, onPick) {
  $('#vote-eyebrow').textContent = 'Votação de mapa';
  $('#vote-title').innerHTML = `Voto de <span class="hl">${esc(player.name)}</span>`;
  $('#vote-sub').textContent = 'Escolha o mapa desta rodada. O voto é secreto.';
  $('#vote-actions').innerHTML = '';

  const wrap = $('#vote-cards');
  wrap.innerHTML = '';
  let locked = false;

  MAPS.forEach((m) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'map-card';
    btn.innerHTML = `
      <span class="thumb" data-thumb="${m.id}"></span>
      <span class="map-meta">
        <strong>${m.emoji} ${m.name}</strong>
        <span>${m.tagline}</span>
        <span class="dots">${m.palette.slice(0, 6).map((c) => `<i style="background:${c}"></i>`).join('')}</span>
      </span>`;
    btn.addEventListener('click', () => {
      if (locked) return;
      locked = true;
      btn.classList.add('picked');
      beep(620, 0.06, 'triangle', 0.03);
      setTimeout(() => onPick(m.id), 200);
    });
    wrap.appendChild(btn);
  });
  paintThumbs(wrap);
}

function renderVoteTally(counts, chosen, tie) {
  $('#vote-eyebrow').textContent = 'Resultado da votação';
  $('#vote-title').innerHTML = tie
    ? `Empate! Sorteamos: <span class="hl">${esc(chosen.map.name)}</span>`
    : `Mapa escolhido: <span class="hl">${esc(chosen.map.name)}</span>`;
  $('#vote-sub').textContent = tie
    ? 'Houve empate entre os mapas mais votados, então o mapa foi sorteado.'
    : 'O mapa mais votado será usado nesta rodada.';

  const wrap = $('#vote-cards');
  wrap.innerHTML = counts.map((c) => `
    <div class="map-card tally ${c.map.id === chosen.map.id ? 'winner' : ''}">
      <span class="thumb" data-thumb="${c.map.id}"></span>
      <span class="map-meta">
        <strong>${c.map.emoji} ${c.map.name}</strong>
        <span>${c.votes.length} voto${c.votes.length === 1 ? '' : 's'}${c.votes.length ? ' · ' + esc(c.votes.join(', ')) : ''}</span>
      </span>
    </div>`).join('');
  paintThumbs(wrap);

  $('#vote-actions').innerHTML = '<button class="btn primary" id="btn-vote-next">Ir para o sorteio →</button>';
}

async function votingPhase() {
  state.phase = 'vote';
  setPhase('Votação de mapa');
  showScreen('screen-vote');

  const voteMap = new Map(MAPS.map((m) => [m.id, []]));

  for (const player of state.players) {
    await passPrompt(
      `Passe para <span class="hl">${esc(player.name)}</span>`,
      'O voto é secreto. Só quem vai votar deve olhar a tela.',
      'Abrir votação'
    );
    showScreen('screen-vote');
    const mapId = await new Promise((resolve) => renderVoteChoices(player, resolve));
    voteMap.get(mapId).push(player.name);
  }

  const counts = MAPS.map((map) => ({ map, votes: voteMap.get(map.id) }));
  const max = Math.max(...counts.map((c) => c.votes.length));
  const tied = counts.filter((c) => c.votes.length === max);
  const chosen = tied[Math.floor(Math.random() * tied.length)];
  state.mapId = chosen.map.id;

  renderVoteTally(counts, chosen, tied.length > 1);
  await new Promise((resolve) => $('#btn-vote-next').addEventListener('click', resolve, { once: true }));
  bgCanvas = getMapCanvas(currentMap());
}

/* ---------------------- SORTEIO ---------------------- */
async function drawPhase() {
  state.phase = 'draw';
  setPhase('Sorteio do buscador');
  showScreen('screen-draw');

  const wrap = $('#draw-names');
  wrap.innerHTML = state.players
    .map((p, i) => `<span class="name-chip" data-i="${i}">${esc(p.name)}</span>`)
    .join('');
  $('#draw-result').textContent = '';
  $('#draw-actions').innerHTML = '<button class="btn primary" id="btn-draw">Girar o sorteio</button>';

  await new Promise((resolve) => $('#btn-draw').addEventListener('click', resolve, { once: true }));

  const chosen = Math.floor(Math.random() * state.players.length);
  const chips = $$('#draw-names .name-chip');
  const startBtn = $('#btn-draw');
  if (startBtn) startBtn.disabled = true;

  const t0 = performance.now();
  let i = 0;
  while (performance.now() - t0 < 2400) {
    chips.forEach((c) => c.classList.remove('active'));
    chips[i % chips.length].classList.add('active');
    if (i % 2 === 0) beep(520 + (i % 5) * 40, 0.025, 'triangle', 0.012);
    i++;
    const elapsed = performance.now() - t0;
    await sleep(40 + elapsed / 14);
  }

  chips.forEach((c) => c.classList.remove('active'));
  chips[chosen].classList.add('active', 'seeker');
  state.seekerId = chosen;
  beep(880, 0.12, 'sine', 0.05);
  setTimeout(() => beep(1180, 0.16, 'sine', 0.045), 130);

  $('#draw-result').innerHTML = `O buscador desta rodada é <strong>${esc(state.players[chosen].name)}</strong>!`;
  $('#draw-actions').innerHTML = '<button class="btn primary" id="btn-draw-next">Ir para a camuflagem →</button>';
  await new Promise((resolve) => $('#btn-draw-next').addEventListener('click', resolve, { once: true }));
}

/* --------------------- DESENHO --------------------- */
function shade(hex, amt) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt > 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function drawLabel(text, x, y, status) {
  ctx.save();
  ctx.font = '600 13px system-ui, -apple-system, "Segoe UI", sans-serif';
  const w = ctx.measureText(text).width + 18;
  const bx = clamp(x - w / 2, 4, MAP_W - w - 4);
  const by = clamp(y - 48, 4, MAP_H - 26);
  const missed = status === 'missed';

  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, w, 22, 11);
  else ctx.rect(bx, by, w, 22);
  ctx.fillStyle = missed ? 'rgba(52,36,8,0.88)' : 'rgba(6,36,22,0.9)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = missed ? 'rgba(255,190,80,0.65)' : 'rgba(126,226,168,0.65)';
  ctx.stroke();

  ctx.fillStyle = missed ? '#ffd98a' : '#c9ffe0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + w / 2, by + 11.5);
  ctx.restore();
}

function drawChameleon(h, now, opts) {
  const o = opts || {};
  const breathe = 1 + Math.sin(now / 650 + h.seed * 7) * 0.014;
  const scale = h.scale * breathe;
  const base = h.color;

  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.angle);
  ctx.scale(scale, scale);

  if (o.selected) {
    ctx.save();
    ctx.rotate(-h.angle);
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 34 / h.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // rabo espiralado
  ctx.strokeStyle = base;
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(-23, 3, 8.5, -0.4, Math.PI * 1.55);
  ctx.stroke();

  // patas
  ctx.strokeStyle = shade(base, -0.18);
  ctx.lineWidth = 4.5;
  [[-8, 6, -12, 15], [-2, 8, -3, 16], [8, 7, 10, 16], [13, 4, 18, 12]].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  // corpo
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // manchas (padrão)
  if (h.pattern) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 11, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.17)';
    [[-9, -3, 4.5], [-2, 4, 3.6], [6, -4, 3], [10, 3, 2.6], [-13, 2, 2.4]].forEach(([sx, sy, sr]) => {
      ctx.beginPath();
      ctx.ellipse(sx, sy, sr, sr * 0.8, 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    [[-5, 2, 2.2], [3, 0, 1.8]].forEach(([sx, sy, sr]) => {
      ctx.beginPath();
      ctx.ellipse(sx, sy, sr, sr * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // cabeça e crista
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(16, -2, 9.5, 8, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(11, -8);
  ctx.quadraticCurveTo(18, -20, 27, -7);
  ctx.quadraticCurveTo(20, -9, 11, -8);
  ctx.closePath();
  ctx.fill();

  // boca
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(22, 1);
  ctx.quadraticCurveTo(18, 3, 15, 2);
  ctx.stroke();

  // olho
  ctx.fillStyle = 'rgba(20,20,20,0.6)';
  ctx.beginPath();
  ctx.arc(20, -4, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(21, -5, 0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (o.reveal) {
    const t = now / 1000;
    const missed = o.status === 'missed';
    ctx.save();
    ctx.strokeStyle = missed ? 'rgba(255,190,80,0.9)' : 'rgba(120,240,170,0.9)';
    ctx.lineWidth = 2.5;
    if (missed) ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(h.x, h.y, 32 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawLabel(h.name, h.x, h.y, o.status);
  }
}

function addEffect(x, y, type) {
  state.effects.push({ x, y, type, start: performance.now() });
}

function drawEffects(now) {
  state.effects = state.effects.filter((e) => now - e.start < 900);
  state.effects.forEach((e) => {
    const p = (now - e.start) / 900;
    ctx.save();
    if (e.type === 'found') {
      ctx.strokeStyle = `rgba(120,240,170,${1 - p})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 20 + p * 70, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - p)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 6 + p * 28, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function renderPlay(now) {
  ctx.clearRect(0, 0, MAP_W, MAP_H);
  if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);

  if (state.phase === 'hide') {
    if (activeHider) drawChameleon(activeHider, now, { selected: true });
  } else if (state.phase === 'seek' || state.phase === 'result') {
    state.hiders.forEach((h) => {
      const reveal = h.found || state.phase === 'result';
      drawChameleon(h, now, {
        reveal,
        status: state.phase === 'result' && !h.found ? 'missed' : 'found',
      });
    });
  }

  drawEffects(now);
}

/* ------------------ INTERAÇÃO NO MAPA ------------------ */
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (MAP_W / r.width),
    y: (e.clientY - r.top) * (MAP_H / r.height),
  };
}

function moveActiveHider(pos) {
  if (!activeHider) return;
  activeHider.x = clamp(pos.x, 30, MAP_W - 30);
  activeHider.y = clamp(pos.y, 30, MAP_H - 30);
}

function handleSeekClick(pos) {
  if (state.phase !== 'seek') return;

  let best = null;
  let bestDist = Infinity;
  state.hiders.forEach((h) => {
    if (h.found) return;
    const d = Math.hypot(h.x - pos.x, h.y - pos.y);
    if (d <= CFG.hitRadius && d < bestDist) { best = h; bestDist = d; }
  });

  if (best) {
    best.found = true;
    addEffect(best.x, best.y, 'found');
    beep(520, 0.07, 'sine', 0.05);
    setTimeout(() => beep(880, 0.12, 'sine', 0.05), 80);
    showToast(`${best.name} encontrado!`);
    renderSeekPanel();

    if (state.hiders.every((h) => h.found)) {
      const resolve = seekResolve;
      seekResolve = null;
      stopClock();
      if (resolve) resolve('seeker');
    }
  } else {
    addEffect(pos.x, pos.y, 'miss');
    beep(180, 0.06, 'sawtooth', 0.018);
  }
}

canvas.addEventListener('pointerdown', (e) => {
  const pos = canvasPos(e);
  if (state.phase === 'hide' && activeHider) {
    moveActiveHider(pos);
    dragging = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
  } else if (state.phase === 'seek') {
    handleSeekClick(pos);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging || state.phase !== 'hide' || !activeHider) return;
  moveActiveHider(canvasPos(e));
});

function endDrag() { dragging = false; }
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', endDrag);

window.addEventListener('keydown', (e) => {
  if (state.phase !== 'hide' || !activeHider) return;
  const step = e.shiftKey ? 16 : 6;
  let dx = 0;
  let dy = 0;
  if (e.key === 'ArrowLeft') dx = -step;
  else if (e.key === 'ArrowRight') dx = step;
  else if (e.key === 'ArrowUp') dy = -step;
  else if (e.key === 'ArrowDown') dy = step;
  else return;
  e.preventDefault();
  moveActiveHider({ x: activeHider.x + dx, y: activeHider.y + dy });
});

/* --------------------- CAMUFLAGEM --------------------- */
function randomPlace(h) {
  const pos = randPos();
  h.x = pos.x;
  h.y = pos.y;
  h.color = pick(Math.random, currentMap().palette);
  h.angle = rnd(Math.random, -0.5, 0.5);
  h.placed = true;
}

function renderHidePanel(h) {
  $('#hide-name').textContent = h.name;

  const wrap = $('#hide-colors');
  wrap.innerHTML = '';
  currentMap().palette.forEach((color) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (h.color.toLowerCase() === color.toLowerCase() ? ' sel' : '');
    b.style.background = color;
    b.title = color;
    b.addEventListener('click', () => {
      if (!activeHider) return;
      activeHider.color = color;
      $$('.swatch', wrap).forEach((s) => s.classList.remove('sel'));
      b.classList.add('sel');
      $('#hide-color').value = color;
    });
    wrap.appendChild(b);
  });

  $('#hide-color').value = /^#[0-9a-f]{6}$/i.test(h.color) ? h.color : '#2f6b3a';
  $('#hide-pattern').checked = h.pattern;
}

function onHideTimeout() {
  hideTimedOut = true;
  if (activeHider) activeHider.placed = true;
  const resolve = hideEditResolve;
  hideEditResolve = null;
  if (resolve) resolve();
  showToast('Tempo esgotado! Os escondedores restantes foram posicionados automaticamente.');
  beep(200, 0.22, 'sawtooth', 0.03);
}

async function hidePhase() {
  state.phase = 'hide';
  setPhase('Camuflagem · 1 min');
  showScreen('screen-play');
  $('#side-hide').classList.add('on');
  $('#side-seek').classList.remove('on');
  $('#board-hint').textContent = 'Clique, arraste ou use as setas para posicionar seu camaleão';
  canvas.classList.remove('seek-mode');
  canvas.classList.add('hide-mode');

  const map = currentMap();
  state.hiders = state.players
    .map((p, i) => ({ p, i }))
    .filter((item) => item.i !== state.seekerId)
    .map(({ p, i }) => {
      const pos = randPos();
      return {
        name: p.name,
        playerIndex: i,
        x: pos.x,
        y: pos.y,
        color: pick(Math.random, map.palette),
        pattern: Math.random() < 0.4,
        angle: rnd(Math.random, -0.5, 0.5),
        scale: rnd(Math.random, 1.02, 1.24),
        seed: Math.random(),
        found: false,
        placed: false,
      };
    });

  hideTimedOut = false;
  startClock(CFG.hideTime, onHideTimeout);

  for (let idx = 0; idx < state.hiders.length; idx++) {
    if (hideTimedOut) break;
    const h = state.hiders[idx];

    pauseClock();
    await passPrompt(
      `<span class="hl">${esc(h.name)}</span>, esconda-se`,
      'Passe o dispositivo. O buscador não pode ver onde você vai se camuflar.',
      'Vou me camuflar'
    );
    if (hideTimedOut) break;

    showScreen('screen-play');
    resumeClock();
    activeHider = h;
    renderHidePanel(h);
    await new Promise((resolve) => { hideEditResolve = resolve; });
    hideEditResolve = null;
    activeHider = null;
    h.placed = true;
    if (hideTimedOut) break;
  }

  activeHider = null;
  hideEditResolve = null;

  state.hiders.forEach((h) => {
    if (!h.placed) randomPlace(h);
  });

  stopClock();
  $('#side-hide').classList.remove('on');
  canvas.classList.remove('hide-mode');
}

/* ------------------------ BUSCA ------------------------ */
function renderSeekPanel() {
  const seeker = state.players[state.seekerId];
  $('#seek-name').textContent = seeker ? seeker.name : 'Buscador';

  const found = state.hiders.filter((h) => h.found).length;
  $('#found-count').textContent = String(found);
  $('#seek-list').innerHTML = state.hiders.map((h) => `
    <li class="${h.found ? 'found' : ''}">
      <span class="dot"></span>${esc(h.name)}
      <b>${h.found ? 'encontrado' : 'escondido'}</b>
    </li>`).join('');
}

async function seekPhase() {
  state.phase = 'seek';
  setPhase('Busca · 3 min');
  showScreen('screen-play');
  $('#side-hide').classList.remove('on');
  $('#side-seek').classList.add('on');
  $('#board-hint').textContent = 'Clique no mapa para procurar. Encontre os 5 escondedores!';
  canvas.classList.remove('hide-mode');
  canvas.classList.add('seek-mode');
  renderSeekPanel();

  const seeker = state.players[state.seekerId];
  await passPrompt(
    `<span class="hl">${esc(seeker.name)}</span> é o buscador`,
    'Passe o dispositivo. Todos já se camuflaram — boa sorte!',
    'Começar a busca'
  );

  state.seekStart = performance.now();
  state.seekUsed = 0;
  startClock(CFG.seekTime, () => {
    const resolve = seekResolve;
    seekResolve = null;
    if (resolve) resolve('hiders');
  });

  const result = await new Promise((resolve) => { seekResolve = resolve; });

  seekResolve = null;
  stopClock();
  state.seekUsed = Math.min(CFG.seekTime, (performance.now() - state.seekStart) / 1000);
  canvas.classList.remove('seek-mode');
  return result;
}

/* ----------------------- RESULTADO ----------------------- */
function scoreboardHtml() {
  return state.players.map((p) => `
    <li>
      <span>${esc(p.name)}${p === state.players[state.seekerId] ? ' 🐺' : ''}</span>
      <small>${p.wins.seeker} como buscador · ${p.wins.hider} como escondedor</small>
    </li>`).join('');
}

async function resultPhase(winner) {
  state.phase = 'result';
  setPhase('Resultado');
  $('#side-seek').classList.remove('on');

  const seeker = state.players[state.seekerId];
  const found = state.hiders.filter((h) => h.found).length;

  if (winner === 'seeker') {
    seeker.wins.seeker += 1;
  } else {
    state.hiders.forEach((h) => {
      const p = state.players[h.playerIndex];
      if (p) p.wins.hider += 1;
    });
  }

  const title = winner === 'seeker' ? 'O buscador venceu!' : 'Os escondedores venceram!';
  const sub = winner === 'seeker'
    ? `${esc(seeker.name)} encontrou os 5 escondedores em ${fmtTime(state.seekUsed)}.`
    : (() => {
        const rest = CFG.hiders - found;
        return `O tempo acabou! ${rest} ${rest === 1 ? 'escondedor resistiu' : 'escondedores resistiram'} à busca.`;
      })();

  const rows = state.hiders.map((h) => `
    <li class="${h.found ? 'ok' : 'no'}">
      <span>${h.found ? '✓' : '✕'}</span>${esc(h.name)}
      <small>${h.found ? 'encontrado' : 'não encontrado'}</small>
    </li>`).join('');

  const choice = await openOverlay(`
    <div class="card overlay-card result-card">
      <p class="eyebrow">Fim da rodada ${state.round}</p>
      <h2>${title}</h2>
      <p class="muted">${sub}</p>
      <ul class="result-list">${rows}</ul>
      <details class="scores">
        <summary>Placar acumulado</summary>
        <ul>${scoreboardHtml()}</ul>
      </details>
      <div class="actions">
        <button class="btn primary" data-choice="again">Nova rodada</button>
        <button class="btn ghost" data-choice="setup">Trocar jogadores</button>
      </div>
    </div>`);

  return choice === 'again';
}

/* ---------------------- FLUXO GERAL ---------------------- */
async function playRound() {
  state.mapId = null;
  state.seekerId = null;
  state.hiders = [];
  state.effects = [];
  state.seekUsed = 0;
  setRound(state.round);

  await votingPhase();
  await drawPhase();
  await hidePhase();
  const winner = await seekPhase();
  return resultPhase(winner);
}

async function runGame() {
  try {
    while (true) {
      const again = await playRound();
      if (!again) break;
      state.round += 1;
    }
  } catch (err) {
    console.error(err);
    showToast('Algo deu errado. Voltando ao início.');
  } finally {
    state.phase = 'setup';
    setPhase('Configuração');
    setRound(1);
    showScreen('screen-setup');
    $('#side-hide').classList.remove('on');
    $('#side-seek').classList.remove('on');
    canvas.classList.remove('hide-mode', 'seek-mode');
    activeHider = null;
    hideEditResolve = null;
    seekResolve = null;
    stopClock();
    bgCanvas = null;
  }
}

/* ------------------------ INICIALIZAÇÃO ------------------------ */
function frame(now) {
  const rem = clockRemaining();
  if (rem !== null) {
    paintTimer(rem);
    if (clock.running && rem <= 0) {
      const cb = clock.onEnd;
      stopClock();
      if (cb) cb();
    }
  }
  if (currentScreen === 'screen-play' && bgCanvas) renderPlay(now);
  requestAnimationFrame(frame);
}

function init() {
  buildSetup();
  setRound(1);
  setPhase('Configuração');

  $('#btn-start').addEventListener('click', () => {
    if (state.phase !== 'setup' && state.phase !== 'result') return;
    startGame();
  });

  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Reiniciar o jogo? A rodada atual será perdida.')) return;
    location.reload();
  });

  $('#hide-color').addEventListener('input', (e) => {
    if (!activeHider) return;
    activeHider.color = e.target.value;
    $$('#hide-colors .swatch').forEach((s) => s.classList.remove('sel'));
  });

  $('#hide-pattern').addEventListener('change', (e) => {
    if (activeHider) activeHider.pattern = e.target.checked;
  });

  $('#btn-hide-confirm').addEventListener('click', () => {
    if (!activeHider || !hideEditResolve) return;
    const resolve = hideEditResolve;
    hideEditResolve = null;
    beep(700, 0.07, 'triangle', 0.03);
    resolve();
  });

  requestAnimationFrame(frame);
}

init();

