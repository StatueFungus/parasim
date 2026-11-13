import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/js/sim/world.js';

const VARIANTS = [
  { terrain: 'flat', wind: 0, clouds: 'cumulus' },
  { terrain: 'flat', wind: 20, clouds: 'streets' },
  { terrain: 'flat', wind: -15, clouds: 'blue' },
  { terrain: 'mountain', wind: 10, clouds: 'cumulus' },
];

test('Auftrieb ist überall eine endliche Zahl', () => {
  for (const v of VARIANTS) {
    const w = new World({ seed: 11, ...v });
    for (let t = 0; t <= 7200; t += 600) {
      w.update(t);
      for (let x = -3000; x <= 25000; x += 137) {
        for (let l = 0; l < w.laneCount; l++) {
          for (const agl of [10, 300, 900, 1600]) {
            const z = w.groundAt(x, l) + agl;
            assert.ok(Number.isFinite(w.lift(x, z, t, l, 0)), `lift ${JSON.stringify(v)} x=${x} z=${z} t=${t}`);
            assert.ok(Number.isFinite(w.lift(x, z, t, l, 35)), 'lift mit seitlichem Versatz');
          }
        }
      }
    }
  }
});

test('Gleiche Saat ergibt denselben Tag', () => {
  const a = new World({ seed: 42 }), b = new World({ seed: 42 });
  for (let t = 0; t <= 3600; t += 60) { a.update(t); b.update(t); }
  for (let x = 0; x < 20000; x += 250) assert.equal(a.lift(x, 1200, 3600), b.lift(x, 1200, 3600));
});

test('Die Säule wächst von unten nach oben, die Wolke kommt erst an der Basis', () => {
  const w = new World({ seed: 3, quality: 0.01 });
  w.thermals = [];
  w.update = () => {};
  w.addThermal({ x: 1000, w0: 3, r: 200, tb: 2000, life: 2400 });
  const th = w.thermals[0];
  th.rs = th.tb;
  assert.ok(w.topZ(th, 2060) < w.topZ(th, 2300));
  assert.equal(w.cloud(th, 2060), null, 'junge Thermik hat noch keine Wolke');
  assert.ok(w.cloud(th, 2900), 'nach Erreichen der Basis entsteht eine Wolke');
});

test('Bärte werden mit der Höhe breiter und unter der Wolke nicht schwächer', () => {
  const w = new World({ seed: 3, quality: 0.01 });
  w.thermals = [];
  w.addThermal({ x: 1000, w0: 3, r: 200, tb: -3000, life: 9000 });
  const th = w.thermals[0];
  const t = 3600, base = w.baseMSL(t);
  assert.ok(w.radiusAt(th, base - 100, t) > w.radiusAt(th, th.gz + 50, t));
  const core = (z) => w.lift(w.coreX(th, z, t), z, t);
  assert.ok(core(base - 60) >= core(base - 700), 'kurz unter der Basis mindestens so stark wie weiter unten');
});

test('Wind versetzt den Kern leewärts, ohne Wind steht er senkrecht', () => {
  const still = new World({ seed: 5, wind: 0 }), windy = new World({ seed: 5, wind: 15 });
  for (const w of [still, windy]) { w.thermals = []; w.addThermal({ x: 1000, w0: 3, r: 200, tb: -3000, life: 9000 }); }
  const [a] = still.thermals, [b] = windy.thermals;
  assert.equal(still.coreX(a, 1800, 3600), a.sx);
  assert.ok(windy.coreX(b, 1800, 3600) > b.sx + 100);
});

test('Nahe Bärte verschmelzen im Lauf eines Tages', () => {
  const w = new World({ seed: 4 });
  let merged = 0;
  const seen = new Set();
  for (let t = 0; t <= 7200; t += 1) {
    w.update(t);
    for (const th of w.thermals) if (th.merged && !seen.has(th.id)) { seen.add(th.id); merged++; }
  }
  assert.ok(merged > 0);
});
