import { mulberry32, hash, noise2, fbm, clamp, smoothstep } from './rng.js';

// Simulationszeit in Sekunden ab Rundenbeginn; Rundenbeginn ist 11:30 Uhr.
export const DAY_START = 11.5 * 3600;
export const DAY_LEN = 7200;

export class World {
  constructor(o = {}) {
    this.seed = (o.seed ?? 1) >>> 0;
    this.terrain = o.terrain || 'flat';
    this.windKmh = o.wind || 0;
    this.windMs = this.windKmh / 3.6;
    this.quality = o.quality ?? 1;
    this.clouds = o.clouds || 'cumulus';
    this.dayLen = o.dayLen || DAY_LEN;
    // Fluglinien: 0 = sonnige Hangkante, 1 = Talmitte (nur im Gebirge)
    this.laneCount = this.terrain === 'mountain' ? 2 : 1;
    this.sources = [];
    this.gen = [];
    for (let lane = 0; lane < this.laneCount; lane++) {
      const r = mulberry32(hash(this.seed, lane ? 'f' + lane : 'f0'))();
      this.gen.push({ fwd: { x: 350 + 500 * r + lane * 700, i: 0 }, back: { x: -900 - lane * 500, i: -1 } });
    }
    this.thermals = [];
    this.nextId = 1;
    this.launchX = 0;
    this.launchBump = 0;
    if (this.terrain === 'mountain') {
      let hi = 0;
      for (let x = -300; x <= 2500; x += 50) hi = Math.max(hi, this.mtnBase(x));
      this.launchH = Math.max(1650, hi + 200);
      this.launchBump = this.launchH - this.mtnBase(0);
    }
    this.launchGround = this.ground(0);
    this.launchZ = this.terrain === 'mountain'
      ? this.launchGround + 25
      : this.launchGround + (o.towHeight ?? 600);
    this.ensure(-6000, 30000);
    for (const def of o.extraThermals || []) this.addThermal(def);
  }

  // ---------- Gelände ----------
  // Boden an der seitlichen Position l (0 = Hangkante, 1 = Talmitte, dazwischen der Hang)
  groundAt(x, l = 0) {
    if (l <= 0 || this.laneCount === 1) return this.ground(x);
    return this.ground(x) * (1 - l) + this.valley(x) * l;
  }

  valley(x) {
    const v = 470 + 0.22 * (this.mtnBase(x) - 620) + 50 * (noise2(this.seed + 17, x / 1800, 0.4) - 0.5);
    return Math.min(this.ground(x) - 250, v);
  }

  ground(x) {
    if (this.terrain === 'mountain') {
      const g = this.mtnBase(x) + this.launchBump * Math.exp(-((x / 900) ** 2));
      if (x <= 0) return g;
      // Vor dem Startplatz fällt das Gelände sicher ab, sonst prallt man direkt nach dem Start in den Hang.
      const w = 1 - smoothstep(3000, 5000, x);
      return g * (1 - w) + Math.min(g, this.launchH - 40 - 0.2 * x) * w;
    }
    return 420 + 40 * (fbm(this.seed + 3, x / 4000, 3) - 0.5) + 8 * (noise2(this.seed + 5, x / 350, 0.3) - 0.5);
  }

  mtnBase(x) {
    const n = fbm(this.seed + 11, x / 5200, 4);
    const m = clamp((n - 0.28) / 0.44, 0, 1);
    return 620 + 1750 * Math.pow(m, 1.4) + 90 * (noise2(this.seed + 13, x / 600, 0.7) - 0.5);
  }

  // 0..1: wie stark liegt x unter einer Wolkenstrasse
  street(x) {
    if (this.clouds !== 'streets') return 0;
    return smoothstep(0.5, 0.62, noise2(this.seed + 77, x / 9000, 3.1));
  }

  // ---------- Tagesgang ----------
  dayFactor(t) {
    const L = this.dayLen;
    const rise = smoothstep(0, 1800, t);
    const fall = 1 - 0.25 * smoothstep(L - 1800, L, t);
    return (0.3 + 0.7 * rise) * fall;
  }

  baseMSL(t) {
    const df = this.dayFactor(t);
    let b = this.terrain === 'mountain' ? 2250 + 850 * df : 1120 + 950 * df;
    if (this.clouds === 'blue') b -= 200;
    return b;
  }

  // ---------- Thermikquellen ----------
  // Hangkante: dichte, kräftige Thermik an den sonnigen Flanken. Talmitte: wenig und schwach, dafür tiefer Boden.
  makeSource(i, x, lane = 0) {
    const r = mulberry32(lane ? hash(this.seed, 's' + lane, i) : hash(this.seed, 's', i));
    let q = 0.75 + 0.5 * r();
    if (this.terrain === 'mountain') {
      q *= lane ? 0.7 : 1.05 * (0.85 + 0.75 * clamp((this.ground(x) - 650) / 1500, 0, 1));
    }
    q *= 1 + 0.25 * this.street(x);
    return { i, x, q, lane, rng: r, next: -r() * 1800 - 60 };
  }

