import { GLIDERS, speedFor, sinkFor, circleSink, circleSinkR, bestBar, R_DEFAULT } from './gliders.js';

export const TURN_TIME = 7;      // Flugsekunden für eine 180°-Wende
// Kurvenschieber beim Kreisen: steer = −1 (enge Rechtskurve) … 0 (geradeaus) … +1 (enge Linkskurve).
// Radius = R_TIGHT / |steer|; zu Beginn eine moderate Kurve von etwa 40 m.
export const R_TIGHT = 25;
export const STEER_START = 0.62;
export const LANE_TIME = 55;     // Flugsekunden für den Wechsel Hangkante ↔ Talmitte
export const LANE_NAMES = ['Hangkante', 'Talmitte'];

// state: ready (am Startplatz) | flying | landed | walking (Aufstieg nach Aussenlandung) | done
export class Pilot {
  constructor(o) {
    this.id = o.id;
    this.name = o.name;
    this.color = o.color;
    this.glider = GLIDERS[o.glider] || GLIDERS['EN-B'];
    this.brain = o.brain || null;
    this.isPlayer = !!o.isPlayer;
    this.state = 'ready';
    this.x = 0; this.z = 0; this.launchX = 0;
    this.v = this.glider.vTrim;
    this.bar = 0;
    this.mc = o.mc ?? 1;
    this.circling = false;
    this.wantCircle = false;
    this.dir = 1;          // +1 auf Kurs, −1 zurück
    this.turnLeft = 0;     // verbleibende Wendezeit
    this.lane = 0;         // Ziel-Linie
    this.l = 0;            // tatsächliche seitliche Position 0..1
    this.vz = 0; this.vario = 0; this.air = 0; this.netto = 0; this.phase = 0;
    // Kreisen: Kurs heading (0 = Flugrichtung +x, positiv = nach links), Schieber steer, Radius R;
    // y ist der seitliche Abstand zur Bartachse, (cx, cy) der momentane Kreismittelpunkt.
    // centering: 'auto' | 'assist' | 'pro'; autoOffset: bis auf welchen Bruchteil des Bartradius die Automatik zentriert.
    this.centering = o.centering || 'auto';
    this.autoOffset = o.autoOffset ?? 0.5;
    this.heading = 0; this.steer = STEER_START; this.lastSteerSign = 1;
    this.R = R_DEFAULT;
    this.cx = 0; this.cy = 0; this.y = 0; this.drift = 0;
    this.best = 0;
    this.bestFlight = null;
    this.flights = [];
    this.trail = [];
    this.walkUntil = 0;
    this.flight = null;
  }

  get dist() { return Math.max(0, this.x - this.launchX); }
  get turning() { return this.turnLeft > 0; }
  get manual() { return this.centering !== 'auto'; }

  setSteer(v) { this.steer = Math.max(-1, Math.min(1, v)); }

  score() { return Math.max(this.best, this.state === 'flying' ? this.dist : 0); }

  // Wende einleiten: dir = +1 (auf Kurs) oder −1 (zurück)
  turn(dir) {
    if (this.state !== 'flying' || this.circling || this.turning || dir === this.dir) return false;
    this.turnLeft = TURN_TIME;
    this.dir = dir;
    return true;
  }

  setLane(lane, world) {
    if (lane < 0 || lane >= world.laneCount) return false;
    this.lane = lane;
    return true;
  }

  launch(world, t) {
    this.state = 'flying';
    this.x = this.launchX = world.launchX;
    this.z = world.launchZ;
    this.v = this.glider.vTrim;
    this.circling = this.wantCircle = false;
    this.dir = 1; this.turnLeft = 0;
    this.lane = 0; this.l = 0;
    this.vz = this.vario = 0;
    this.y = 0;
    this.netto = world.lift(this.x, this.z, t);
    this.trail = [];
    this.flight = {
      launchT: t, track: [{ t, x: this.x, z: this.z, c: 0, l: 0 }],
      circT: 0, glideT: 0, gain: 0, thermals: 0, maxZ: this.z, best30: 0, turns: 0, laneT: [0, 0],
      circStart: null, lastSample: t, lastTrail: t, dist: 0,
    };
  }

