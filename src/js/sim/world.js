import { mulberry32, hash, noise2, fbm, clamp, smoothstep } from './rng.js';
import { sunAt, slopeLight } from './sun.js';

// Simulationszeit in Sekunden ab Rundenbeginn; Rundenbeginn ist 11:30 Uhr.
export const DAY_START = 11.5 * 3600;
export const DAY_LEN = 7200;
const GROW = 2; // Wachstum der Thermiksäule nach oben, als Vielfaches der Steiggeschwindigkeit
const LEAN = 0.35; // Schräglage im Wind: Kerne steigen in sich geschlossener als einzelne Luftpakete
const FLANK_X = 1500; // Hangthermik: so weit reicht die Flanke vom Gipfelbart hinunter (waagrecht, m)
const FLANK_Z = 900; // und so tief unter den Gipfel (m)
const FLANK_AGL = 300; // nur in dieser Schicht über dem Hang steigt es
const CLOUD_BOOST = 0.15; // Verstärkung kurz unter der Wolke

// Bodenbedeckung: wie gut der Boden Thermik auslöst. Über Seen gibt es keine, dafür leichtes Sinken.
export const COVER_LIFT = { field: 1.1, meadow: 0.95, forest: 0.6, village: 1.15, lake: 0, rock: 1.1 };
const COVER_MIX = {
  flat: [
    ['field', 4],
    ['meadow', 3],
    ['forest', 2],
    ['village', 1],
    ['lake', 1.1],
  ],
  hills: [
    ['meadow', 3],
    ['forest', 2.5],
    ['field', 2.5],
    ['village', 1],
    ['lake', 0.6],
  ],
  ridge: [
    ['meadow', 3],
    ['forest', 2],
  ],
  valley: [
    ['meadow', 3],
    ['field', 2],
    ['village', 1.2],
    ['forest', 1],
    ['lake', 0.6],
  ],
};
// Wie stark sich der Boden in der Sonne erwärmt; an Kanten zwischen warm und kühl lösen Bärte ab
const WARMTH = { village: 3, field: 2.5, rock: 2.5, meadow: 1.5, forest: 0.6, lake: 0 };

export class World {
  constructor(o = {}) {
    this.seed = (o.seed ?? 1) >>> 0;
    this.terrain = o.terrain || 'flat';
    this.windKmh = o.wind || 0;
    this.windMs = this.windKmh / 3.6;
    this.quality = o.quality ?? 1;
    this.clouds = o.clouds || 'cumulus';
    this.dayLen = o.dayLen || DAY_LEN;
    this.covers = [];
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
    this.launchZ =
      this.terrain === 'mountain' ? this.launchGround + 25 : this.launchGround + (o.towHeight ?? (this.terrain === 'hills' ? 750 : 600));
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
    return this.lakeFlat(x, 1, this.valleyBase(x), (u) => this.valleyBase(u));
  }

  valleyBase(x) {
    const v = 470 + 0.22 * (this.mtnBase(x) - 620) + 50 * (noise2(this.seed + 17, x / 1800, 0.4) - 0.5);
    return Math.min(this.ground(x) - 250, v);
  }

  // Boden mit Seen: Die Wasserfläche liegt waagrecht, zum Ufer hin geht das Gelände weich über.
  ground(x) {
    const g = this.groundBase(x);
    return this.terrain === 'mountain' ? g : this.lakeFlat(x, 0, g, (u) => this.groundBase(u));
  }

  groundBase(x) {
    if (this.terrain === 'mountain') {
      const g = this.mtnBase(x) + this.launchBump * Math.exp(-((x / 900) ** 2));
      if (x <= 0) return g;
      // Vor dem Startplatz fällt das Gelände sicher ab, sonst prallt man direkt nach dem Start in den Hang.
      const w = 1 - smoothstep(3000, 5000, x);
      return g * (1 - w) + Math.min(g, this.launchH - 40 - 0.2 * x) * w;
    }
    if (this.terrain === 'hills') {
      const h = 470 + 650 * Math.max(0, fbm(this.seed + 3, x / 3200, 4) - 0.3) + 25 * (noise2(this.seed + 5, x / 500, 0.3) - 0.5);
      // Der Windenplatz liegt in einer ebenen Mulde
      return h + (470 - h) * Math.exp(-((x / 700) ** 2));
    }
    return 420 + 40 * (fbm(this.seed + 3, x / 4000, 3) - 0.5) + 8 * (noise2(this.seed + 5, x / 350, 0.3) - 0.5);
  }

