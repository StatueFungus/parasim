import { Session } from './sim/session.js';
import { Pilot, LANE_NAMES } from './sim/pilot.js';
import { GLIDERS, circleSink, bestBar } from './sim/gliders.js';
import { DAY_START } from './sim/world.js';
import { hash, mulberry32 } from './sim/rng.js';
import { Renderer, drawBarogram, drawAssist } from './render.js';
import { VarioSound } from './audio.js';
import { LESSONS } from './lessons.js';
import { load, save } from './store.js';

const $ = (id) => document.getElementById(id);
const renderer = new Renderer($('view'), $('mini'));
const sound = new VarioSound();
const isTouch = matchMedia('(pointer: coarse)').matches;

const prefs = Object.assign(
  { glider: 'EN-B', terrain: 'flat', clouds: 'cumulus', wind: 0, quality: 1, bots: 3, len: 12, sound: true, coach: true, thermals: false, mc: 1, centering: 'auto' },
  load('prefs', {}),
);
const savePrefs = () => save('prefs', prefs);
sound.enabled = prefs.sound;

let game = null;
let demo = null;
let paused = false;
let fast = false;
const input = { circle: false, up: false, down: false, left: false, right: false, touchCircle: false };

// ---------- Hilfen ----------
const km = (m) => (m / 1000).toFixed(1) + ' km';
const pad = (n) => String(n).padStart(2, '0');
function clockOf(t) {
  const s = Math.floor(DAY_START + t);
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}`;
}
function hmm(sec) {
  sec = Math.max(0, Math.floor(sec));
  return `${Math.floor(sec / 3600)}:${pad(Math.floor((sec % 3600) / 60))}`;
}
function windText(kmh) {
  if (!kmh) return 'still';
  return `${Math.abs(kmh)} km/h ${kmh > 0 ? 'Rücken' : 'Gegen'}`;
}
function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

function show(id) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id;
}

// ---------- Rekordflug-Geist ----------
class Ghost {
  constructor(data) {
    this.pts = data.pts;
    this.best = data.best;
  }
  static fromFlight(f) {
    return { best: f.dist, pts: f.track.map((q) => [Math.round(q.t), Math.round(q.x), Math.round(q.z), q.c, Math.round((q.l || 0) * 100) / 100]) };
  }
  at(t) {
    const p = this.pts;
    if (!p.length || t < p[0][0] || t > p[p.length - 1][0]) return null;
    let lo = 0, hi = p.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m][0] <= t) lo = m; else hi = m; }
    const a = p[lo], b = p[hi], k = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
    return { x: a[1] + (b[1] - a[1]) * k, z: a[2] + (b[2] - a[2]) * k, c: a[3], l: (a[4] || 0) + ((b[4] || 0) - (a[4] || 0)) * k };
  }
}

// ---------- Konfigurationen ----------
function dailyCfg() {
  const key = localDateKey();
  const r = mulberry32(hash('daily', key));
  const winds = [-10, -5, 0, 0, 5, 5, 10, 15];
  const clouds = ['cumulus', 'cumulus', 'cumulus', 'streets', 'blue'];
  return {
    mode: 'daily', key,
    world: {
      seed: hash('dseed', key), terrain: r() < 0.3 ? 'mountain' : 'flat',
      wind: winds[Math.floor(r() * winds.length)], clouds: clouds[Math.floor(r() * clouds.length)], quality: 0.9 + 0.3 * r(),
    },
    glider: 'EN-B', bots: 3, len: 12, penalty: 600,
  };
}

const STEER_RATE = 1.2;   // Schieberweg pro echter Sekunde bei gehaltener Pfeiltaste
const STEER_PX = 110;     // Daumenweg in Pixeln für eine Schiebereinheit
const CENTERING_NAMES = { auto: 'Automatisch', assist: 'Assistiert', pro: 'Profi' };
const CLOUD_NAMES = { cumulus: 'Cumulus', streets: 'Wolkenstrassen', blue: 'Blauthermik' };
const TERRAIN_NAMES = { flat: 'Flachland', mountain: 'Gebirge' };

function describe(cfg) {
  const w = cfg.world;
  return `${cfg.glider} · ${TERRAIN_NAMES[w.terrain]} · ${CLOUD_NAMES[w.clouds]} · Wind ${windText(w.wind)}`;
}

function pbKey(cfg) {
  const w = cfg.world;
  return `pb:${cfg.mode}:${cfg.glider}:${w.terrain}:${w.clouds}:${w.wind}:${w.quality}:${cfg.centering}`;
}

// ---------- Spielstart ----------
function startGame(cfg) {
  const session = new Session({
    world: cfg.world, duration: cfg.duration ?? 7200, tStart: cfg.tStart ?? 0,
    rate: cfg.rate ?? (cfg.duration ?? 7200) / ((cfg.len ?? 12) * 60), penalty: cfg.penalty ?? 0,
  });
  cfg.centering ??= prefs.centering;
  const player = session.add(new Pilot({
    id: 'me', name: 'Du', color: '#ff5470', glider: cfg.glider, isPlayer: true, mc: prefs.mc, centering: cfg.centering,
  }));
  if (cfg.bots) session.addBots(cfg.bots, cfg.glider);
  if (cfg.airStart) {
    session.launch(player);
    player.z = session.world.ground(player.x) + cfg.airStart;
    player.flight.track[0].z = player.flight.maxZ = player.z;
  }
  let ghost = null;
  if (cfg.mode === 'daily') {
    const g = load('ghost:' + cfg.key, null);
    if (g) ghost = new Ghost(g);
  }
  game = {
    cfg, session, player, ghost,
    showThermals: cfg.showThermals ?? (cfg.mode === 'training' ? prefs.thermals : false),
    coachMsg: '', coachShown: 0, coachCheck: 0, circleHist: [], lastAvg: null,
    checkT: 0, ended: false, follow: false, missed: null, assistPts: [], wasCircling: false,
  };
  $('assist').hidden = true;
  if (cfg.missedAt != null) game.missed = { x: cfg.missedAt, t: session.t, air: 3 };
  $('bLane').hidden = session.world.laneCount < 2;
  $('rowRidge').hidden = session.world.laneCount < 2;
  renderer.cam = null;
  paused = false;
  fast = false;
  show(null);
  $('hud').hidden = false;
  $('bThermals').hidden = !(cfg.mode === 'training' || cfg.lesson);
  setPressed($('bThermals'), game.showThermals);
  $('goal').hidden = !cfg.lesson;
  renderer.resize();
  if (isTouch) {
    $('touchHint').hidden = false;
    setTimeout(() => { $('touchHint').hidden = true; }, 9000);
  }
  sound.init();
  requestWakeLock();
  updateRotate();
}

let wakeLock = null;
async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}

function quitToMenu() {
  game = null;
  paused = false;
  $('hud').hidden = true;
  try { wakeLock?.release(); } catch { /* ignorieren */ }
  renderer.cam = null;
  refreshMenu();
  show('menu');
  updateRotate();
}

// ---------- Eingaben ----------
function launchOrRestart() {
  if (!game || game.ended || paused) return;
  const { session: s, player: p } = game;
  if (p.state === 'ready') { s.launch(p); fast = false; }
  else if (p.state === 'landed') {
    if (game.cfg.lesson && !game.cfg.penalty) return;
    if (s.penalty && s.remaining() <= s.penalty) { toast('Die Zeit reicht nicht mehr für den Aufstieg.'); return; }
    s.restart(p);
  }
}

function setPressed(el, on) { el.setAttribute('aria-pressed', on ? 'true' : 'false'); }

function turnTo(dir) {
  if (!game || paused || game.ended) return;
  const p = game.player;
  if (p.state !== 'flying') return;
  if (p.circling) { toast('Erst aus dem Kreis ausleiten, dann wenden.'); return; }
  p.turn(dir ?? -p.dir);
}

function laneTo(lane) {
  if (!game || paused || game.ended) return;
  const p = game.player, w = game.session.world;
  if (w.laneCount < 2 || p.state !== 'flying') return;
  p.setLane(lane ?? 1 - p.lane, w);
}

function toggleThermals() {
  if (!game || $('bThermals').hidden) return;
  game.showThermals = !game.showThermals;
  if (game.cfg.mode === 'training') { prefs.thermals = game.showThermals; savePrefs(); }
  setPressed($('bThermals'), game.showThermals);
}
function toggleCoach() {
  prefs.coach = !prefs.coach; savePrefs();
  setPressed($('bCoach'), prefs.coach);
  if (!prefs.coach) $('coach').classList.remove('show');
}
function toggleSound() {
  prefs.sound = sound.enabled = !prefs.sound; savePrefs();
  setPressed($('bSound'), prefs.sound);
  sound.init();
}
function cycleMc() {
  prefs.mc = (prefs.mc + 0.5) % 3.5; savePrefs();
  if (game) game.player.mc = prefs.mc;
  $('bMc').textContent = 'MC ' + prefs.mc.toFixed(1);
}
function setPause(on) {
  if (!game || game.ended) return;
  paused = on;
  show(on ? 'pause' : null);
}

addEventListener('keydown', (e) => {
  if (!game) return;
  const k = e.key;
  if (k === ' ') { input.circle = true; e.preventDefault(); }
  else if (k === 'ArrowUp') { input.up = true; e.preventDefault(); }
  else if (k === 'ArrowDown') { input.down = true; e.preventDefault(); }
  // ←/→: im Kreis (selbst zentrieren) der Kurvenschieber, sonst Wenden
  else if (k === 'ArrowLeft') { input.left = true; e.preventDefault(); }
  else if (k === 'ArrowRight') { input.right = true; e.preventDefault(); }
  if (e.repeat) return;
  const steering = game.player.circling && game.player.manual;
  if (k === 'ArrowLeft') { if (!steering) turnTo(-1); }
  else if (k === 'ArrowRight') { if (!steering) turnTo(1); }
  else if (k === 'q' || k === 'Q') laneTo(0);
  else if (k === 'e' || k === 'E') laneTo(1);
  if (k === 'Enter') { e.preventDefault(); launchOrRestart(); }
  else if (k === 'p' || k === 'P' || k === 'Escape') setPause(!paused);
  else if (paused) return;
  else if (k === 'm' || k === 'M') cycleMc();
  else if (k === 't' || k === 'T') toggleThermals();
  else if (k === 'c' || k === 'C') toggleCoach();
  else if (k === 's' || k === 'S') toggleSound();
  else if (k === 'z' || k === 'Z') renderer.cycleZoom();
  else if (k === 'x' || k === 'X') toggleFast();
  else if (k === 'f' || k === 'F') { game.follow = !game.follow; toast(game.follow ? 'Kamera folgt dem Führenden' : 'Kamera folgt dir'); }
  else if ((k === 'r' || k === 'R') && game.cfg.mode === 'training' && game.player.state === 'flying') {
    game.player.land(game.session.t);
    game.session.restart(game.player);
  }
});
addEventListener('keyup', (e) => {
  if (e.key === ' ') input.circle = false;
  else if (e.key === 'ArrowUp') input.up = false;
  else if (e.key === 'ArrowDown') input.down = false;
  else if (e.key === 'ArrowLeft') input.left = false;
  else if (e.key === 'ArrowRight') input.right = false;
});
addEventListener('blur', () => { input.circle = input.up = input.down = input.left = input.right = input.touchCircle = false; });

// Touch: linke Hälfte halten = kreisen; beim selbst Zentrieren mit demselben Daumen waagrecht ziehen = Kurvenschieber.
// Rechte Hälfte senkrecht wischen = Beschleuniger.
const touches = new Map();
const view = $('view');
view.addEventListener('pointerdown', (e) => {
  if (!game || paused) return;
  sound.init();
  if (e.clientX < innerWidth / 2) { touches.set(e.pointerId, { kind: 'circle', x0: e.clientX, s0: null }); input.touchCircle = true; }
  else touches.set(e.pointerId, { kind: 'bar', y0: e.clientY, bar0: game.player.bar });
  view.setPointerCapture?.(e.pointerId);
});
view.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId);
  if (!t || !game) return;
  const p = game.player;
  if (t.kind === 'bar') p.bar = Math.max(0, Math.min(1, t.bar0 + (t.y0 - e.clientY) / 160));
  else if (p.circling && p.manual) {
    // Anker setzen, sobald der Kreis läuft; nach rechts ziehen = Rechtskurve
    if (t.s0 == null) { t.s0 = p.steer; t.x0 = e.clientX; }
    p.setSteer(t.s0 - (e.clientX - t.x0) / STEER_PX);
  }
});
function endTouch(e) {
  touches.delete(e.pointerId);
  input.touchCircle = [...touches.values()].some((t) => t.kind === 'circle');
}
view.addEventListener('pointerup', endTouch);
view.addEventListener('pointercancel', endTouch);

function toggleFast() {
  if (!game || game.player.state === 'flying') { fast = false; return; }
  fast = !fast;
}

$('bThermals').onclick = toggleThermals;
$('bCoach').onclick = toggleCoach;
$('bSound').onclick = toggleSound;
$('bZoom').onclick = () => renderer.cycleZoom();
$('bPause').onclick = () => setPause(true);
$('bMc').onclick = cycleMc;
$('bTurn').onclick = () => turnTo();
$('bLane').onclick = () => laneTo();
$('gStart').onclick = launchOrRestart;
$('gFast').onclick = toggleFast;
$('gEnd').onclick = () => { if (game) { game.session.end(); } };
$('pResume').onclick = () => setPause(false);
$('pRestart').onclick = () => { const cfg = game.cfg; paused = false; startGame(cfg); };
$('pMenu').onclick = quitToMenu;

setPressed($('bCoach'), prefs.coach);
setPressed($('bSound'), prefs.sound);
$('bMc').textContent = 'MC ' + prefs.mc.toFixed(1);

// ---------- Fluglehrer ----------
function circleAvg(p, t) {
  const h = game.circleHist;
  if (!p.circling || h.length < 2) return null;
  const a = h[0], span = t - a.t;
  return span > 6 ? (p.z - a.z) / span : null;
}

function coachTip(s, p) {
  const w = s.world, g = p.glider, df = w.dayFactor(s.t);
  if (p.state === 'ready') {
    if (game.cfg.lesson) return null;
    if (df < 0.6) return 'Die Thermik ist noch schwach. Wer jetzt startet, riskiert abzusaufen.';
    if (df > 0.93) return 'Die Thermik ist voll entwickelt. Zeit zu starten!';
    return 'Die Thermik baut sich auf. Startest du früh, hast du mehr Zeit, aber schwächere Bärte.';
  }
  if (p.state !== 'flying') return null;
  const agl = p.z - w.groundAt(p.x, p.l), base = w.baseMSL(s.t);
  if (p.circling && p.manual) {
    const tip = centeringTip(s, p);
    if (tip) return tip;
  }
  if (p.circling) {
    const avg = circleAvg(p, s.t);
    const inT = p.flight.circStart ? s.t - p.flight.circStart.t : 0;
    if (p.z > base - 120) return 'Basis erreicht. Raus aus dem Bart und auf Strecke gehen.';
    if (avg != null && inT > 35 && avg < 0) return 'Du sinkst beim Kreisen. Geradeaus weiterfliegen und neue Thermik suchen.';
    if (avg != null && inT > 60 && agl > 700 && avg < p.mc * 0.6) return `Nur ${avg.toFixed(1)} m/s, weniger als dein MC ${p.mc.toFixed(1)}. Weiterfliegen kann sich lohnen.`;
    return null;
  }
  if (p.turning) return null;
  const two = w.laneCount > 1;
  const overRidge = p.z - w.ground(p.x);
  if (two && p.l < 0.5 && overRidge < 180) return 'Knapp über dem Grat! Mit E ins Tal ausweichen, dort ist mehr Luft unter dir.';
  if (p.dir === -1 && game.missed && p.x < game.missed.x - 400) return 'Den Bart nicht gefunden? Mit → wieder auf Kurs gehen.';
  if (p.dir === -1 && !game.missed) return 'Du fliegst zurück. Mit → wendest du wieder auf Kurs.';
  if (agl < 250) return 'Sehr tief! Trimm fliegen und jedes Steigen mitnehmen.';
  if (p.dir === 1 && game.missed && agl < 550 && p.air < 0 && p.x - game.missed.x > 150 && p.x - game.missed.x < 700 && s.t - game.missed.t < 100) {
    return `Vor ${Math.round(p.x - game.missed.x)} m hat es gut gestiegen. Mit ← wenden und zurückfliegen?`;
  }
  if (two && p.lane === 1 && overRidge > 450 && df > 0.6) return 'Genug Höhe über dem Grat: An der sonnigen Hangkante (Q) steht die bessere Thermik.';
  if (p.air - circleSink(g) > 0.4 && p.z < base - 150) return 'Es steigt! Leertaste halten und einkreisen.';
  if (p.air > 0.3 && p.air - circleSink(g) <= 0.4) return 'Leichtes Steigen. Zum Kreisen reicht es noch nicht, weiter suchen.';
  const lean = leanTip(s, p);
  if (lean) return lean;
  const stf = bestBar(g, p.mc, p.netto, w.windAt(s.t, p.l, agl) * p.dir);
  if (stf - p.bar > 0.3) return `Sollfahrt: mehr Beschleuniger, etwa ${Math.round(stf * 100)} %.`;
  if (p.bar - stf > 0.3) return `Sollfahrt: weniger Beschleuniger, etwa ${Math.round(stf * 100)} %.`;
  return null;
}

// Tipps fürs selbst Zentrieren: Schwankt das Steigen über die letzten 25 Flugsekunden stark, liegt der Kern daneben.
function centeringTip(s, p) {
  const pts = game.assistPts;
  if (!pts.length || s.t - pts[0].t < 25) return null;
  if (Math.abs(p.steer) < 0.15) return 'Du fliegst fast geradeaus. Mit dem Schieber wieder eindrehen, sonst verlässt du den Bart.';
  let lo = Infinity, hi = -Infinity;
  for (let i = pts.length - 1; i >= 0 && s.t - pts[i].t < 25; i--) { lo = Math.min(lo, pts[i].v); hi = Math.max(hi, pts[i].v); }
  if (hi - lo < 0.6) return null;
  if (Math.abs(s.world.windKmh) >= 10) {
    return 'Der Wind treibt dich leewärts aus dem Bart. Mach die Kurve auf, wenn du gegen den Wind fliegst, und dreh danach wieder ein.';
  }
  return p.centering === 'assist'
    ? 'Der Kern liegt neben deinem Kreis. Fliegst du aufs Kreuz zu, Kurve aufmachen (Schieber zur Mitte), danach wieder eindrehen.'
    : 'Das Steigen schwankt. Wird es stärker, Kurve aufmachen (Schieber zur Mitte); wird es schwächer, enger eindrehen.';
}

// Bei Wind steht der Bart schräg: Auf Flughöhe liegt er luvseitig der Wolke. Höchstens alle 4 Flugminuten erinnern.
function leanTip(s, p) {
  const w = s.world;
  if (Math.abs(w.windKmh) < 10 || s.t < (game.leanTipT ?? -Infinity) + 240) return null;
  const lane = Math.round(p.l);
  for (const th of w.thermals) {
    if ((th.lane || 0) !== lane || w.strength(th, s.t) < 1) continue;
    const c = w.cloud(th, s.t);
    if (!c || c.alpha < 0.6 || c.decay > 0.3) continue;
    const ahead = (c.x - p.x) * p.dir;
    if (ahead < 400 || ahead > 2500) continue;
    const off = c.x - w.coreX(th, p.z, s.t);
    if (Math.abs(off) < 250) continue;
    game.leanTipT = s.t;
    const before = Math.sign(off) === p.dir;
    return `Der Wind versetzt den Bart: Auf deiner Höhe steigt es etwa ${Math.round(Math.abs(off) / 50) * 50} m ` +
      (before ? 'vor der Wolke, du triffst ihn also früher.' : 'hinter der Wolke, flieg unter ihr durch.');
  }
  return null;
}

// ---------- Cockpit ----------
const H = {};
for (const id of ['assist', 'steerBox', 'steerKnob', 'steerTxt', 'hLane', 'hRidge', 'bTurn', 'bLane', 'hRemain', 'hClock', 'hDist', 'hRank', 'hWind', 'hBase', 'hVario', 'hAvg', 'vNeedle', 'hBar', 'barFill', 'stf', 'hAgl', 'hMsl', 'hSpeed', 'hGs', 'hLd', 'ground', 'gTitle', 'gText', 'gMeterFill', 'gStart', 'gFast', 'gEnd', 'coach', 'goal']) H[id] = $(id);

function updateHud(dt) {
  const { session: s, player: p, cfg } = game;
  const w = s.world;
  const g = p.glider;
  H.hRemain.textContent = hmm(s.remaining());
  H.hClock.textContent = clockOf(s.t);
  const cur = p.state === 'flying' ? p.dist : p.best;
  H.hDist.textContent = km(cur) + (p.state === 'flying' && p.dir === -1 ? ' ↩' : '');
  if (s.pilots.length > 1) {
    const rank = s.standings().indexOf(p) + 1;
    H.hRank.textContent = `Platz ${rank} von ${s.pilots.length}` + (p.best > 0 && p.state === 'flying' ? ` · Bestweite ${km(p.best)}` : '');
  } else H.hRank.textContent = p.best > 0 && p.state === 'flying' ? `Bestweite ${km(p.best)}` : '';
  const aglNow = p.state === 'flying' ? p.z - w.groundAt(p.x, p.l) : 0;
  const windHere = Math.round(w.windAt(s.t, p.l, aglNow) * 3.6);
  H.hWind.textContent = windHere ? `${windHere > 0 ? '→' : '←'} ${Math.abs(windHere)} km/h` : 'still';
  H.hBase.textContent = Math.round(w.baseMSL(s.t)) + ' m';

  const flying = p.state === 'flying';
  const v = flying ? p.vario : 0;
  H.hVario.textContent = (v > 0.05 ? '+' : '') + v.toFixed(1);
  H.hVario.className = v > 0.1 ? 'up' : v < -0.1 ? 'down' : '';
  H.vNeedle.style.top = `${50 - Math.max(-5, Math.min(5, v)) * 10}%`;
  const avg = circleAvg(p, s.t);
  if (avg != null) game.lastAvg = avg;
  H.hAvg.textContent = avg != null ? (avg >= 0 ? '+' : '') + avg.toFixed(1) : game.lastAvg != null ? '(' + game.lastAvg.toFixed(1) + ')' : '–';

  H.hBar.textContent = Math.round(p.bar * 100) + ' %';
  H.barFill.style.height = p.bar * 100 + '%';
  const showAssist = flying && p.circling && p.manual;
  H.assist.hidden = !showAssist;
  H.steerBox.hidden = !showAssist;
  if (showAssist) {
    H.steerKnob.style.left = `${50 - p.steer * 46}%`;
    H.steerTxt.textContent = Math.abs(p.steer) < 0.03 ? 'geradeaus'
      : `${p.steer > 0 ? 'Links' : 'Rechts'} · ${Math.round(p.R)} m`;
  }
  if (showAssist) drawAssist(H.assist, p, w, s.t, game.assistPts, p.centering === 'assist');
  const wind = w.windAt(s.t, p.l, aglNow);
  const stf = flying && !p.circling ? bestBar(g, p.mc, p.netto, wind * p.dir) : 0;
  H.stf.style.bottom = stf * 100 + '%';
  H.stf.style.opacity = flying && !p.circling ? 1 : 0.25;

  const gz = w.groundAt(p.x, p.l);
  H.hAgl.textContent = Math.round(flying ? p.z - gz : 0) + ' m';
  H.hMsl.textContent = Math.round(p.z) + ' m';
  H.hSpeed.textContent = Math.round(flying ? p.v : 0) + ' km/h';
  const gs = flying ? (p.circling || p.turning ? wind * 3.6 : p.dir * p.v + wind * 3.6) * p.dir : 0;
  H.hGs.textContent = Math.round(gs) + ' km/h';
  H.hLd.textContent = flying && !p.circling && p.vz < -0.05 && gs > 0 ? '1:' + (gs / 3.6 / -p.vz).toFixed(1) : '–';

  if (w.laneCount > 1) {
    const toLane = Math.abs(p.lane - p.l) > 0.001;
    H.hLane.textContent = toLane ? '→ ' + LANE_NAMES[p.lane] : LANE_NAMES[p.lane];
    H.hRidge.textContent = Math.round(p.z - w.ground(p.x)) + ' m';
    H.bLane.innerHTML = (p.lane === 0 ? 'Ins Tal <kbd>E</kbd>' : 'Zur Kante <kbd>Q</kbd>');
  }
  H.bTurn.innerHTML = p.turning ? 'Wende …' : p.dir === 1 ? 'Wenden <kbd>←</kbd>' : 'Auf Kurs <kbd>→</kbd>';
  H.bTurn.disabled = !flying || p.circling || p.turning;
  H.bLane.disabled = !flying;

  updateGroundPanel(s, p, cfg);

  // Tipps
  if (prefs.coach && !paused) {
    game.coachCheck -= dt;
    if (game.coachCheck <= 0) {
      game.coachCheck = 0.6;
      const msg = coachTip(s, p);
      if (msg && msg !== game.coachMsg) { game.coachMsg = msg; game.coachShown = 4; H.coach.textContent = msg; }
      else if (!msg && game.coachShown <= 0) game.coachMsg = '';
    }
    game.coachShown -= dt;
    H.coach.classList.toggle('show', !!game.coachMsg && game.coachShown > 0);
  }
}

function updateGroundPanel(s, p, cfg) {
  const panel = H.ground;
  if (p.state === 'flying' || game.ended) { panel.hidden = true; return; }
  panel.hidden = false;
  const w = s.world;
  const df = w.dayFactor(s.t);
  H.gMeterFill.style.width = Math.round(df * 100) + '%';
  H.gFast.textContent = fast ? 'Normale Zeit' : 'Zeitraffer';
  H.gFast.hidden = false;
  H.gEnd.hidden = p.flights.length === 0 && cfg.mode !== 'training';
  if (p.state === 'ready') {
    H.gTitle.textContent = p.flights.length ? 'Zurück am Startplatz' : 'Startplatz';
    const strength = df < 0.55 ? 'noch schwach' : df < 0.9 ? 'im Aufbau' : 'voll entwickelt';
    H.gText.textContent = `${clockOf(s.t)} Uhr. Thermik ${strength}, Basis auf ${Math.round(w.baseMSL(s.t))} m. ` +
      (w.terrain === 'flat' ? 'Du startest mit der Winde.' : 'Du startest am Hang.');
    H.gStart.hidden = false;
    H.gStart.innerHTML = 'Starten <kbd>Enter</kbd>';
  } else if (p.state === 'walking') {
    H.gTitle.textContent = 'Aufstieg zum Startplatz';
    H.gText.textContent = `Noch ${Math.ceil((p.walkUntil - s.t) / 60)} Flugminuten bis zum Startplatz. Bisher beste Strecke: ${km(p.best)}.`;
    H.gStart.hidden = true;
  } else if (p.state === 'landed') {
    const f = p.flights[p.flights.length - 1];
    H.gTitle.textContent = `Gelandet nach ${km(f.dist)}`;
    const lessonNoRetry = cfg.lesson && !cfg.penalty;
    let text;
    if (lessonNoRetry) text = 'Die Lektion ist vorbei.';
    else if (!s.penalty) text = 'Im Training kannst du sofort wieder starten.';
    else if (s.remaining() > s.penalty) text = `Hochlaufen kostet ${Math.round(s.penalty / 60)} Flugminuten. Es zählt dein bester Flug.`;
    else text = 'Für einen weiteren Aufstieg reicht die Zeit nicht mehr.';
    H.gText.textContent = text;
    H.gStart.hidden = lessonNoRetry || (s.penalty && s.remaining() <= s.penalty);
    H.gStart.innerHTML = (s.penalty ? 'Hochlaufen' : 'Zurück zum Start') + ' <kbd>Enter</kbd>';
    H.gEnd.hidden = false;
  }
}

// ---------- Hauptschleife ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game) tickGame(dt); else tickDemo(dt);
  requestAnimationFrame(frame);
}

function focusPilot() {
  const { session: s, player: p } = game;
  if (game.follow) return s.standings().find((q) => q.state === 'flying') || p;
  return p;
}

function tickGame(dt) {
  const { session: s, player: p, cfg } = game;
  if (!paused && !game.ended) {
    if (input.up) p.bar = Math.min(1, p.bar + dt * 0.9);
    if (input.down) p.bar = Math.max(0, p.bar - dt * 0.9);
    p.wantCircle = input.circle || input.touchCircle;
    if (p.state === 'flying') fast = false;
    if (p.circling && p.manual) {
      if (input.left) p.setSteer(p.steer + dt * STEER_RATE);
      if (input.right) p.setSteer(p.steer - dt * STEER_RATE);
    }
    s.update(dt * (fast ? 8 : 1));
    // Steigwerte im aktuellen Kreis für Ø-Anzeige (letzte 30 Flugsekunden)
    if (p.circling) {
      game.circleHist.push({ t: s.t, z: p.z });
      while (game.circleHist.length > 2 && s.t - game.circleHist[0].t > 30) game.circleHist.shift();
    } else game.circleHist.length = 0;
    // Spur für den Thermik-Assistenten im mitfliegenden Bezugssystem
    if (p.circling && !game.wasCircling) game.assistPts.length = 0;
    game.wasCircling = p.circling;
    if (p.circling) {
      game.assistPts.push({ x: p.x - p.drift, y: p.y, v: p.vz, t: s.t });
      if (game.assistPts.length > 420) game.assistPts.shift();
    }
    if (p.state === 'flying' && !p.circling && p.dir === 1 && p.air - circleSink(p.glider) > 0.4) {
      if (!game.missed || s.t - game.missed.t > 30 || p.air > game.missed.air) game.missed = { x: p.x, t: s.t, air: p.air };
    }
    if (p.circling || p.state !== 'flying') game.missed = null;
    if (cfg.lesson) checkLesson(dt);
    if (s.ended) finishGame();
  }
  renderer.draw(s, {
    focus: focusPilot(), dt, showThermals: game.showThermals, ghost: game.ghost,
    bestMark: p.best > 0 ? p.launchX + p.best : 0, ghostBest: game.ghost?.best || 0,
  });
  if (game && !game.ended) updateHud(dt);
  sound.update(p.vario, dt, p.state === 'flying' && !paused && !game?.ended);
}

function tickDemo(dt) {
  if (!demo || demo.ended) demo = makeDemo();
  demo.update(dt);
  const lead = demo.standings().find((q) => q.state === 'flying') || demo.pilots[0];
  renderer.draw(demo, { focus: lead, dt, showThermals: false });
}

function makeDemo() {
  const s = new Session({ world: { seed: (Math.random() * 1e9) | 0, terrain: Math.random() < 0.5 ? 'flat' : 'mountain', wind: 5, clouds: 'cumulus' }, duration: 5400, tStart: 1500, rate: 14 });
  s.addBots(5, 'EN-C');
  for (const p of s.pilots) if (p.brain) p.brain.launchAt = s.tStart + Math.random() * 120;
  renderer.cam = null;
  return s;
}

// ---------- Lektionen ----------
function checkLesson(dt) {
  game.checkT -= dt;
  if (game.checkT > 0) return;
  game.checkT = 0.25;
  const { session: s, player: p, cfg } = game;
  const L = cfg.lesson;
  const r = L.check(s, p);
  H.goal.textContent = r.done ? 'Ziel erreicht!' : r.text;
  if (r.done) { game.lessonResult = 'done'; s.end(); return; }
  if (p.state === 'landed' && !cfg.penalty) { game.lessonResult = 'fail'; s.end(); }
}

// ---------- Auswertung ----------
function finishGame() {
  if (game.ended) return;
  game.ended = true;
  $('hud').hidden = true;
  const { session: s, player: p, cfg } = game;
  const best = p.best;
  const bf = p.bestFlight;
  let eyebrow = 'Auswertung', title = best > 0 ? `${km(best)} Strecke` : 'Kein Streckenflug', sub = describe(cfg);
  let history = '';
  let againLabel = 'Nochmal fliegen', newLabel = 'Neues Wetter';

  if (cfg.mode === 'daily') {
    eyebrow = `Tagesaufgabe ${cfg.key.split('-').reverse().join('.')}`;
    const attempts = load('daily:' + cfg.key, []);
    attempts.push({ at: Date.now(), d: Math.round(best), launch: bf ? clockOf(bf.launchT) : null, c: cfg.centering });
    save('daily:' + cfg.key, attempts);
    const prev = load('ghost:' + cfg.key, null);
    if (bf && (!prev || best > prev.best)) {
      save('ghost:' + cfg.key, Ghost.fromFlight(bf));
      if (prev) sub += ' · Neuer Tagesrekord!';
    }
    const rows = [...attempts].sort((a, b) => b.d - a.d).slice(0, 5)
      .map((a, i) => `<tr><td>${i + 1}.</td><td>${km(a.d)}</td><td>${a.launch ? 'Start ' + a.launch : 'nicht gestartet'}</td><td>${CENTERING_NAMES[a.c || 'auto']}</td><td>${new Date(a.at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</td></tr>`).join('');
    history = `<h3>Deine Versuche heute</h3><table><tr><th>#</th><th>Strecke</th><th>Start</th><th>Zentrieren</th><th>Gespielt</th></tr>${rows}</table>`;
    againLabel = 'Nochmal versuchen';
    newLabel = null;
  } else if (cfg.lesson) {
    const ok = game.lessonResult === 'done';
    eyebrow = `Lektion ${cfg.lessonIndex + 1} · ${cfg.lesson.title}`;
    title = ok ? 'Geschafft!' : 'Noch nicht geschafft';
    sub = ok ? cfg.lesson.goal : `Ziel: ${cfg.lesson.goal} Probier es nochmal.`;
    if (ok) {
      const done = load('lessons', {});
      done[cfg.lesson.id] = true;
      save('lessons', done);
    }
    againLabel = ok && cfg.lessonIndex < LESSONS.length - 1 ? 'Nächste Lektion' : 'Nochmal versuchen';
    newLabel = null;
    game.lessonNext = ok && cfg.lessonIndex < LESSONS.length - 1;
  } else {
    const key = pbKey(cfg);
    const pb = load(key, 0);
    if (best > pb) { save(key, best); if (pb > 0) sub += ` · Neue persönliche Bestweite (vorher ${km(pb)})`; }
    else if (pb > 0) sub += ` · Persönliche Bestweite hier: ${km(pb)}`;
  }

  $('rEyebrow').textContent = eyebrow;
  $('rTitle').textContent = title;
  $('rSub').textContent = sub;

  const stats = [];
  stats.push(`<div class="stat hero"><span class="lbl">Beste Strecke</span><b>${km(best)}</b></div>`);
  if (bf) {
    const dur = bf.endT - bf.launchT;
    stats.push(stat('Flugzeit', hmm(dur) + ' h'));
    stats.push(stat('Schnitt', dur > 60 ? ((bf.dist / dur) * 3.6).toFixed(1) + ' km/h' : '–'));
    stats.push(stat('Start', clockOf(bf.launchT) + ' Uhr'));
    stats.push(stat('Kreisanteil', Math.round((100 * bf.circT) / Math.max(1, bf.circT + bf.glideT)) + ' %'));
    stats.push(stat('Thermiken', bf.thermals));
    stats.push(stat('Bestes Steigen', bf.best30 > 0 ? '+' + bf.best30.toFixed(1) + ' m/s' : '–'));
    stats.push(stat('Höhengewinn', Math.round(bf.gain) + ' m'));
    stats.push(stat('Max. Höhe', Math.round(bf.maxZ) + ' m'));
    stats.push(stat('Wenden', bf.turns));
    stats.push(stat('Zentrieren', CENTERING_NAMES[cfg.centering]));
    if (s.world.laneCount > 1) stats.push(stat('An der Kante', Math.round((100 * bf.laneT[0]) / Math.max(1, bf.laneT[0] + bf.laneT[1])) + ' %'));
    if (s.world.laneCount < 2) stats.push(stat('Flüge', p.flights.length));
  }
  $('rStats').innerHTML = stats.join('');

  $('rBoard').innerHTML = s.standings().map((q, i) =>
    `<li class="${q === p ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="dot" style="background:${q.color}"></span>` +
    `<span class="nm">${q.name}<small>${q === p ? q.glider.id : q.tag || ''}</small></span><span class="km">${km(q.best)}</span></li>`).join('');
  $('rHistory').innerHTML = history;
  $('rAgain').textContent = againLabel;
  $('rNew').hidden = !newLabel;
  game.resultText = `ParaSim · ${eyebrow}: ${km(best)} mit ${p.glider.id} (${describe(cfg)})` +
    (s.pilots.length > 1 ? ` · Platz ${s.standings().indexOf(p) + 1} von ${s.pilots.length}` : '');
  show('results');
  requestAnimationFrame(() => drawBarogram($('baro'), s, p));
}

