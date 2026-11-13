import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../src/js/sim/session.js';

function fly(world) {
  const s = new Session({ world, duration: 7200, penalty: 600 });
  s.addBots(7, 'EN-B');
  while (!s.ended) s.step(60);
  return s;
}

test('Eine Runde mit Bots ist deterministisch', () => {
  const a = fly({ seed: 9, terrain: 'flat', wind: 5 }).pilots.map((p) => Math.round(p.best));
  const b = fly({ seed: 9, terrain: 'flat', wind: 5 }).pilots.map((p) => Math.round(p.best));
  assert.deepEqual(a, b);
});

test('Bots fliegen sinnvolle Strecken und bleiben nicht rückwärts hängen', () => {
  for (const world of [{ seed: 2, terrain: 'flat' }, { seed: 6, terrain: 'mountain' }, { seed: 4, terrain: 'flat', wind: 15 }]) {
    const s = fly(world);
    for (const p of s.pilots) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), `${p.name}: Position endlich`);
      for (const f of p.flights) assert.ok(f.dist >= 0);
    }
    const best = Math.max(...s.pilots.map((p) => p.best));
    assert.ok(best > 10000, `${JSON.stringify(world)}: bester Bot nur ${(best / 1000).toFixed(1)} km`);
  }
});
