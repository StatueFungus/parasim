import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, COVER_LIFT } from '../src/js/sim/world.js';

const TERRAINS = ['flat', 'hills', 'mountain'];

test('Bodenbedeckung ist aus der Saat bestimmt und lückenlos', () => {
  for (const terrain of TERRAINS) {
    const a = new World({ seed: 9, terrain }),
      b = new World({ seed: 9, terrain });
    for (let lane = 0; lane < a.laneCount; lane++) {
      for (let x = -5000; x < 40000; x += 173) {
        assert.equal(a.coverAt(x, lane), b.coverAt(x, lane));
        const c = a.coverSeg(x, lane);
        assert.ok(c.a <= x && x < c.b, `${terrain} x=${x} liegt im Abschnitt`);
        assert.ok(a.coverAt(x, lane) in COVER_LIFT);
      }
    }
  }
});

test('Am Startplatz liegt kein See, an der Gebirgsflanke nie', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const terrain of TERRAINS) {
      const w = new World({ seed, terrain });
      for (let x = -1400; x < 1700; x += 50) assert.notEqual(w.coverAt(x, 0), 'lake', `${terrain} seed ${seed} x=${x}`);
    }
    const m = new World({ seed, terrain: 'mountain' });
    for (let x = 0; x < 30000; x += 200) assert.notEqual(m.coverAt(x, 0), 'lake');
  }
});

test('Über Seen entsteht keine Thermik, der Wasserspiegel ist eben und tief sinkt es', () => {
  let lakes = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const w = new World({ seed, terrain: 'flat' });
    for (const src of w.sources) if (src.cover === 'lake') assert.equal(src.next, Infinity);
    for (let x = 2000; x < 30000; x += 100) {
      const c = w.coverSeg(x, 0);
      if (c.type !== 'lake' || c.b - c.a < 300) continue;
      lakes++;
      const mid = (c.a + c.b) / 2;
      assert.ok(Math.abs(w.ground(mid) - w.ground(mid + 60)) < 0.01, 'Wasserspiegel eben');
      assert.ok(w.lakeSink(mid, w.ground(mid) + 100) > 0.2);
      assert.equal(w.lakeSink(mid, w.ground(mid) + 1000), 0);
      x = c.b;
    }
  }
  assert.ok(lakes > 5, 'es gibt Seen');
});

test('Bärte lösen an Kanten zwischen Untergründen aus, auf der wärmeren Seite', () => {
  const warmth = { village: 3, field: 2.5, rock: 2.5, meadow: 1.5, forest: 0.6, lake: 0 };
  let edges = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const w = new World({ seed, terrain: 'flat' });
    for (const src of w.sources) {
      if (!src.edge) continue;
      edges++;
      const here = w.coverAt(src.x, src.lane);
      const near = [src.x - 80, src.x + 80].map((x) => w.coverAt(x, src.lane));
      const other = near.find((t) => t !== here);
      assert.ok(other, 'eine Kante gleich daneben');
      assert.ok(warmth[here] >= warmth[other], `${here} ist wärmer als ${other}`);
    }
  }
  assert.ok(edges > 30);
});

test('Im Gebirge: Bärte auf Gipfeln und Graten kräftiger als in Senken, die Talmitte trägt kaum', () => {
  const peak = [],
    low = [];
  let valley = 0,
    valleyNone = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const w = new World({ seed, terrain: 'mountain' });
    for (const src of w.sources) {
      if (src.x < 2000) continue;
      if (src.lane === 1) {
        valley++;
        if (src.next === Infinity) valleyNone++;
        continue;
      }
      // Der Bart sitzt auf dem höchsten Punkt seiner Umgebung
      assert.ok(w.ground(src.x) >= w.ground(src.x + 50) - 1e-6 || w.ground(src.x) >= w.ground(src.x - 50) - 1e-6);
      (w.prominence(src.x) > 150 ? peak : w.prominence(src.x) < -50 ? low : []).push(src.q);
    }
  }
  const mean = (a) => a.reduce((n, v) => n + v, 0) / a.length;
  assert.ok(peak.length > 10 && low.length > 5);
  assert.ok(mean(peak) > 1.5 * mean(low), `Gipfel ${mean(peak).toFixed(2)} gegen Senke ${mean(low).toFixed(2)}`);
  assert.ok(valleyNone / valley > 0.25, 'in der Talmitte bleibt oft ganz ohne Thermik');
});
