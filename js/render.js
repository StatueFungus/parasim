import { mulberry32, noise2, clamp } from './sim/rng.js';
import { TURN_TIME } from './sim/pilot.js';

const ZOOMS = [3200, 6000, 11000];
const TOP_PAD = 70;

export class Renderer {
  constructor(canvas, mini) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.mini = mini;
    this.mctx = mini.getContext('2d');
    this.cam = null;
    this.zoom = 1;
    this.blobCache = new Map();
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.W = this.cv.clientWidth; this.H = this.cv.clientHeight;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.mW = this.mini.clientWidth; this.mH = this.mini.clientHeight;
    this.mini.width = Math.round(this.mW * dpr); this.mini.height = Math.round(this.mH * dpr);
  }

  get viewW() { return ZOOMS[this.zoom] * Math.max(0.6, (this.W / Math.max(1, this.H)) / 1.78); }

  cycleZoom() { this.zoom = (this.zoom + 1) % ZOOMS.length; }

  // ---------- Kamera ----------
  updateCamera(s, focus, dt) {
    const w = s.world;
    const vw = this.viewW;
    const fx = focus ? focus.x : 0;
    const left = fx - vw * 0.38;
    let gmin = Infinity;
    for (let i = 0; i <= 24; i++) gmin = Math.min(gmin, w.groundAt(left + (vw * i) / 24, w.laneCount - 1));
    const zMax = Math.max(w.baseMSL(s.t) + 450, (focus?.z ?? 0) + 250);
    const zMin = gmin - 0.24 * (zMax - gmin);
    const target = { x: fx, zMin, zMax };
    if (!this.cam || dt === 0) { this.cam = { ...target }; return; }
    const k = Math.min(1, dt * 3), kz = Math.min(1, dt * 1.2);
    this.cam.x += (target.x - this.cam.x) * k;
    if (Math.abs(target.x - this.cam.x) > vw) this.cam.x = target.x;
    this.cam.zMin += (target.zMin - this.cam.zMin) * kz;
    this.cam.zMax += (target.zMax - this.cam.zMax) * kz;
  }

  setupScale() {
    const vw = this.viewW;
    this.left = this.cam.x - vw * 0.38;
    this.kx = this.W / vw;
    this.ky = (this.H - TOP_PAD) / (this.cam.zMax - this.cam.zMin);
  }

  sx(x) { return (x - this.left) * this.kx; }
  sy(z) { return this.H - (z - this.cam.zMin) * this.ky; }

  // ---------- Hauptzeichnung ----------
  draw(s, o) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.updateCamera(s, o.focus, o.dt);
    this.setupScale();
    const w = s.world;
    this.lanes = w.laneCount;
    const base = w.baseMSL(s.t);

    this.drawSky(s);
    this.drawFar(w);
    this.drawClouds(s, base, 0);
    if (w.laneCount > 1) this.drawClouds(s, base, 1);
    this.drawBaseLine(base);
    this.drawGround(w, 0);
    if (o.showThermals) this.drawThermals(s, 0);
    if (w.laneCount > 1) {
      this.drawGround(w, 1);
      if (o.showThermals) this.drawThermals(s, 1);
    }
    this.drawMarks(s, o);
    this.drawBirds(s);
    if (o.focus?.state === 'flying') this.drawPlumb(o.focus, w);
    if (o.focus) this.drawTrail(o.focus);
    if (o.ghost) this.drawGhost(o.ghost, s.t);
    for (const p of s.pilots) if (p !== o.focus) this.drawPilot(p, s, false);
    if (o.focus) this.drawPilot(o.focus, s, true);
    this.drawMini(s, o);
  }

  drawSky(s) {
    const ctx = this.ctx;
    const late = clamp((s.t - 5400) / 3600, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, mix('#1f5d9e', '#2a5288', late));
    g.addColorStop(0.55, mix('#6fa6d6', '#86a6cf', late));
    g.addColorStop(1, mix('#d9ecf6', '#f1dcc0', late));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    // Sonne wandert langsam nach rechts unten
    const sunX = this.W * (0.18 + 0.5 * clamp(s.t / 9000, 0, 1));
    const sunY = this.H * 0.12 + 40 * late;
    const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 120);
    sg.addColorStop(0, 'rgba(255,250,225,0.95)');
    sg.addColorStop(0.12, 'rgba(255,244,200,0.75)');
    sg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sunX - 120, sunY - 120, 240, 240);
  }

  drawFar(w) {
    const ctx = this.ctx;
    const layers = w.terrain === 'mountain'
      ? [{ p: 0.12, h: 0.42, c: 'rgba(120,150,190,0.45)', sc: 1600 }, { p: 0.25, h: 0.3, c: 'rgba(95,128,170,0.5)', sc: 900 }]
      : [{ p: 0.1, h: 0.2, c: 'rgba(130,160,198,0.4)', sc: 1300 }, { p: 0.22, h: 0.1, c: 'rgba(110,145,120,0.35)', sc: 700 }];
    const horizon = this.sy(w.ground(this.cam.x)) - 10;
    for (const L of layers) {
      ctx.fillStyle = L.c;
      ctx.beginPath();
      ctx.moveTo(0, this.H);
      for (let px = 0; px <= this.W + 8; px += 8) {
        const wx = (px + this.cam.x * this.kx * L.p) / L.sc;
        const n = noise2(w.seed + 300 + L.sc, wx, 0.5) * 0.65 + noise2(w.seed + 301, wx * 3, 0.2) * 0.35;
        ctx.lineTo(px, horizon - n * this.H * L.h);
      }
      ctx.lineTo(this.W, this.H);
      ctx.fill();
    }
  }

  drawThermals(s, lane) {
    const ctx = this.ctx, w = s.world;
    const top = this.sy(w.baseMSL(s.t));
    ctx.font = '600 11px "Saira Semi Condensed", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const th of w.thermals) {
      if ((th.lane || 0) !== lane) continue;
      const st = w.strength(th, s.t);
      if (st < 0.15) continue;
      const base = w.baseMSL(s.t);
      const hw = w.radius(th) * 1.6 * this.kx;
      const xBot = this.sx(th.sx), xTop = this.sx(w.coreX(th, base, s.t));
      if (Math.max(xBot, xTop) + hw < 0 || Math.min(xBot, xTop) - hw > this.W) continue;
      const a = Math.min(0.42, st / 8) * (w.laneCount > 1 && lane === 0 ? 0.75 : 1);
      const rgb = lane === 0 ? '255,140,40' : '255,200,60';
      // Schräger Schlauch: in waagrechten Scheiben zeichnen, jede um den Kern auf ihrer Höhe zentriert.
      const bottom = this.sy(th.gz);
      const slices = Math.abs(xTop - xBot) < 4 ? 1 : 24;
      const dz = (base - th.gz) / slices;
      for (let i = 0; i < slices; i++) {
        const z0 = th.gz + i * dz;
        const cx = this.sx(w.coreX(th, z0 + dz / 2, s.t));
        const g = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(0.5, `rgba(${rgb},${a})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        const y1 = i === 0 ? bottom : this.sy(z0), y0 = this.sy(z0 + dz);
        ctx.fillRect(cx - hw, y0, hw * 2, y1 - y0 + 0.5);
      }
      // Auslösepunkt am Boden
      ctx.fillStyle = `rgba(${rgb},0.8)`;
      ctx.beginPath(); ctx.arc(xBot, bottom - 2, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(120,50,0,0.75)';
      ctx.fillText(st.toFixed(1), xTop, top + 16 + lane * 13);
    }
  }

  blobs(th) {
    let b = this.blobCache.get(th.id);
    if (!b) {
      const r = mulberry32(th.seed);
      const n = 7 + Math.floor(r() * 5);
      b = [];
      for (let i = 0; i < n; i++) {
        const dx = (r() * 2 - 1) * 0.75;
        b.push({ dx, dy: 0.15 + r() * 0.55 * (1 - Math.abs(dx) * 0.6), rad: 0.28 + r() * 0.3, drift: r() * 2 - 1 });
      }
      b.sort((a, c) => c.dy - a.dy);
      this.blobCache.set(th.id, b);
      if (this.blobCache.size > 400) this.blobCache.delete(this.blobCache.keys().next().value);
    }
    return b;
  }

  drawClouds(s, base, lane) {
    const ctx = this.ctx, w = s.world;
    const by = this.sy(base);
    const far = w.laneCount > 1 && lane === 0;
    for (const th of w.thermals) {
      if ((th.lane || 0) !== lane) continue;
      const c = w.cloud(th, s.t);
      if (!c || c.alpha <= 0.02) continue;
      const cw = 1500 * c.size * this.kx * (far ? 0.8 : 1);
      const ch = 300 * c.size * this.ky * (far ? 0.8 : 1);
      const cx = this.sx(c.x);
      if (cx + cw < 0 || cx - cw > this.W) continue;
      ctx.save();
      ctx.globalAlpha = c.alpha * (1 - 0.35 * c.decay);
      // Flache Basis bei jungen Wolken; zerfallende Wolken fransen unten aus.
      ctx.beginPath();
      ctx.rect(cx - cw * 2, 0, cw * 4, by + c.decay * 18);
      ctx.clip();
      const grad = ctx.createLinearGradient(0, by - ch * 1.3, 0, by);
      const top = mix(far ? '#eef3fa' : '#ffffff', '#dfe4ea', c.decay);
      const bot = mix(far ? '#bccadb' : '#c9d3de', '#a9b3bf', c.decay);
      grad.addColorStop(0, top);
      grad.addColorStop(0.65, top);
      grad.addColorStop(1, bot);
      ctx.fillStyle = grad;
      for (const b of this.blobs(th)) {
        const spread = 1 + c.decay * 0.5;
        const bx = cx + (b.dx * spread + b.drift * c.decay * 0.25) * cw * 0.5;
        const byy = by - b.dy * ch + c.decay * ch * 0.25;
        const rx = b.rad * cw * 0.5 * (1 - c.decay * 0.3);
        const ry = Math.max(4, b.rad * ch * 0.9 * (1 - c.decay * 0.3));
        ctx.beginPath();
        ctx.ellipse(bx, byy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawBaseLine(base) {
    const ctx = this.ctx, y = this.sy(base);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    ctx.restore();
  }

  drawGround(w, lane) {
    const ctx = this.ctx;
    const step = 3;
    const two = w.laneCount > 1;
    ctx.beginPath();
    ctx.moveTo(0, this.H);
    const pts = [];
    for (let px = 0; px <= this.W + step; px += step) {
      const y = this.sy(w.groundAt(this.left + px / this.kx, lane));
      pts.push(y);
      ctx.lineTo(px, y);
    }
    ctx.lineTo(this.W, this.H);
    ctx.closePath();
    let g;
    if (w.terrain === 'mountain' && lane === 0) {
      // sonnige Flanke
      g = ctx.createLinearGradient(0, this.sy(2700), 0, this.sy(600));
      g.addColorStop(0, '#f4f6f8');
      g.addColorStop(0.18, '#b3ada0');
      g.addColorStop(0.42, '#87907a');
      g.addColorStop(0.62, '#6c9450');
      g.addColorStop(1, '#79a556');
    } else if (two) {
      // Talboden im Vordergrund, etwas im Schatten
      g = ctx.createLinearGradient(0, this.sy(900), 0, this.H);
      g.addColorStop(0, '#5f8c45');
      g.addColorStop(1, '#2f4f25');
    } else {
      g = ctx.createLinearGradient(0, this.sy(480), 0, this.H);
      g.addColorStop(0, '#79a556');
      g.addColorStop(1, '#466e33');
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = two && lane === 0 ? 'rgba(255,240,200,0.55)' : 'rgba(30,50,25,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach((y, i) => (i ? ctx.lineTo(i * step, y) : ctx.moveTo(0, y)));
    ctx.stroke();
    if (two && lane === 1) {
      // Fluss im Talboden
      ctx.strokeStyle = 'rgba(140,195,235,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach((y, i) => (i ? ctx.lineTo(i * step, y + 9) : ctx.moveTo(0, y + 9)));
      ctx.stroke();
    }
  }

  drawPlumb(p, w) {
    const ctx = this.ctx;
    const x = this.sx(p.x), y0 = this.sy(p.z) + 6, y1 = this.sy(w.groundAt(p.x, p.l));
    if (y1 - y0 < 8) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(x, y1, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawMarks(s, o) {
    const ctx = this.ctx, w = s.world;
    const front = w.laneCount - 1;
    // Kilometermarken
    ctx.font = '600 11px "Saira Semi Condensed", system-ui, sans-serif';
    ctx.textAlign = 'center';
    const km0 = Math.ceil(this.left / 1000), km1 = Math.floor((this.left + this.viewW) / 1000);
    const every = this.zoom === 2 ? 5 : this.zoom === 1 ? 2 : 1;
    for (let k = km0; k <= km1; k++) {
      const x = this.sx(k * 1000), y = this.sy(w.groundAt(k * 1000, front));
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - (k % 5 ? 5 : 10)); ctx.stroke();
      if (k > 0 && k % every === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(k + ' km', x, y + 15);
      }
    }
    // Startplatz und Bestweite
    this.flag(0, w.ground(0), '#ffffff', 'Start');
    if (o.bestMark > 200) this.flag(o.bestMark, w.groundAt(o.bestMark, front), '#ffcf3a', 'Bestweite');
    if (o.ghostBest > 200) this.flag(o.ghostBest, w.groundAt(o.ghostBest, front), '#b9c7ff', 'Rekord');
  }

  flag(x, z, color, label) {
    const ctx = this.ctx, px = this.sx(x), py = this.sy(z);
    if (px < -40 || px > this.W + 40) return;
    ctx.strokeStyle = 'rgba(20,30,40,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 26); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(px, py - 26); ctx.lineTo(px + 13, py - 22); ctx.lineTo(px, py - 18); ctx.fill();
    ctx.font = '600 10px "Saira Semi Condensed", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(label, px + 3, py - 30);
  }

  drawBirds(s) {
    const ctx = this.ctx, w = s.world, base = w.baseMSL(s.t);
    ctx.strokeStyle = 'rgba(25,30,40,0.85)';
    ctx.lineWidth = 1.3;
    for (const th of w.thermals) {
      if (!th.birds || w.strength(th, s.t) < 1) continue;
      const span = Math.max(100, base - th.gz - 250);
      for (let k = 0; k < 3; k++) {
        const z = th.gz + 120 + ((s.t * 1.2 + k * 260 + th.id * 37) % span);
        const cx = w.coreX(th, z, s.t);
        if (this.sx(cx) < -50 || this.sx(cx) > this.W + 50) continue;
        const ang = s.t * 0.25 + k * 2.1;
        const x = this.sx(cx + Math.cos(ang) * 90), y = this.sy(z) + Math.sin(ang) * 3;
        const f = 3 + Math.sin(s.t * 3 + k) * 1.2;
        ctx.beginPath();
        ctx.moveTo(x - 5, y - f * 0.6); ctx.quadraticCurveTo(x - 2, y - f, x, y); ctx.quadraticCurveTo(x + 2, y - f, x + 5, y - f * 0.6);
        ctx.stroke();
      }
    }
  }

  drawTrail(p) {
    const ctx = this.ctx, tr = p.trail;
    if (tr.length < 2) return;
    ctx.lineWidth = 2;
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      const fade = 0.25 + 0.65 * (i / tr.length);
      ctx.strokeStyle = b.v > 0.2 ? `rgba(255,170,40,${fade})` : b.v < -1.5 ? `rgba(70,150,255,${fade * 0.8})` : `rgba(255,255,255,${fade * 0.6})`;
      ctx.beginPath();
      ctx.moveTo(this.sx(a.x), this.sy(a.z));
      ctx.lineTo(this.sx(b.x), this.sy(b.z));
      ctx.stroke();
    }
  }

  drawGhost(g, t) {
    const pos = g.at(t);
    if (!pos) return;
    this.ctx.globalAlpha = 0.45;
    this.glider(this.sx(pos.x), this.sy(pos.z), '#b9c7ff', pos.c ? t * 0.3 : null, 0, 'Rekordflug', false, { scale: this.laneScale(pos.l) });
    this.ctx.globalAlpha = 1;
  }

  drawPilot(p, s, isFocus) {
    const w = s.world;
    if (p.state === 'flying') {
      const off = p.circling ? Math.sin(p.phase) * 45 : 0;
      // Wende als halbe Kreisbewegung darstellen
      const phase = p.circling ? p.phase : p.turning ? Math.PI / 2 + (1 - p.turnLeft / TURN_TIME) * Math.PI * p.dir : null;
      this.glider(this.sx(p.x + off), this.sy(p.z), p.color, phase, p.bar, isFocus ? null : p.name, isFocus,
        { scale: this.laneScale(p.l), dir: p.dir });
    } else {
      const x = this.sx(p.x), y = this.sy(w.groundAt(p.x, p.l));
      if (x < -30 || x > this.W + 30) return;
      const ctx = this.ctx;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.ellipse(x - 6, y - 2, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b2733';
      ctx.fillRect(x + 2, y - 9, 3, 9);
      ctx.beginPath(); ctx.arc(x + 3.5, y - 11, 2.4, 0, Math.PI * 2); ctx.fill();
      if (!isFocus) this.label(x, y - 18, p.name, p.color);
    }
  }

  // Schirm von schräg hinten: im Geradeausflug volle Spannweite, im Kreis perspektivisch verkürzt und geneigt.
  // Piloten an der Hangkante sind weiter weg und erscheinen kleiner.
  laneScale(l = 0) { return this.cam && this.lanes > 1 ? 0.78 + 0.22 * l : 1; }

  glider(x, y, color, phase, bar, name, big, o = {}) {
    if (x < -40 || x > this.W + 40) return;
    const ctx = this.ctx;
    const S = (big ? 1.25 : 1) * (o.scale ?? 1);
    const span = 26 * S;
    let wf = 1, tilt = 0;
    if (phase != null) { wf = Math.max(0.2, Math.abs(Math.cos(phase))); tilt = Math.sin(phase) * 0.45; }
    else tilt = (0.08 + bar * 0.12) * (o.dir ?? 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    const hw = (span / 2) * wf, top = -22 * S;
    ctx.strokeStyle = 'rgba(30,35,45,0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-hw, top + 4 * S); ctx.lineTo(0, -3 * S);
    ctx.moveTo(hw, top + 4 * S); ctx.lineTo(0, -3 * S);
    ctx.moveTo(-hw * 0.4, top - 1 * S); ctx.lineTo(0, -3 * S);
    ctx.moveTo(hw * 0.4, top - 1 * S); ctx.lineTo(0, -3 * S);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-hw, top + 5 * S);
    ctx.quadraticCurveTo(0, top - 9 * S, hw, top + 5 * S);
    ctx.quadraticCurveTo(0, top - 3 * S, -hw, top + 5 * S);
    ctx.fill();
    ctx.fillStyle = '#18222c';
    ctx.beginPath(); ctx.ellipse(0, 0, 3.2 * S, 4 * S, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (name) this.label(x, y - 32 * S, name, color);
  }

  label(x, y, text, color) {
    const ctx = this.ctx;
    ctx.font = '600 11px "Saira Semi Condensed", system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(12,22,32,0.6)';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 11, w, 15, 4); ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  // ---------- Übersichtsleiste ----------
  drawMini(s, o) {
    const ctx = this.mctx, W = this.mW, H = this.mH, w = s.world;
    if (!W || !H) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    let maxX = 30000;
    for (const p of s.pilots) maxX = Math.max(maxX, p.x + 6000, p.best + 6000);
    if (o.ghostBest) maxX = Math.max(maxX, o.ghostBest + 6000);
    const x0 = -2000;
    const mx = (x) => ((x - x0) / (maxX - x0)) * W;
    const gTop = w.terrain === 'mountain' ? 2800 : 900, gBot = 350;
    const my = (z) => H - 4 - ((z - gBot) / (gTop - gBot)) * (H * 0.55);
    ctx.fillStyle = 'rgba(110,160,90,0.55)';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let px = 0; px <= W; px += 4) ctx.lineTo(px, my(w.ground(x0 + (px / W) * (maxX - x0))));
    ctx.lineTo(W, H); ctx.fill();
    // Wolken
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const th of w.thermals) {
      const c = w.cloud(th, s.t);
      if (c && c.alpha > 0.3) { ctx.beginPath(); ctx.arc(mx(c.x), 6, 1.5 + c.size * 2, 0, Math.PI * 2); ctx.fill(); }
    }
    // Kilometer
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 9px "Saira Semi Condensed", system-ui, sans-serif';
    ctx.textAlign = 'center';
    const stepKm = maxX > 80000 ? 20 : 10;
    for (let k = stepKm; k * 1000 < maxX; k += stepKm) ctx.fillText(k + '', mx(k * 1000), H - 2);
    // Sichtfenster
    if (this.cam) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(mx(this.left), 1, Math.max(4, mx(this.left + this.viewW) - mx(this.left)), H - 2);
    }
    if (o.ghost) {
      const g = o.ghost.at(s.t);
      if (g) { ctx.strokeStyle = '#b9c7ff'; ctx.beginPath(); ctx.arc(mx(g.x), H / 2, 3.5, 0, Math.PI * 2); ctx.stroke(); }
    }
    for (const p of [...s.pilots].sort((a) => (a === o.focus ? 1 : -1))) {
      ctx.fillStyle = p.color;
      const r = p === o.focus ? 4.5 : 3;
      const y = p.state === 'flying' ? H * 0.42 : H * 0.72;
      ctx.beginPath(); ctx.arc(mx(p.x), y, r, 0, Math.PI * 2); ctx.fill();
      if (p.best > 0) { ctx.fillRect(mx(p.best + p.launchX) - 0.5, H * 0.6, 1, H * 0.3); }
    }
  }
}

// Barogramm: Höhe über Strecke, Kreisen hervorgehoben, Gegner dünn dahinter.
export function drawBarogram(cv, s, player) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = s.world;
  const flights = s.pilots.flatMap((p) => (p.bestFlight ? [{ p, f: p.bestFlight }] : []));
  let maxX = 5000, maxZ = w.baseMSL(3600) + 100, minZ = Infinity;
  for (const { f } of flights) for (const q of f.track) maxX = Math.max(maxX, q.x + 500);
  for (let x = -500; x <= maxX; x += maxX / 100) minZ = Math.min(minZ, w.groundAt(x, w.laneCount - 1));
  minZ -= 50;
  const padL = 40, padB = 20;
  const mx = (x) => padL + ((x + 500) / (maxX + 500)) * (W - padL - 8);
  const my = (z) => H - padB - ((z - minZ) / (maxZ - minZ)) * (H - padB - 8);
  const css = getComputedStyle(cv);
  const ink = css.getPropertyValue('--muted').trim() || '#9fb3c4';
  ctx.font = '600 10px "Saira Semi Condensed", system-ui, sans-serif';
  ctx.fillStyle = ink;
  ctx.strokeStyle = 'rgba(160,180,200,0.15)';
  ctx.textAlign = 'right';
  const zStep = maxZ - minZ > 2000 ? 500 : 250;
  for (let z = Math.ceil(minZ / zStep) * zStep; z <= maxZ; z += zStep) {
    ctx.beginPath(); ctx.moveTo(padL, my(z)); ctx.lineTo(W - 8, my(z)); ctx.stroke();
    ctx.fillText(z + ' m', padL - 4, my(z) + 3);
  }
  ctx.textAlign = 'center';
  const kmStep = maxX > 40000 ? 10 : maxX > 15000 ? 5 : 2;
  for (let k = 0; k * 1000 <= maxX; k += kmStep) ctx.fillText(k + ' km', mx(k * 1000), H - 5);
  for (let lane = 0; lane < w.laneCount; lane++) {
    ctx.fillStyle = lane ? 'rgba(70,120,60,0.55)' : 'rgba(110,160,90,0.45)';
    ctx.beginPath(); ctx.moveTo(mx(-500), H - padB);
    for (let x = -500; x <= maxX; x += maxX / 200) ctx.lineTo(mx(x), my(w.groundAt(x, lane)));
    ctx.lineTo(mx(maxX), H - padB); ctx.fill();
  }
  for (const { p, f } of flights) {
    const me = p === player;
    ctx.lineWidth = me ? 2 : 1;
    for (let i = 1; i < f.track.length; i++) {
      const a = f.track[i - 1], b = f.track[i];
      ctx.strokeStyle = me ? (b.c ? '#ffb02e' : '#ff5470') : hexA(p.color, 0.55);
      ctx.beginPath(); ctx.moveTo(mx(a.x), my(a.z)); ctx.lineTo(mx(b.x), my(b.z)); ctx.stroke();
    }
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
