import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunAt, shadowShift, slopeLight } from '../src/js/sim/sun.js';
import { World, DAY_START } from '../src/js/sim/world.js';

const at = (h) => sunAt(h * 3600);

test('Die Sonne steht um 13:30 Uhr am höchsten und zieht von Ost nach West', () => {
  assert.ok(at(13.5).elev > at(11.5).elev);
  assert.ok(at(13.5).elev > at(15).elev);
  assert.ok(at(11.5).x < 0, 'vormittags im Osten');
  assert.ok(at(15).x > 0, 'nachmittags im Westen');
  assert.ok(Math.abs(at(13.5).x) < 1e-9);
});

test('Wolkenschatten fallen vormittags nach Westen, nachmittags nach Osten', () => {
  assert.ok(shadowShift(at(11.5), 1500) > 300);
  assert.ok(shadowShift(at(15), 1500) < -300);
  assert.ok(Math.abs(shadowShift(at(13.5), 1500)) < 1);
});

test('Vormittags ist die Ostflanke heller, nachmittags die Westflanke', () => {
  // g > 0: Gelände steigt nach Westen an, die Flanke schaut nach Osten
  assert.ok(slopeLight(at(11.5), 0.4) > slopeLight(at(11.5), -0.4));
  assert.ok(slopeLight(at(15), 0.4) < slopeLight(at(15), -0.4));
  assert.equal(slopeLight(at(13.5), 0.4).toFixed(6), slopeLight(at(13.5), -0.4).toFixed(6));
});

test('Im Gebirge trägt die sonnige Flanke besser, mittags beide gleich', () => {
  const w = new World({ seed: 5, terrain: 'mountain' });
  const east = { lane: 0, slope: 0.4 },
    west = { lane: 0, slope: -0.4 };
  const t = (h) => h * 3600 - DAY_START;
  assert.ok(w.sunFactor(east, t(11.5)) > 1 && w.sunFactor(west, t(11.5)) < 1);
  assert.ok(w.sunFactor(east, t(15)) < 1 && w.sunFactor(west, t(15)) > 1);
  assert.equal(w.sunFactor(east, t(13.5)), 1);
  assert.equal(new World({ seed: 5 }).sunFactor(east, t(11.5)), 1, 'im Flachland ohne Wirkung');
  assert.equal(w.sunFactor({ lane: 1, slope: 0.4 }, t(11.5)), 1, 'nicht in der Talmitte');
});