  step(world, dt, t) {
    if (this.state !== 'flying') return;
    const g = this.glider;
    const f = this.flight;
    const air = world.lift(this.x, this.z, t, this.l, this.circling ? this.y : 0);
    const wind = world.windAt(t, this.l, this.z - world.groundAt(this.x, this.l));
    this.air = air;
    this.netto += (air - this.netto) * Math.min(1, dt / 4);
    this.drift += wind * dt;   // Versatz der Luftmasse, damit der Thermik-Assistent im mitfliegenden Bezugssystem zeichnen kann

    if (this.wantCircle && !this.circling && !this.turning) this.startCircle(world, t);
    else if (this.circling && !this.wantCircle) { this.circling = false; this.endCircle(t); }

    let vz;
    if (this.circling) {
      // Drehrate aus dem Schieber; enge Kurven kosten mehr Sinken, geradeaus fliegt man mit Trimm.
      const a = Math.abs(this.steer);
      const vms = this.v / 3.6;
      this.R = a > 0.02 ? R_TIGHT / a : Infinity;
      this.heading += (this.steer * vms / R_TIGHT) * dt;
      this.x += (Math.cos(this.heading) * vms + wind) * dt;
      this.y += Math.sin(this.heading) * vms * dt;
      const sg = Math.sign(this.steer) || 1;
      this.cx = this.x - sg * Math.min(this.R, 1e4) * Math.sin(this.heading);
      this.cy = this.y + sg * Math.min(this.R, 1e4) * Math.cos(this.heading);
      if (!this.manual) this.autoCenter(world, t, dt);
      this.v += (g.vTrim - 3 * Math.min(1, a / 0.5) - this.v) * Math.min(1, dt / 3);
      const sink = Number.isFinite(this.R) ? Math.max(sinkFor(g, this.v), circleSinkR(g, this.R)) : sinkFor(g, this.v);
      vz = air - sink;
      this.phase = this.heading;
      f.circT += dt;
    } else if (this.turning) {
      // In der Wende kommt man kaum voran und verliert etwas mehr Höhe.
      this.turnLeft = Math.max(0, this.turnLeft - dt);
      if (!this.turning) f.turns++;
      this.x += wind * dt;
      this.v += (g.vTrim - this.v) * Math.min(1, dt / 3);
      vz = air - sinkFor(g, this.v) - 0.35;
      f.glideT += dt;
    } else {
      this.v += (speedFor(g, this.bar) - this.v) * Math.min(1, dt / 3);
      vz = air - sinkFor(g, this.v);
      // Beim Linienwechsel fliegt man schräg über das Tal und kommt langsamer voran.
      const crossing = Math.abs(this.lane - this.l) > 0.001;
      const along = crossing ? 0.6 : 1;
      this.x += (this.dir * along * this.v / 3.6 + wind) * dt;
      if (crossing) {
        const step = dt / LANE_TIME;
        this.l += Math.sign(this.lane - this.l) * Math.min(step, Math.abs(this.lane - this.l));
      }
      f.glideT += dt;
    }
    f.laneT[Math.round(this.l)] += dt;

    const base = world.baseMSL(t);
    if (vz > 0 && this.z + vz * dt > base - 15) vz = Math.max(0, (base - 15 - this.z) / dt);
    this.z += vz * dt;
    this.vz = vz;
    this.vario += (vz - this.vario) * Math.min(1, dt / 1.5);
    if (this.z > f.maxZ) f.maxZ = this.z;

    if (t - f.lastSample >= 4) {
      f.track.push({ t, x: this.x, z: this.z, c: this.circling ? 1 : 0, l: this.l });
      f.lastSample = t;
    }
    if (t - f.lastTrail >= 2) {
      // x ist beim Kreisen die echte Position auf dem Kreis: Die Spur zeigt die Windversetzung als Schleifen.
      this.trail.push({ x: this.x, z: this.z, v: this.vario, l: this.l });
      if (this.trail.length > 1200) this.trail.shift();
      f.lastTrail = t;
    }

    const gz = world.groundAt(this.x, this.l);
    if (this.z <= gz) { this.z = gz; this.land(t); }
  }

