import { World } from './world.js';
import { Pilot, Brain } from './pilot.js';
import { mulberry32, hash } from './rng.js';

// Gegnerfeld: Reihenfolge = Reihenfolge, in der Bots hinzukommen.
export const BOT_ROSTER = [
  { name: 'Mara', mc: 1.5, skill: 1.0, color: '#2fb47c', tag: 'Profi' },
  { name: 'Jonas', mc: 0.3, skill: 0.25, color: '#9a7cf0', tag: 'Anfänger' },
  { name: 'Lia', mc: 1.0, skill: 0.85, color: '#f0c419', tag: 'MC 1.0' },
  { name: 'Theo', mc: 0.5, skill: 0.75, color: '#3fa7e0', tag: 'MC 0.5' },
  { name: 'Nora', mc: 2.5, skill: 0.9, color: '#ef6aa8', tag: 'MC 2.5' },
  { name: 'Ben', mc: 2.0, skill: 0.85, color: '#ff8f3a', tag: 'MC 2.0' },
  { name: 'Sami', mc: 1.2, skill: 0.6, color: '#7fd1c7', tag: 'Fortgeschritten' },
];

export class Session {
  constructor(cfg) {
    this.cfg = cfg;
    this.world = new World(cfg.world);
    this.tStart = cfg.tStart ?? 0;
    this.t = this.tStart;
    this.tEnd = this.tStart + cfg.duration;
    this.rate = cfg.rate ?? 10;
    this.penalty = cfg.penalty ?? 0;
    this.ended = false;
    this.pilots = [];
    this.world.update(this.t);
  }

  add(p) {
    p.launchX = p.x = this.world.launchX;
    p.z = this.world.launchGround;
    this.pilots.push(p);
    return p;
  }

  addBots(n, glider) {
    const rng = mulberry32(hash(this.world.seed, 'bots'));
    // Wer später am Tag beginnt, findet schon entwickelte Thermik vor; dann warten auch die Bots kaum noch.
    const wait = 1 - 0.85 * Math.min(1, this.tStart / 1800);
    for (let i = 0; i < n && i < BOT_ROSTER.length; i++) {
      const b = BOT_ROSTER[i];
      const launchAt = this.tStart + wait * (b.skill > 0.8 ? 1200 + 900 * rng() : 300 + 1500 * rng());
      this.add(
        new Pilot({
          id: 'bot' + i,
          name: b.name,
          tag: b.tag,
          color: b.color,
          glider,
          brain: new Brain({ mc: b.mc, skill: b.skill, launchAt }),
          autoOffset: 0.55 - 0.45 * b.skill,
        }),
      ).tag = b.tag;
    }
  }

  launch(p) {
    if (p.state === 'ready' && !this.ended) p.launch(this.world, this.t);
  }

  restart(p) {
    if (p.state !== 'landed' || this.ended) return;
    p.x = this.world.launchX;
    p.z = this.world.launchGround;
    p.trail = [];
    if (this.penalty > 0) {
      p.state = 'walking';
      p.walkUntil = this.t + this.penalty;
    } else p.state = 'ready';
  }

  remaining() {
    return this.tEnd - this.t;
  }

  step(simDt) {
    let left = simDt;
    while (left > 1e-6 && !this.ended) {
      const h = Math.min(1, left);
      this.world.update(this.t);
      for (const p of this.pilots) {
        if (p.state === 'walking' && this.t >= p.walkUntil) p.state = 'ready';
        if (p.brain) p.brain.think(p, this.world, this.t, h, this);
        p.step(this.world, h, this.t);
      }
      this.t += h;
      left -= h;
      if (this.t >= this.tEnd) this.end();
    }
    let maxX = 0;
    for (const p of this.pilots) maxX = Math.max(maxX, p.x);
    this.world.ensure(-6000, maxX + 30000);
  }

  update(realDt) {
    this.step(realDt * this.rate);
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    for (const p of this.pilots) p.finish(this.t);
  }

  standings() {
    return [...this.pilots].sort((a, b) => b.score() - a.score());
  }
}
