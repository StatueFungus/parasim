import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS } from '../src/js/lessons.js';
import { Session } from '../src/js/sim/session.js';
import { Pilot } from '../src/js/sim/pilot.js';

test('Jede Lektion ist vollständig und auswertbar', () => {
  const ids = new Set();
  for (const L of LESSONS) {
    assert.ok(L.id && L.title && L.goal && L.intro.length, L.id);
    assert.ok(!ids.has(L.id), `doppelte Kennung ${L.id}`);
    ids.add(L.id);
    const st = L.setup;
    const s = new Session({ world: { seed: 1, ...st.world }, duration: st.duration, tStart: st.tStart });
    const p = s.add(new Pilot({ id: 'me', glider: st.glider, centering: st.centering }));
    s.launch(p);
    if (st.airStart) p.z = s.world.ground(p.x) + st.airStart;
    s.step(30);
    const r = L.check(s, p);
    assert.ok(r.done || typeof r.text === 'string', L.id);
  }
});