const stat = (label, value) => `<div class="stat"><span class="lbl">${label}</span><b>${value}</b></div>`;

$('rMenu').onclick = quitToMenu;
$('rAgain').onclick = () => {
  const cfg = game.cfg;
  if (cfg.lesson) return game.lessonNext ? openBrief(cfg.lessonIndex + 1) : openBrief(cfg.lessonIndex);
  startGame(cfg);
};
$('rNew').onclick = () => {
  const cfg = { ...game.cfg, world: { ...game.cfg.world, seed: (Math.random() * 1e9) >>> 0 } };
  startGame(cfg);
};
$('rCopy').onclick = async () => {
  try { await navigator.clipboard.writeText(game.resultText); toast('Ergebnis kopiert'); }
  catch { toast(game.resultText); }
};

// ---------- Menü & Einstellungen ----------
let setupMode = 'training';

function segInit(id, key, parse = (v) => v) {
  const el = $(id);
  const sync = () => { for (const b of el.querySelectorAll('button')) setPressed(b, String(parse(b.dataset.v)) === String(prefs[key])); };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    prefs[key] = parse(b.dataset.v);
    savePrefs();
    sync();
    if (key === 'glider') $('gliderDesc').textContent = GLIDERS[prefs.glider].desc;
  });
  sync();
  return sync;
}

