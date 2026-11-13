import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLIDERS, speedFor, sinkFor, bestBar, circleSinkR } from '../src/js/sim/gliders.js';

test('Sinken nimmt mit der Geschwindigkeit zu', () => {
  for (const g of Object.values(GLIDERS)) {
    assert.ok(sinkFor(g, speedFor(g, 1)) > sinkFor(g, speedFor(g, 0)), g.id);
  }
});

test('Höhere Klassen gleiten besser', () => {
  const ld = (g) => g.vTrim / 3.6 / g.sTrim;
  assert.ok(ld(GLIDERS.CCC) > ld(GLIDERS['EN-B']));
  assert.ok(ld(GLIDERS['EN-B']) > ld(GLIDERS['EN-A']));
});

test('Sollfahrt: mehr MC heisst schneller, starkes Steigen heisst langsam', () => {
  const g = GLIDERS['EN-B'];
  assert.ok(bestBar(g, 2.5, 0) > bestBar(g, 0, 0));
  assert.equal(bestBar(g, 1, 3), 0);
  assert.ok(bestBar(g, 1, -2) > bestBar(g, 1, 0), 'im Sinken schneller');
});

test('Enge Kurven kosten mehr Sinken', () => {
  const g = GLIDERS['EN-B'];
  assert.ok(circleSinkR(g, 25) > circleSinkR(g, 40));
  assert.ok(circleSinkR(g, 40) > circleSinkR(g, 65));
});