  // Einkreisen aus dem Geradeausflug in der aktuellen Flugrichtung, mit moderater Kurve
  // in die zuletzt geflogene Drehrichtung.
  startCircle(world, t) {
    this.circling = true;
    this.heading = this.dir > 0 ? 0 : Math.PI;
    this.y = 0;
    this.steer = STEER_START * (this.manual ? this.lastSteerSign : 1);
    this.R = R_TIGHT / Math.abs(this.steer);
    this.flight.circStart = { t, z: this.z };
  }

  // Automatik: zieht den Kreis bis auf autoOffset · Bartradius an den Kern.
  autoCenter(world, t, dt) {
    const c = world.nearestCore(this.cx, this.z, t, Math.round(this.l), this.cy);
    if (!c) return;
    const d = Math.hypot(c.dx, c.dy);
    const target = this.autoOffset * c.r;
    if (d <= target || d > 1.7 * c.r + this.R) return;
    const m = Math.min(d - target, 3.2 * this.glider.center * dt);
    const mx = -(c.dx / d) * m, my = -(c.dy / d) * m;
    this.x += mx; this.y += my; this.cx += mx; this.cy += my;
  }

  // Ausleiten: Man fliegt in die Richtung weiter, in die man gerade schaut (beim selbst Zentrieren).
  endCircle(t) {
    if (this.manual) {
      this.dir = Math.cos(this.heading) >= 0 ? 1 : -1;
      if (Math.abs(this.steer) > 0.02) this.lastSteerSign = Math.sign(this.steer);
    }
    this.y = 0;
    const f = this.flight;
    if (!f.circStart) return;
    const dz = this.z - f.circStart.z, dtc = t - f.circStart.t;
    if (dz > 0) f.gain += dz;
    if (dz >= 200) f.thermals++;
    if (dtc >= 30 && dz / dtc > f.best30) f.best30 = dz / dtc;
    f.circStart = null;
  }

  closeFlight(t) {
    if (this.circling) { this.circling = this.wantCircle = false; this.endCircle(t); }
    const f = this.flight;
    f.track.push({ t, x: this.x, z: this.z, c: 0, l: this.l });
    f.dist = this.dist;
    f.endT = t;
    this.flights.push(f);
    if (f.dist >= this.best) { this.best = f.dist; this.bestFlight = f; }
  }

  land(t) {
    this.closeFlight(t);
    this.flight.landed = true;
    this.state = 'landed';
    this.vz = this.vario = 0;
    this.turnLeft = 0;
  }

  finish(t) {
    if (this.state === 'flying') this.closeFlight(t);
    this.state = 'done';
  }
}

// Computerpilot: fliegt Sollfahrt nach MacCready, entscheidet wann er kreist,
// wählt im Gebirge die Linie und fliegt notfalls zu einem verpassten Bart zurück.
export class Brain {
  constructor(o) {
    this.mc = o.mc;
    this.skill = o.skill;
    this.launchAt = o.launchAt;
    this.maxRestarts = o.maxRestarts ?? 2;
    this.restarts = 0;
    this.prev = 0;
    this.hist = [];
    this.circT0 = 0;
    this.noCircleUntil = 0;
    this.laneLock = 0;
    this.missed = null;     // { x, t } Steigen, das wir überflogen haben
    this.returning = false;
  }