  spacing(i, x, lane = 0) {
    const r = mulberry32(lane ? hash(this.seed, 'sp' + lane, i) : hash(this.seed, 'sp', i));
    let s = 800 + 1700 * r();
    s *= 1 - 0.35 * this.street(x);
    if (this.clouds === 'blue') s *= 1.15;
    if (this.terrain === 'mountain') s *= lane ? 1.9 : 0.85;
    return s;
  }

  ensure(xmin, xmax) {
    this.gen.forEach(({ fwd, back }, lane) => {
      while (fwd.x < xmax) {
        const i = fwd.i++;
        this.sources.push(this.makeSource(i, fwd.x, lane));
        fwd.x += this.spacing(i, fwd.x, lane);
      }
      while (back.x > xmin) {
        const i = back.i--;
        this.sources.push(this.makeSource(i, back.x, lane));
        back.x -= this.spacing(i, back.x, lane);
      }
    });
  }

  spawn(src, tb) {
    const r = src.rng;
    const w0 = (1.7 + 2.9 * Math.pow(r(), 1.4)) * src.q * this.quality;
    const life = (11 + 15 * r()) * 60;
    const rad = 100 + 120 * r() + 25 * w0;
    const gap = (1.5 + 7 * r()) * 60;
    const sx = src.x + (r() - 0.5) * 200;
    const th = {
      id: this.nextId++, sx, gz: this.groundAt(sx, src.lane), tb, life, w0, r: rad, lane: src.lane,
      seed: hash(this.seed, 'c' + src.lane, src.i, Math.round(tb)), birds: w0 > 2.6 && r() < 0.5,
    };
    src.next = tb + life + gap;
    return th;
  }

  addThermal(d) {
    this.thermals.push({
      id: this.nextId++, sx: d.x, gz: this.groundAt(d.x, d.lane ?? 0), lane: d.lane ?? 0, tb: d.tb ?? -300, life: d.life ?? 3600,
      w0: d.w0 ?? 3, r: d.r ?? 200, seed: hash(this.seed, 'x', d.x), birds: !!d.birds, fixed: true,
    });
  }

  update(t) {
    for (const src of this.sources) {
      while (src.next <= t) {
        const th = this.spawn(src, src.next);
        if (th.tb + th.life * 1.3 > t) this.thermals.push(th);
      }
    }
    if (this.thermals.some((th) => t > th.tb + th.life * 1.3)) {
      this.thermals = this.thermals.filter((th) => t <= th.tb + th.life * 1.3);
    }
  }

  // ---------- Thermik-Eigenschaften ----------
  age(th, t) { return (t - th.tb) / th.life; }

  env(th, t) {
    const a = this.age(th, t);
    if (a <= 0 || a >= 1) return 0;
    if (a < 0.2) return smoothstep(0, 0.2, a);
    if (a > 0.65) return 1 - smoothstep(0.65, 1, a);
    return 1;
  }

  // Die Thermik löst sich an einem festen Punkt am Boden ab. Die aufsteigende Luft wird vom Wind
  // versetzt, deshalb steht der Bart schräg: Versatz(h) = ∫ Wind(z) / Steigen dz.
  // Mit dem Windprofil (z/1000)^0.2 ergibt das 833 · (h/1000)^1.2 · Wind / Steigen.
  coreX(th, z, t) {
    const h = Math.max(0, z - th.gz);
    if (h <= 0) return th.sx;
    const rise = Math.max(1.8, th.w0 * this.dayFactor(t));
    let drift = this.windMs * 833.3 * Math.pow(h / 1000, 1.2);
    if (th.lane) drift += this.valleyWind(t) * Math.min(h, 600);
    return th.sx + drift / rise;
  }

  // Wie schnell der Kern auf Höhe z leewärts wandert, wenn man mit vz steigt (m/s): d coreX / dz · vz
  coreDriftRate(th, z, t, vz) {
    const h = Math.max(0, z - th.gz);
    const rise = Math.max(1.8, th.w0 * this.dayFactor(t));
    let slope = this.windMs * Math.pow(Math.max(h, 1) / 1000, 0.2);
    if (th.lane && h < 600) slope += this.valleyWind(t);
    return (slope / rise) * vz;
  }

  // 0..1: wie stark der Wind die Thermik zerreisst
  torn() { return smoothstep(18, 35, Math.abs(this.windKmh)); }