$('sGlider').innerHTML = Object.keys(GLIDERS).map((k) => `<button data-v="${k}">${k}</button>`).join('');
const syncBots = segInit('sBots', 'bots', Number);
segInit('sGlider', 'glider');
segInit('sTerrain', 'terrain');
segInit('sClouds', 'clouds');
segInit('sQuality', 'quality', Number);
segInit('sLen', 'len', Number);
segInit('sCenter', 'centering');
$('gliderDesc').textContent = GLIDERS[prefs.glider].desc;
$('sWind').value = prefs.wind;
const windLabel = () => { $('windVal').textContent = windText(prefs.wind); };
$('sWind').oninput = (e) => { prefs.wind = Number(e.target.value); savePrefs(); windLabel(); };
windLabel();

for (const b of document.querySelectorAll('.mode')) {
  b.onclick = () => {
    sound.init();
    const m = b.dataset.mode;
    if (m === 'daily') {
      startGame(dailyCfg());
    } else if (m === 'lessons') {
      renderLessons();
      show('lessons');
    } else {
      setupMode = m;
      $('setupTitle').textContent = m === 'race' ? 'Wettkampf' : 'Freies Training';
      $('sBots').querySelector('[data-v="0"]').hidden = m === 'race';
      if (m === 'race' && prefs.bots === 0) { prefs.bots = 3; syncBots(); }
      show('setup');
    }
  };
}
for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => show(b.closest('#brief') ? 'lessons' : 'menu');

