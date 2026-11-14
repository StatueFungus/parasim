import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/js/sim/world.js';

const run = (w, t1, step = 30, fn) => {
  for (let t = 0; t <= t1; t += step) {
    w.update(t);
    fn?.(t);
  }
};

test('Normales Wetter bleibt unverändert', () => {
  const w = new World({ seed: 4 });
  run(w, 3600);
  assert.equal(w.storms.length, 0);
  for (const th of w.thermals) {
    assert.ok(!th.cb);
    assert.equal(w.weatherFactor(th, 3600), 1);
  }
  assert.equal(w.shade(5000, 3600), 0);
});

test('Überentwicklung: Schauer erst ab Mittag, darunter kräftiges Sinken, daneben schwächere Bärte', () => {
  let storms = 0,
    weakened = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const w = new World({ seed, weather: 'overdev' });
    run(w, 9000, 30, (t) => {
      if (t < 3600) assert.equal(w.storms.length, 0, `kein Schauer um ${t}`);
      for (const c of w.storms) {
        if (c.s < 0.9) continue;
        storms++;
        const x = w.cloud(c.th, t).x;
        assert.ok(w.lift(x, w.baseMSL(t) - 400, t) < -1.2, 'Abwind unter dem Schauer');
        for (const th of w.thermals) {
          if (th === c.th || th.cb || (th.lane || 0) !== c.lane || Math.abs(th.sx - c.x) > 1200) continue;
          if (w.env(th, t) > 0.5) weakened += w.weatherFactor(th, t) < 0.8 ? 1 : 0;
        }
      }
    });
  }
  assert.ok(storms > 10);
  assert.ok(weakened > 0, 'Bärte neben einem Schauer werden schwächer');
});

test('Abschirmung zieht in Bändern durch und schwächt die Thermik', () => {
  const w = new World({ seed: 2, weather: 'cirrus' });
  let covered = 0;
  for (let x = 0; x < 60000; x += 100) {
    const sh = w.shade(x, 3600);
    assert.ok(sh >= 0 && sh <= 1);
    covered += sh > 0.5;
  }
  assert.ok(covered > 60 && covered < 480, `Anteil ${covered / 600}`);
  // Die Bänder wandern mit der Zeit
  let diff = 0;
  for (let x = 0; x < 60000; x += 500) diff += Math.abs(w.shade(x, 3600) - w.shade(x, 5400));
  assert.ok(diff > 5);
  run(w, 3600);
  for (const th of w.thermals) assert.ok(Math.abs(w.weatherFactor(th, 3600) - (1 - 0.4 * w.shade(th.sx, 3600))) < 1e-9);
});

test('Inversion senkt die Basis um 400 m', () => {
  const a = new World({ seed: 1 }),
    b = new World({ seed: 1, weather: 'inversion' });
  assert.equal(a.baseMSL(3600) - b.baseMSL(3600), 400);
});

test('Lee: bei Wind sinkt es hinter Kuppen stärker und ruppig, im Flachland nicht', () => {
  const calm = new World({ seed: 3, terrain: 'mountain', wind: 0 });
  const windy = new World({ seed: 3, terrain: 'mountain', wind: 25 });
  let lee = 0,
    rough = 0;
  for (let x = 2000; x < 40000; x += 60) {
    const z = windy.ground(x) + 150;
    assert.equal(calm.ridge(x, z, 100), 0);
    if (windy.leeAt(x, z) > 0.4) {
      lee++;
      const r1 = windy.ridge(x, z, 100),
        r2 = windy.ridge(x, z, 160);
      if (Math.abs(r1 - r2) > 0.3) rough++;
    }
  }
  assert.ok(lee > 20, 'es gibt Leehänge');
  assert.ok(rough > 5, 'im Lee ist es ruppig');
  const flat = new World({ seed: 3, terrain: 'flat', wind: 25 });
  assert.equal(flat.ridge(5000, flat.ground(5000) + 100, 0), 0);
  assert.equal(flat.leeAt(5000, flat.ground(5000) + 100), 0);
});