  strength(th, t) {
    let s = th.w0 * this.env(th, t) * this.dayFactor(t);
    const tf = this.torn();
    // Zerrissene Bärte: schwächer und pulsierend
    if (tf > 0) s *= 1 - 0.15 * tf - 0.45 * tf * (0.5 + 0.5 * Math.sin(t / 35 + th.id * 1.7));
    return s;
  }

  radius(th) { return th.r * (1 - 0.3 * this.torn()); }

  // In der Talmitte sinkt die Luft als Ausgleich zur Hangthermik etwas stärker.
  bgSink(x, t, l = 0) {
    const n = noise2(this.seed + 21, x / 2200, t / 700);
    let s = (0.2 + 0.6 * n) * (0.6 + 0.4 * this.dayFactor(t));
    return s * (1 - 0.7 * this.street(x)) * (1 + 0.25 * l);
  }

  // Talwind setzt am frühen Nachmittag ein und bläst talaufwärts (in Flugrichtung), aber nur in der Talmitte.
  valleyWind(t) {
    return this.laneCount > 1 ? 2.6 * smoothstep(1800, 4200, t) : 0;
  }

  // Wind auf Höhe agl über Grund: nimmt mit der Höhe zu; Talwind weht nur unterhalb der Grate.
  windAt(t, l = 0, agl = 1000) {
    const prof = clamp(Math.pow(Math.max(agl, 30) / 1000, 0.2), 0.45, 1.25);
    return this.windMs * prof + l * this.valleyWind(t) * (1 - smoothstep(400, 900, agl));
  }

  ridge(x, z) {
    if (this.terrain !== 'mountain' || !this.windMs) return 0;
    const agl = z - this.ground(x);
    if (agl > 400) return 0;
    const slope = (this.ground(x + 40) - this.ground(x - 40)) / 80;
    return this.windMs * slope * 1.6 * (1 - Math.max(0, agl) / 400);
  }

  // Vertikalbewegung der Luftmasse in m/s an der seitlichen Position l.
  // y ist der seitliche Abstand zur Bartachse beim Kreisen (die Bärte stehen auf der Flugachse y = 0).
  lift(x, z, t, l = 0, y = 0) {
    const base = this.baseMSL(t);
    let w = 0, inCore = 0;
    for (const th of this.thermals) {
      const lw = 1 - Math.abs(l - (th.lane || 0));
      if (lw <= 0.02) continue;
      const s = this.strength(th, t) * lw;
      if (s <= 0.01) continue;
      const dx = x - this.coreX(th, z, t);
      const q = (y ? Math.hypot(dx, y) : Math.abs(dx)) / this.radius(th);
      if (q > 3.2) continue;
      const core = Math.exp(-q * q);
      const ring = 0.3 * Math.exp(-(((q - 1.8) / 0.6) ** 2));
      const h = z - th.gz;
      let f = h < 80 ? 0.35 + (0.65 * Math.max(0, h)) / 80 : 1;
      const top = base - z;
      if (top < 250) f *= Math.max(0.1, top / 250);
      w += s * (core * f - ring);
      if (core > inCore) inCore = core;
    }
    return w - this.bgSink(x, t, l) * (1 - inCore) + this.ridge(x, z) * (1 - l);
  }

  nearestCore(x, z, t, lane = 0, y = 0) {
    let best = null, bq = Infinity;
    for (const th of this.thermals) {
      if ((th.lane || 0) !== lane) continue;
      const s = this.strength(th, t);
      if (s < 0.2) continue;
      const dx = x - this.coreX(th, z, t);
      const r = this.radius(th);
      const q = Math.hypot(dx, y) / r;
      if (q < bq) { bq = q; best = { dx, dy: y, r, s, th }; }
    }
    return best;
  }

  // Darstellungszustand der Wolke über einer Thermik (null = keine Wolke)
  cloud(th, t) {
    if (this.clouds === 'blue') return null;
    const a = this.age(th, t);
    if (a < 0.15 || a > 1.3) return null;
    const df = this.dayFactor(t);
    if (df < 0.45 && th.w0 * df < 0.9) return null;
    const size = a < 0.5 ? smoothstep(0.15, 0.5, a) : a < 0.85 ? 1 : 1 - 0.6 * smoothstep(0.85, 1.3, a);
    const alpha = a < 0.9 ? Math.min(1, (a - 0.15) / 0.08) : 1 - smoothstep(0.9, 1.3, a);
    return {
      x: this.coreX(th, this.baseMSL(t), t),
      lane: th.lane || 0,
      size: size * Math.sqrt(th.w0 / 2.2) * (0.5 + 0.5 * df),
      alpha,
      decay: smoothstep(0.62, 1.0, a),
    };
  }
}
