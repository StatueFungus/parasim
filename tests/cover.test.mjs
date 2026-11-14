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

test('Waldkanten ziehen Bärte auf die offene Seite', () => {
  let edges = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const w = new World({ seed, terrain: 'hills' });
    for (const src of w.sources) {
      if (!src.edge) continue;
      edges++;
      assert.notEqual(src.cover, 'forest');
      const near = [src.x - 60, src.x + 60].map((x) => w.coverAt(x, src.lane));
      assert.ok(near.includes('forest'), 'Wald gleich daneben');
    }
  }
  assert.ok(edges > 10);
});
