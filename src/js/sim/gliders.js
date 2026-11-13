// Vereinfachte Polaren: Trimmgeschwindigkeit ist zugleich bestes Gleiten,
// der Beschleuniger schiebt entlang einer Parabel bis zur Endgeschwindigkeit.

export const GLIDERS = {
  'EN-A': {
    id: 'EN-A',
    desc: 'Schulschirm – gutmütig, zentriert leicht',
    vTrim: 35,
    sTrim: 1.12,
    vMax: 44,
    sMax: 1.75,
    circleExtra: 0.12,
    center: 1.2,
  },
  'EN-B': {
    id: 'EN-B',
    desc: 'Der Allrounder für die ersten Strecken',
    vTrim: 37,
    sTrim: 1.06,
    vMax: 50,
    sMax: 1.85,
    circleExtra: 0.15,
    center: 1.0,
  },
  'EN-C': {
    id: 'EN-C',
    desc: 'Sportschirm – schneller, fordernder',
    vTrim: 38.5,
    sTrim: 1.02,
    vMax: 55,
    sMax: 2.0,
    circleExtra: 0.18,
    center: 0.9,
  },
  'EN-D': {
    id: 'EN-D',
    desc: 'Leistungsschirm für erfahrene Streckenpiloten',
    vTrim: 39.5,
    sTrim: 0.99,
    vMax: 59,
    sMax: 2.12,
    circleExtra: 0.2,
    center: 0.82,
  },
  CCC: {
    id: 'CCC',
    desc: 'Wettkampfschirm – maximale Leistung',
    vTrim: 41,
    sTrim: 0.97,
    vMax: 66,
    sMax: 2.3,
    circleExtra: 0.22,
    center: 0.75,
  },
};

export const speedFor = (g, bar) => g.vTrim + bar * (g.vMax - g.vTrim);

export function sinkFor(g, v) {
  const k = (g.sMax - g.sTrim) / (g.vMax - g.vTrim) ** 2;
  const d = v - g.vTrim;
  return g.sTrim + k * d * d;
}

export const circleSink = (g) => g.sTrim + g.circleExtra + 0.1;

// Kreisradien in Metern: eng (steil, mehr Sinken) bis weit (flach, fast Geradeaus-Sinken)
export const R_MIN = 28,
  R_MAX = 65,
  R_DEFAULT = 40;

export function circleSinkR(g, R) {
  return Math.max(g.sTrim + 0.05, circleSink(g) + 0.35 * ((R_DEFAULT / R) ** 2 - 1));
}

export const glideRatio = (g, bar) => speedFor(g, bar) / 3.6 / sinkFor(g, speedFor(g, bar));

// MacCready-Sollfahrt: Beschleunigerstellung, die Grundgeschwindigkeit / (Sinken netto + MC) maximiert.
export function bestBar(g, mc, air, windMs = 0) {
  let best = 0,
    bestVal = -Infinity;
  for (let b = 0; b <= 1.0001; b += 0.05) {
    const v = speedFor(g, b);
    const s = sinkFor(g, v) - air + mc;
    if (s <= 0.05) return 0;
    const val = (v / 3.6 + windMs) / s;
    if (val > bestVal) {
      bestVal = val;
      best = b;
    }
  }
  return best;
}