  think(p, world, t, dt, session) {
    if (p.state === 'ready') { if (t >= this.launchAt) session.launch(p); return; }
    if (p.state === 'landed') {
      if (this.restarts < this.maxRestarts && session.remaining() > session.penalty + 1500) {
        this.restarts++;
        this.missed = null;
        this.returning = false;
        session.restart(p);
      }
      return;
    }
    if (p.state !== 'flying') return;

    const g = p.glider;
    const agl = p.z - world.groundAt(p.x, p.l);
    const base = world.baseMSL(t);
    const cs = circleSink(g);
    let mc = this.mc;
    if (agl < 700) mc *= 0.3 + (0.7 * Math.max(0, agl - 300)) / 400;

    if (world.laneCount > 1) this.chooseLane(p, world, t);

    if (p.circling) {
      this.hist.push({ t, z: p.z });
      while (t - this.hist[0].t > 45) this.hist.shift();
      const span = t - this.hist[0].t;
      const avg = span > 5 ? (p.z - this.hist[0].z) / span : 1;
      const inT = t - this.circT0;
      const nearTop = p.z > base - (60 + 120 * this.skill * Math.min(1, this.mc / 2));
      const weak = inT > 50 && avg < mc * (0.35 + 0.4 * this.skill);
      const sinking = inT > 40 && avg < -0.2;
      if (nearTop || weak || sinking) {
        p.wantCircle = false;
        this.noCircleUntil = t + 25;
        this.missed = null;
        this.returning = false;
      }
      return;
    }
    if (p.turning) return;
    // Nach dem Bart (oder wenn die Rückkehr abgebrochen ist) wieder auf Kurs gehen.
    if (p.dir === -1 && !this.returning) { p.turn(1); return; }

    p.bar = bestBar(g, mc, p.netto * this.skill, world.windAt(t, p.l, agl) * p.dir);
    if (this.skill < 0.5) p.bar = Math.min(p.bar, 0.3);
    if (this.returning) p.bar = 0;
    const need = cs + mc * 0.75 * this.skill + (agl < 350 ? -0.25 : 0.15);
    const passedPeak = this.skill < 0.5 || p.air < this.prev - 0.005;
    if (t > this.noCircleUntil && p.air > need && passedPeak && p.z < base - 120) {
      p.wantCircle = true;
      this.circT0 = t;
      this.hist = [{ t, z: p.z }];
    } else if (p.air > cs + 0.4 && p.dir === 1 && t > this.noCircleUntil) {
      // Gutes Steigen, das wir gerade nicht nutzen (nicht der Bart, den wir eben verlassen haben): merken.
      if (!this.missed || p.air > this.missed.air) this.missed = { x: p.x, t, air: p.air };
    }
    this.prev = p.air;

    // Zurück zum Bart: nur gute Piloten, nur wenn es tief wird und das Steigen nah genug hinter uns liegt.
    if (this.skill >= 0.75 && p.dir === 1 && this.missed && agl > 200 && agl < 500 && p.air < 0) {
      const back = p.x - this.missed.x;
      if (t - this.missed.t < 90 && back > 200 && back < 650) { p.turn(-1); this.returning = true; }
      else if (t - this.missed.t >= 120) this.missed = null;
    }
    if (this.returning && p.dir === -1 && this.missed && p.x < this.missed.x - 350) {
      // Den Bart nicht wiedergefunden: wieder auf Kurs.
      this.returning = false;
      this.missed = null;
    }
  }

  // Erfahrene Piloten nutzen die sonnige Hangkante, solange genug Höhe über dem Grat ist; tief geht es ins Tal.
  chooseLane(p, world, t) {
    if (t < this.laneLock || p.circling) return;
    const overRidge = p.z - world.ground(p.x);
    let want = p.lane;
    if (this.skill < 0.5) want = 1;
    else if (overRidge > (this.skill > 0.8 ? 280 : 450)) want = 0;
    else if (overRidge < 150) want = 1;
    if (want !== p.lane) { p.setLane(want, world); this.laneLock = t + 120; }
  }
}
