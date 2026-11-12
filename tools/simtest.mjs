// Headless-Abgleich: lässt die Bots über mehrere Saaten fliegen und gibt Distanzen aus.
// Aufruf: node tools/simtest.mjs [terrain] [glider] [wind] [clouds]
import { Session } from '../js/sim/session.js';

const [terrain = 'flat', glider = 'EN-B', wind = '0', clouds = 'cumulus'] = process.argv.slice(2);
const res = {};
let turns = 0;
const laneT = [0, 0];
for (let seed = 1; seed <= 8; seed++) {
  const s = new Session({ world: { seed, terrain, wind: +wind, clouds }, duration: 7200, penalty: 600 });
  s.addBots(7, glider);
  while (!s.ended) s.step(60);
  for (const p of s.pilots) {
    (res[p.name + ' ' + p.tag] ??= []).push((p.best / 1000).toFixed(1) + (p.flights.length > 1 ? '*' + p.flights.length : ''));
    for (const f of p.flights) { turns += f.turns; laneT[0] += f.laneT[0]; laneT[1] += f.laneT[1]; }
  }
}
for (const [k, v] of Object.entries(res)) console.log(k.padEnd(22), v.join('  '));
console.log(`Wenden gesamt: ${turns} · Zeit an Hangkante/Talmitte: ${Math.round(laneT[0] / 60)} / ${Math.round(laneT[1] / 60)} min`);