$('setupGo').onclick = () => {
  startGame({
    mode: setupMode,
    world: { seed: (Math.random() * 1e9) >>> 0, terrain: prefs.terrain, wind: prefs.wind, clouds: prefs.clouds, quality: prefs.quality },
    glider: prefs.glider, bots: prefs.bots, len: prefs.len, penalty: setupMode === 'race' ? 1200 : 0,
  });
};

function renderLessons() {
  const done = load('lessons', {});
  $('lessonList').innerHTML = LESSONS.map((L, i) =>
    `<li><button data-i="${i}"><span class="num">${i + 1}</span><span><span class="lt">${L.title}</span><span class="lg">${L.goal}</span></span>` +
    `<span class="done">${done[L.id] ? 'Erledigt' : ''}</span></button></li>`).join('');
}
$('lessonList').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) openBrief(Number(b.dataset.i));
};

let briefIndex = 0;
function openBrief(i) {
  game = null;
  $('hud').hidden = true;
  briefIndex = i;
  const L = LESSONS[i];
  $('briefNo').textContent = `Lektion ${i + 1} von ${LESSONS.length}`;
  $('briefTitle').textContent = L.title;
  $('briefGoal').textContent = 'Ziel: ' + L.goal;
  $('briefText').innerHTML = L.intro.map((t) => `<p>${t}</p>`).join('');
  show('brief');
}
$('briefGo').onclick = () => {
  const L = LESSONS[briefIndex];
  const st = L.setup;
  startGame({
    mode: 'lesson', lesson: L, lessonIndex: briefIndex,
    world: { seed: hash('lesson', L.id), ...st.world },
    glider: st.glider, bots: 0, len: (st.duration / 7200) * 12, duration: st.duration, tStart: st.tStart, centering: st.centering,
    airStart: st.airStart, showThermals: st.showThermals, penalty: st.penalty ?? 0, missedAt: st.missedAt,
  });
};

function refreshMenu() {
  const d = dailyCfg();
  const attempts = load('daily:' + d.key, []);
  const best = attempts.reduce((m, a) => Math.max(m, a.d), 0);
  $('dailyDesc').textContent = `Heute: ${TERRAIN_NAMES[d.world.terrain]}, ${CLOUD_NAMES[d.world.clouds]}, Wind ${windText(d.world.wind)}. ` +
    (best ? `Dein Rekord heute: ${km(best)}.` : 'Für alle gleich, fliege gegen deinen Rekordflug.');
  const done = load('lessons', {});
  const n = LESSONS.filter((L) => done[L.id]).length;
  $('lessonDesc').textContent = n ? `${n} von ${LESSONS.length} Lektionen erledigt.` : `${LESSONS.length} Lektionen von «Thermik zentrieren» bis zum Prüfungsflug.`;
}

// ---------- Layout ----------
function updateRotate() {
  $('rotate').hidden = !(game && isTouch && innerHeight > innerWidth);
}
addEventListener('resize', () => { renderer.resize(); updateRotate(); });

refreshMenu();
show('menu');
requestAnimationFrame(frame);
