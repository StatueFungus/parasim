// Sonnenstand für einen Sommertag in den Alpen (47° N, Deklination +20°, Sommerzeit: Höchststand um 13:30 Uhr).
// Die Strecke führt nach Westen: +x zeigt nach Westen, der Blick geht nach Süden in die Sonne.
const LAT = (47 * Math.PI) / 180;
const DECL = (20 * Math.PI) / 180;
const NOON = 13.5;

// clock: Sekunden seit Mitternacht. Liefert Höhe (rad), Richtung zur Sonne (x = West, s = Süd, z = oben)
// und die Stunde als Kommazahl.
export function sunAt(clock) {
  const hour = clock / 3600;
  const H = ((hour - NOON) * 15 * Math.PI) / 180;
  const z = Math.sin(LAT) * Math.sin(DECL) + Math.cos(LAT) * Math.cos(DECL) * Math.cos(H);
  const x = Math.cos(DECL) * Math.sin(H);
  const s = Math.sin(LAT) * Math.cos(DECL) * Math.cos(H) - Math.cos(LAT) * Math.sin(DECL);
  return { hour, elev: Math.asin(z), x, s, z };
}

// Waagrechter Versatz des Schattens eines Punkts in Höhe h über Grund (m, entlang x)
export function shadowShift(sun, h) {
  return (-h * sun.x) / Math.max(0.1, sun.z);
}

// Beleuchtung einer Flanke mit Steigung g (dz/dx) relativ zu flachem Boden: >1 der Sonne zugewandt, <1 abgewandt
export function slopeLight(sun, g) {
  return Math.max(0, -g * sun.x + sun.z) / (Math.sqrt(1 + g * g) * Math.max(0.1, sun.z));
}
