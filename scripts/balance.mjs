// Headless-Abgleich: lässt die Bots über mehrere Saaten fliegen und gibt Distanzen aus.
// Aufruf: node scripts/balance.mjs [terrain] [glider] [wind] [clouds]
// Umgebung: DURATION (Rundendauer in Flugsekunden, Standard 14400 wie im Spiel), SEEDS (Anzahl Tage, Standard 8)
import { Session } from '../src/js/sim/session.js';

const [terrain = 'flat', glider = 'EN-B', wind = '0', clouds = 'cumulus'] = process.argv.slice(2);
const DURATION = Number(process.env.DURATION) || 14400;
const SEEDS = Number(process.env.SEEDS) || 8;
const res = {};
const bestOfDay = [];
let all = [];
let turns = 0;
const laneT = [0, 0];
for (let seed = 1; seed <= SEEDS; seed++) {
  const s = new Session({
    world: { seed, terrain, wind: +wind, clouds, dayLen: DURATION },
    duration: DURATION,
    rate: DURATION / 900,
    penalty: 600,
  });
  s.addBots(7, glider);
  while (!s.ended) s.step(60);
  bestOfDay.push(Math.max(...s.pilots.map((p) => p.best)) / 1000);
  all = all.concat(s.pilots.map((p) => p.best / 1000));
  for (const p of s.pilots) {
    (res[p.name + ' ' + p.tag] ??= []).push((p.best / 1000).toFixed(1) + (p.flights.length > 1 ? '*' + p.flights.length : ''));
    for (const f of p.flights) {
      turns += f.turns;
      laneT[0] += f.laneT[0];
      laneT[1] += f.laneT[1];
    }
  }
}
for (const [k, v] of Object.entries(res)) console.log(k.padEnd(22), v.join('  '));
const mean = (a) => a.reduce((n, v) => n + v, 0) / a.length;
console.log(
  `Mittel aller Bots: ${mean(all).toFixed(1)} km · bester Bot pro Tag im Mittel: ${mean(bestOfDay).toFixed(1)} km · Bestweite: ${Math.max(...bestOfDay).toFixed(1)} km`,
);
console.log(`Wenden gesamt: ${turns} · Zeit an Hangkante/Talmitte: ${Math.round(laneT[0] / 60)} / ${Math.round(laneT[1] / 60)} min`);