  lakeFlat(x, lane, g, base) {
    const c = this.coverSeg(x, lane);
    if (c.type !== 'lake') return g;
    c.level ??= Math.min(base(c.a), base(c.b), base((c.a + c.b) / 2)) - 6;
    const k = smoothstep(0, 90, Math.min(x - c.a, c.b - x));
    return g + (Math.min(g, c.level) - g) * k;
  }

  // ---------- Bodenbedeckung ----------
  // Abschnitte von 300 bis 2500 m, aus der Saat bestimmt. Lane 0 im Gebirge ist die Flanke (nur Wiese und Wald).
  coverSeg(x, lane = 0) {
    let list = this.covers[lane];
    if (!list) {
      list = this.covers[lane] = [];
      list.end = -12000;
    }
    while (list.end <= x) {
      const i = list.length;
      const r = mulberry32(hash(this.seed, 'cov' + lane, i));
      const kind = this.terrain === 'mountain' ? (lane ? 'valley' : 'ridge') : this.terrain;
      const mix = COVER_MIX[kind];
      const total = mix.reduce((n, [, w]) => n + w, 0);
      let type;
      // Kein See am Startplatz und nie zwei Seen hintereinander
      do {
        let v = r() * total;
        type = mix.find(([, w]) => (v -= w) < 0)?.[0] ?? mix[0][0];
      } while (type === 'lake' && (list.at(-1)?.type === 'lake' || (list.end < 1800 && list.end > -2800)));
      const len = type === 'lake' ? 350 + 900 * r() : type === 'village' ? 300 + 500 * r() : 500 + 2000 * r();
      list.push({ a: list.end, b: list.end + len, type });
      list.end += len;
    }
    let lo = 0,
      hi = list.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (list[m].a <= x) lo = m;
      else hi = m - 1;
    }
    return list[lo];
  }

  // Art des Bodens an x; im Gebirge oberhalb der Baumgrenze Wiese, ganz oben Fels
  coverAt(x, lane = 0) {
    const type = this.coverSeg(x, lane).type;
    if (this.terrain !== 'mountain' || lane) return type;
    const g = this.ground(x);
    return g > 2050 ? 'rock' : type === 'forest' && g > 1650 ? 'meadow' : type;
  }

  // Abrisskante: Wechsel des Untergrunds innerhalb von d Metern. Der Bart löst 40 m auf der wärmeren Seite aus,
  // umso kräftiger, je grösser der Unterschied ist. Liefert { x, boost } oder null.
  coverEdge(x, lane, d) {
    const c = this.coverSeg(x, lane);
    let best = null;
    for (const [b, inward] of [
      [c.a, 1],
      [c.b, -1],
    ]) {
      if (Math.abs(b - x) > d) continue;
      const other = this.coverSeg(b - inward, lane);
      if (other.type === c.type) continue;
      const dw = WARMTH[c.type] - WARMTH[other.type];
      if (best && Math.abs(best.b - x) < Math.abs(b - x)) continue;
      best = { b, x: dw >= 0 ? b + inward * 40 : b - inward * 40, boost: 1 + 0.06 * Math.min(3, Math.abs(dw)) };
    }
    return best;
  }

  // Hangthermik: Unter einem Gipfelbart zieht die erwärmte Luft die Flanken hinauf und sammelt sich am Gipfel.
  // Nah am Hang steigt es deshalb schon unterhalb des Grats, umso stärker, je näher man dem Gipfel kommt.
  // Liefert den Anteil 0..1 an der Stärke des Barts, ohne Rücksicht auf die Höhe über Grund.
  flankShare(th, x) {
    if (this.terrain !== 'mountain' || th.lane) return 0;
    const d = th.sx - x;
    if (Math.abs(d) > FLANK_X) return 0;
    const g = this.ground(x);
    const drop = th.gz - g;
    if (drop < 15 || drop > FLANK_Z) return 0;
    // Nur wo das Gelände zum Gipfel hin ansteigt
    if (this.ground(x + Math.sign(d) * 60) <= g) return 0;
    return 0.55 * (1 - drop / FLANK_Z) * (1 - Math.abs(d) / FLANK_X);
  }

  flankLift(th, x, z, s) {
    const share = this.flankShare(th, x);
    if (!share) return 0;
    const agl = z - this.ground(x);
    return agl < 0 || agl > FLANK_AGL ? 0 : s * share * (1 - agl / FLANK_AGL);
  }

  // Höchster Punkt im Umkreis von d Metern: Gipfel und Grate lösen Bärte aus
  peakNear(x, d) {
    let bx = x,
      bz = this.ground(x);
    for (let u = x - d; u <= x + d; u += 50) {
      const z = this.ground(u);
      if (z > bz) {
        bz = z;
        bx = u;
      }
    }
    return bx;
  }

  // Höhe gegenüber der Umgebung: positiv auf Gipfeln und Graten, negativ in Senken zwischen den Bergen
  prominence(x) {
    const g = (u) => this.ground(u);
    return g(x) - (g(x - 2500) + g(x - 1200) + g(x + 1200) + g(x + 2500)) / 4;
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
    let b = this.terrain === 'mountain' ? 2250 + 850 * df : this.terrain === 'hills' ? 1350 + 1000 * df : 1120 + 950 * df;
    if (this.clouds === 'blue') b -= 200;
    return b;
  }

  // ---------- Thermikquellen ----------
  // Hangkante: dichte, kräftige Thermik an den sonnigen Flanken. Talmitte: wenig und schwach, dafür tiefer Boden.
  // Bodenbedeckung: Waldkanten ziehen Bärte an, über Seen entsteht keine Thermik.
  makeSource(i, x, lane = 0) {
    const r = mulberry32(lane ? hash(this.seed, 's' + lane, i) : hash(this.seed, 's', i));
    let q = 0.75 + 0.5 * r();
    let edge = null,
      none = false;
    if (this.terrain === 'mountain' && !lane) {
      // Flanke: Bärte an Gipfeln und Graten, umso kräftiger, je höher; in Senken zwischen den Gipfeln schwach
      x = this.peakNear(x, 600);
      q *= (0.65 + 0.95 * clamp((this.ground(x) - 900) / 1500, 0, 1)) * clamp(1 + this.prominence(x) / 500, 0.3, 1.3);
    } else {
      edge = this.coverEdge(x, lane, 400);
      if (edge) {
        x = edge.x;
        q *= edge.boost;
      } else if (this.terrain === 'hills') x = this.peakNear(x, 400);
      if (this.terrain === 'hills') {
        q *= (0.9 + 0.35 * clamp((this.ground(x) - 470) / 400, 0, 1)) * clamp(1 + this.prominence(x) / 300, 0.6, 1.3);
      }
      // Talmitte: wenig und schwache Thermik, oft gar keine
      if (this.terrain === 'mountain') {
        q *= 0.5;
        none = r() < 0.4;
      }
    }
    q *= 1 + 0.25 * this.street(x);
    const cover = this.coverAt(x, lane);
    // Obergrenze, damit sich Höhe, Kante und Boden nicht zu Monsterbärten aufschaukeln
    q = Math.min(1.9, q * COVER_LIFT[cover]);
    return { i, x, q, lane, cover, edge: !!edge, rng: r, next: cover === 'lake' || none ? Infinity : -r() * 1800 - 60 };
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

  // Eine Quelle erzeugt eine Thermik, manchmal einen Zwilling daneben, der später mit ihr verschmelzen kann.
  spawn(src, tb) {
    const r = src.rng;
    const w0 = (1.9 + 1.7 * Math.pow(r(), 1.4)) * src.q * this.quality;
    const life = (18 + 20 * r()) * 60;
    const rad = 100 + 120 * r() + 25 * w0;
    const gap = (1.5 + 7 * r()) * 60;
    const sx = src.x + (r() - 0.5) * 200;
    const birds = w0 > 2.7 && r() < 0.35;
    const twin = r() < 0.22,
      tSide = r() < 0.5 ? -1 : 1,
      tOff = 300 + 220 * r(),
      tW = 0.75 + 0.25 * r(),
      tDelay = 150 * r();
    const out = [this.makeThermal(sx, src.lane, tb, life, w0, rad, hash(this.seed, 'c' + src.lane, src.i, Math.round(tb)), birds)];
    if (twin) {
      const tx = sx + tSide * tOff;
      out.push(
        this.makeThermal(
          tx,
          src.lane,
          tb + tDelay,
          life * 0.9,
          w0 * tW,
          rad * 0.9,
          hash(this.seed, 't' + src.lane, src.i, Math.round(tb)),
          false,
        ),
      );
    }
    src.next = tb + life + gap;
    return out;
  }

  // rs: Zeitpunkt, ab dem die Thermikblase vom Boden aufsteigt
  makeThermal(sx, lane, tb, life, w0, r, seed, birds, extra = {}) {
    const slope = (this.groundAt(sx + 150, lane) - this.groundAt(sx - 150, lane)) / 300;
    return { id: this.nextId++, sx, gz: this.groundAt(sx, lane), slope, lane, tb, rs: tb, life, w0, r, seed, birds, ...extra };
  }

  // Sonnenstand zur Rundenzeit t, für einen Zeitschritt zwischengespeichert
  sun(t) {
    if (this.sunT !== t) {
      this.sunT = t;
      this.sunNow = sunAt(DAY_START + t);
    }
    return this.sunNow;
  }

  // Im Gebirge trägt die Flanke an der Kante besser, die gerade zur Sonne zeigt; abgewandte Flanken schwächer.
  sunFactor(th, t) {
    if (this.terrain !== 'mountain' || th.lane) return 1;
    // Nur die Asymmetrie zählt: mittags tragen beide Flanken gleich
    const sun = this.sun(t),
      lit = slopeLight(sun, th.slope),
      rel = (2 * lit) / (lit + slopeLight(sun, -th.slope));
    return clamp(1 + 0.8 * (rel - 1), 0.8, 1.2);
  }

  addThermal(d) {
    this.thermals.push(
      this.makeThermal(d.x, d.lane ?? 0, d.tb ?? -300, d.life ?? 3600, d.w0 ?? 3, d.r ?? 200, hash(this.seed, 'x', d.x), !!d.birds, {
        fixed: true,
      }),
    );
  }

  update(t) {
    const dt = this.lastT == null ? 0 : Math.max(0, t - this.lastT);
    this.lastT = t;
    for (const src of this.sources) {
      while (src.next <= t) {
        for (const th of this.spawn(src, src.next)) if (th.tb + th.life * 1.3 > t) this.thermals.push(th);
      }
    }
    if (this.thermals.some((th) => t > th.tb + th.life * 1.3)) {
      this.thermals = this.thermals.filter((th) => t <= th.tb + th.life * 1.3);
    }
    if (dt > 0) this.mergeThermals(t, dt);
  }

  // Nahe Bärte ziehen sich an und verschmelzen zu einem grossen, kräftigeren Bart.
  // Ein schon verschmolzener Bart verschmilzt nicht noch einmal, sonst wächst er an einem Gipfel,
  // an dem immer wieder neue Bärte auslösen, ohne Grenze.
  mergeThermals(t, dt) {
    const list = this.thermals;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.fixed || a.merged || this.env(a, t) <= 0) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.fixed || b.merged || b.lane !== a.lane || this.env(b, t) <= 0) continue;
        const d = b.sx - a.sx,
          reach = a.r + b.r;
        if (Math.abs(d) > 0.95 * reach) continue;
        if (Math.abs(d) > 0.55 * reach) {
          const m = Math.min(Math.abs(d) / 2, 0.35 * dt) * Math.sign(d);
          a.sx += m;
          b.sx -= m;
          continue;
        }
        if (this.age(a, t) < 0.15 || this.age(b, t) < 0.15) continue;
        // Verschmelzen: Schwerpunkt nach Stärke, deutlich kräftiger und breiter, Säule steht schon
        const W = a.w0 + b.w0;
        const life = Math.max(a.tb + a.life, b.tb + b.life) - t + 600;
        const sx = (a.sx * a.w0 + b.sx * b.w0) / W;
        const m = this.makeThermal(
          sx,
          a.lane,
          t - 0.3 * life,
          life,
          Math.max(Math.min(5.5, Math.max(a.w0, b.w0) * 1.05 + 0.08 * Math.min(a.w0, b.w0)), a.w0, b.w0),
          Math.hypot(a.r, b.r) * 0.95,
          hash(this.seed, 'm', a.seed, b.seed),
          a.birds || b.birds,
          { merged: true },
        );
        m.rs = t - 4000;
        list.splice(j, 1);
        list.splice(i, 1, m);
        break;
      }
    }
  }

  // ---------- Thermik-Eigenschaften ----------
  age(th, t) {
    return (t - th.tb) / th.life;
  }

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
    const rise = this.riseSpeed(th, t);
    let drift = this.windMs * 833.3 * Math.pow(h / 1000, 1.2);
    if (th.lane) drift += this.valleyWind(t) * Math.min(h, 600);
    return th.sx + (LEAN * drift) / rise;
  }

  // Wie schnell der Kern auf Höhe z leewärts wandert, wenn man mit vz steigt (m/s): d coreX / dz · vz
  coreDriftRate(th, z, t, vz) {
    const h = Math.max(0, z - th.gz);
    const rise = this.riseSpeed(th, t);
    let slope = this.windMs * Math.pow(Math.max(h, 1) / 1000, 0.2);
    if (th.lane && h < 600) slope += this.valleyWind(t);
    return ((LEAN * slope) / rise) * vz;
  }

  // Steiggeschwindigkeit der Thermikluft, auch für Wachstum und Schräglage
  riseSpeed(th, t) {
    return Math.max(1.8, th.w0 * this.dayFactor(t));
  }

  // Die Blase wächst vom Boden nach oben bis zur Basis (bei 1500 m Säule etwa 5 Minuten).
  topZ(th, t) {
    return th.gz + GROW * this.riseSpeed(th, t) * Math.max(0, t - th.rs);
  }

  // Beim Zerfall reisst der Bart unten ab und die Unterkante steigt.
  bottomZ(th, t) {
    const td = th.tb + 0.75 * th.life;
    return t <= td ? -Infinity : th.gz + 0.5 * this.riseSpeed(th, t) * (t - td);
  }

  // Unten schmal, oben breit; ein reifer Bart ist etwas breiter als ein junger.
  radiusAt(th, z, t) {
    const h = clamp((z - th.gz) / 900, 0, 1);
    return this.radius(th) * (0.55 + 0.45 * h) * (0.85 + 0.15 * this.env(th, t));
  }

  // 0..1: wie stark der Wind die Thermik zerreisst
  torn() {
    return smoothstep(18, 35, Math.abs(this.windKmh));
  }

  strength(th, t) {
    let s = th.w0 * this.env(th, t) * this.dayFactor(t) * this.sunFactor(th, t);
    const tf = this.torn();
    // Zerrissene Bärte: schwächer und pulsierend
    if (tf > 0) s *= 1 - 0.15 * tf - 0.45 * tf * (0.5 + 0.5 * Math.sin(t / 35 + th.id * 1.7));
    return s;
  }

  radius(th) {
    return th.r * (1 - 0.3 * this.torn());
  }

  // In der Talmitte sinkt die Luft als Ausgleich zur Hangthermik etwas stärker.
  bgSink(x, t, l = 0) {
    const n = noise2(this.seed + 21, x / 2200, t / 700);
    const s = (0.2 + 0.6 * n) * (0.6 + 0.4 * this.dayFactor(t));
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
    let w = 0,
      inCore = 0;
    for (const th of this.thermals) {
      const lw = 1 - Math.abs(l - (th.lane || 0));
      if (lw <= 0.02) continue;
      const s = this.strength(th, t) * lw;
      if (s <= 0.01) continue;
      const top = this.topZ(th, t),
        bot = this.bottomZ(th, t);
      // Unter dem Auslösepunkt gibt es noch keine Säule (auch keinen Sinkring), am Gipfel aber die Hangthermik
      if (z < th.gz - 30) {
        if (bot === -Infinity) w += this.flankLift(th, x, z, s);
        continue;
      }
      if (z > top + 80 || z < bot - 80) continue;
      const dx = x - this.coreX(th, z, t);
      const q = (y ? Math.hypot(dx, y) : Math.abs(dx)) / this.radiusAt(th, z, t);
      if (q > 3.2) continue;
      const core = Math.exp(-q * q);
      const ring = 0.3 * Math.exp(-(((q - 1.8) / 0.6) ** 2));
      const h = z - th.gz;
      let f = h < 80 ? 0.35 + (0.65 * Math.max(0, h)) / 80 : 1;
      f *= smoothstep(top + 80, top - 40, z);
      if (bot > -Infinity) f *= smoothstep(bot - 80, bot + 40, z);
      // Unter der Wolke wird es stärker (Kondensationswärme), bei Blauthermik bremst die Inversion.
      if (this.clouds !== 'blue') f *= 1 + CLOUD_BOOST * smoothstep(base - 450, base - 40, z);
      else if (base - z < 250) f *= Math.max(0.15, (base - z) / 250);
      w += s * (core * f - ring);
      if (core > inCore) inCore = core;
    }
    return w - (this.bgSink(x, t, l) + this.lakeSink(x, z, l)) * (1 - inCore) + this.ridge(x, z) * (1 - l);
  }

  // Über Seen ist die Luft kühl und stabil: tief leichtes Sinken, das mit der Höhe abklingt
  lakeSink(x, z, l = 0) {
    const lane = this.laneCount > 1 && l > 0.5 ? 1 : 0;
    if (this.coverSeg(x, lane).type !== 'lake') return 0;
    const agl = z - this.groundAt(x, l);
    return agl < 900 ? 0.35 * (1 - agl / 900) : 0;
  }

  nearestCore(x, z, t, lane = 0, y = 0) {
    let best = null,
      bq = Infinity;
    for (const th of this.thermals) {
      if ((th.lane || 0) !== lane) continue;
      const s = this.strength(th, t);
      if (s < 0.2) continue;
      if (z > this.topZ(th, t) + 40 || z < this.bottomZ(th, t) - 40) continue;
      const dx = x - this.coreX(th, z, t);
      const r = this.radiusAt(th, z, t);
      const q = Math.hypot(dx, y) / r;
      if (q < bq) {
        bq = q;
        best = { dx, dy: y, r, s, th };
      }
    }
    return best;
  }

  // Darstellungszustand der Wolke über einer Thermik (null = keine Wolke).
  // Die Wolke entsteht erst, wenn die Blase die Basis erreicht, und wächst dann einige Minuten.
  cloud(th, t) {
    if (this.clouds === 'blue') return null;
    const a = this.age(th, t);
    if (a > 1.3) return null;
    const base = this.baseMSL(t);
    const reach = th.rs + (base - th.gz) / (GROW * this.riseSpeed(th, t));
    const ca = t - reach;
    if (ca <= 0) return null;
    const df = this.dayFactor(t);
    if (df < 0.45 && th.w0 * df < 0.9) return null;
    const size = smoothstep(0, 300, ca) * (a < 0.85 ? 1 : 1 - 0.6 * smoothstep(0.85, 1.3, a));
    const alpha = Math.min(1, ca / 40) * (a < 0.9 ? 1 : 1 - smoothstep(0.9, 1.3, a));
    return {
      x: this.coreX(th, base, t),
      lane: th.lane || 0,
      size: size * Math.sqrt(th.w0 / 2.2) * Math.sqrt(th.r / 210) * (0.5 + 0.5 * df),
      alpha,
      decay: smoothstep(0.62, 1.0, a),
    };
  }
}
