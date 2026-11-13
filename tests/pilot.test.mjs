import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/js/sim/world.js';
import { Pilot, R_TIGHT } from '../src/js/sim/pilot.js';

function calmThermal(wind = 0) {
  const w = new World({ seed: 3, wind, quality: 0.01, extraThermals: [{ x: 1000, w0: 3.2, r: 200, tb: -1000, life: 9000 }] });
  w.thermals = w.thermals.filter((th) => th.fixed);
  w.update = () => {};
  return w;
}

function circleIn(w, centering, steerFn, seconds = 300) {
  const p = new Pilot({ id: 'p', glider: 'EN-B', centering });
  const t0 = 2400;
  p.launch(w, t0);
  p.x = 930; p.z = w.ground(930) + 500;
  const z0 = p.z;
  p.wantCircle = true;
  let prev = 0;
  for (let t = t0; t < t0 + seconds; t += 0.2) {
    if (steerFn && p.circling) { steerFn(p, prev); prev = p.air; }
    p.step(w, 0.2, t);
  }
  return { p, climb: (p.z - z0) / seconds };
}

test('Ein Gleitflug ohne Thermik endet mit einer Landung', () => {
  const w = new World({ seed: 1, quality: 0.01 });
  w.thermals = []; w.update = () => {};
  const p = new Pilot({ id: 'p', glider: 'EN-B' });
  p.launch(w, 0);
  for (let t = 0; t < 3000 && p.state === 'flying'; t += 1) p.step(w, 1, t);
  assert.equal(p.state, 'landed');
  assert.ok(p.best > 1000 && p.best < 10000, `Gleitstrecke ${p.best}`);
});

test('Automatik steigt im Bart', () => {
  assert.ok(circleIn(calmThermal(), 'auto').climb > 0.5);
});

test('Selbst zentrieren mit dem Schieber schlägt die Automatik', () => {
  const auto = circleIn(calmThermal(), 'auto').climb;
  const manual = circleIn(calmThermal(), 'pro', (p, prev) => {
    const target = p.air > prev ? 0.25 : 0.8;
    p.setSteer(p.steer + Math.max(-0.03, Math.min(0.03, target - p.steer)));
  }).climb;
  assert.ok(manual > auto + 0.2, `manuell ${manual.toFixed(2)} vs. Automatik ${auto.toFixed(2)}`);
});

test('Schieber auf null heisst geradeaus, der Radius folgt dem Schieber', () => {
  const { p } = circleIn(calmThermal(), 'pro', (p) => p.setSteer(0), 5);
  assert.equal(p.R, Infinity);
  p.setSteer(0.5);
  p.step(calmThermal(), 0.2, 2500);
  assert.equal(Math.round(p.R), R_TIGHT * 2);
});

test('Ausleiten in die Richtung, in die man schaut', () => {
  const w = calmThermal();
  const p = new Pilot({ id: 'p', glider: 'EN-B', centering: 'pro' });
  p.launch(w, 2400);
  p.z = w.ground(0) + 800;
  p.wantCircle = true;
  let t = 2400;
  p.step(w, 0.2, t);
  while (Math.cos(p.heading) > -0.9) p.step(w, 0.2, (t += 0.2));
  p.wantCircle = false;
  p.step(w, 0.2, (t += 0.2));
  assert.equal(p.dir, -1);
});
