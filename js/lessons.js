// Lernpfad: kurze Aufgaben mit festem Szenario und klarem Ziel.
// check() liefert { text, done } bzw. { fail } – wird jede Sekunde ausgewertet.

const agl = (s, p) => p.z - s.world.ground(p.x);

export const LESSONS = [
  {
    id: 'zentrieren',
    title: 'Thermik zentrieren',
    goal: 'Steige auf 1100 m über Grund.',
    intro: [
      'Du bist mitten am Nachmittag in der Luft. Vor dir steht eine kräftige Thermik, die orange Säule zeigt sie dir an.',
      'Flieg hinein. Erst wenn das Vario piepst und Steigen anzeigt, hältst du die Leertaste (oder die linke Bildschirmhälfte) zum Kreisen.',
      'Kreist du nahe genug am Kern, wirst du automatisch zentriert. Wer zu früh einkreist, hängt im Randbereich und sinkt.',
    ],
    setup: {
      world: { terrain: 'flat', wind: 0, clouds: 'cumulus', quality: 0.8, extraThermals: [{ x: 1100, w0: 3.4, r: 230, tb: -900, life: 6000, birds: true }] },
      tStart: 2400, duration: 1200, airStart: 450, showThermals: true, glider: 'EN-B', centering: 'auto',
    },
    check(s, p) {
      const h = agl(s, p);
      if (h >= 1100) return { done: true };
      return { text: `${Math.round(h)} / 1100 m über Grund` };
    },
  },
  {
    id: 'schieber',
    title: 'Zentrieren mit dem Schieber',
    goal: 'Steige in 9 Minuten auf 1050 m über Grund. Mit fester Kurve reicht die Zeit nicht.',
    intro: [
      'Jetzt steuerst du die Kurve selbst. Leertaste halten startet eine moderate Linkskurve. Mit ← und → verschiebst du den Kurvenschieber: enger, weiter, geradeaus oder sogar in die andere Richtung. Am Handy ziehst du dafür den Kreis-Daumen nach links oder rechts.',
      'Kreist du neben dem Kern, steigt es auf einer Seite mehr. Der Thermik-Assistent zeigt deine Bahn von oben, orange heisst Steigen, das Kreuz markiert den Kern.',
      'Die Technik: Wird das Steigen stärker, mach die Kurve auf (Schieber Richtung Mitte). So fliegst du ein Stück Richtung Kern. Wird es wieder schwächer, dreh enger ein. Lässt du die Leertaste los, fliegst du in die Richtung weiter, in die du gerade schaust.',
    ],
    setup: {
      world: { terrain: 'flat', wind: 0, clouds: 'cumulus', quality: 0.6, extraThermals: [{ x: 900, w0: 3.3, r: 210, tb: -900, life: 6000 }] },
      tStart: 2400, duration: 540, airStart: 400, showThermals: true, glider: 'EN-B', centering: 'assist',
    },
    check(s, p) {
      const h = agl(s, p);
      if (h >= 1050) return { done: true };
      return { text: `${Math.round(h)} / 1050 m über Grund` };
    },
  },
  {
    id: 'wolken',
    title: 'Wolken lesen',
    goal: 'Nutze 2 Thermiken mit je mindestens 200 m Höhengewinn.',
    intro: [
      'Ab jetzt ist die Thermik unsichtbar. Die Wolken verraten dir, wo es steigt.',
      'Junge Wolken mit klarer, flacher Basis wachsen gerade. Darunter steht meistens eine aktive Thermik.',
      'Graue, zerfaserte Wolken zerfallen schon. Darunter trägt es kaum noch, und der Bart reisst unten zuerst ab. Kreise erst, wenn das Vario es bestätigt.',
      'Eine Thermik wächst von unten nach oben. Bevor die Wolke entsteht, trägt es oft schon in Bodennähe. Unter der Wolke wird der Bart meist noch etwas stärker.',
    ],
    setup: { world: { terrain: 'flat', wind: 0, clouds: 'cumulus', quality: 1.05 }, tStart: 2700, duration: 1800, airStart: 900, showThermals: false, glider: 'EN-B' },
    check(s, p) {
      const n = (p.flight?.thermals ?? 0) + (p.circling && p.z - (p.flight?.circStart?.z ?? p.z) >= 200 ? 1 : 0);
      if (n >= 2) return { done: true };
      return { text: `${n} / 2 Thermiken genutzt` };
    },
  },
  {
    id: 'sollfahrt',
    title: 'Sollfahrt im Gegenwind',
    goal: 'Erreiche 8 km gegen 15 km/h Gegenwind.',
    intro: [
      'Gegenwind frisst Strecke. Mit Trimmgeschwindigkeit kommst du über Grund nur langsam voran.',
      'Der weisse Pfeil am Beschleuniger zeigt die Sollfahrt nach MacCready. Sie berücksichtigt Wind, Sinken und deinen MC-Wert.',
      'Im Sinken und im Gegenwind schneller fliegen, im Steigen langsamer. Den MC-Wert stellst du mit der Taste M.',
    ],
    setup: { world: { terrain: 'flat', wind: -15, clouds: 'cumulus', quality: 1.1 }, tStart: 2400, duration: 1800, airStart: 1000, showThermals: false, glider: 'EN-B' },
    check(s, p) {
      const d = p.dist / 1000;
      if (d >= 8) return { done: true };
      return { text: `${d.toFixed(1)} / 8 km` };
    },
  },
  {
    id: 'tief',
    title: 'Tiefe Situationen retten',
    goal: 'Komm von 280 m zurück auf 900 m über Grund.',
    intro: [
      'Du bist tief und die Landewiese kommt näher. Jetzt zählt jedes bisschen Steigen.',
      'Flieg mit Trimmgeschwindigkeit, damit du lange in der Luft bleibst. Nimm auch schwaches Steigen mit und gib nicht zu früh auf.',
      'Vögel kreisen gerne in Thermik. Achte auf sie.',
    ],
    setup: {
      world: { terrain: 'flat', wind: 5, clouds: 'cumulus', quality: 0.75, extraThermals: [{ x: 1600, w0: 2.2, r: 180, tb: -400, life: 3000, birds: true }] },
      tStart: 3000, duration: 1500, airStart: 280, showThermals: false, glider: 'EN-B',
    },
    check(s, p) {
      const h = agl(s, p);
      if (h >= 900) return { done: true };
      return { text: `${Math.round(h)} / 900 m über Grund` };
    },
  },
  {
    id: 'wenden',
    title: 'Zurück zum Bart',
    goal: 'Wende, finde die Thermik hinter dir und steige auf 900 m über Grund.',
    intro: [
      'Gerade bist du durch kräftiges Steigen geflogen, ohne einzukreisen. Vor dir ist nur noch Abwind.',
      'Mit der Pfeiltaste ← (oder dem Knopf «Wenden») drehst du um. Die Wende kostet ein paar Sekunden und etwas Höhe.',
      'Flieg zurück, kreise im Steigen ein und wende danach mit → wieder auf Kurs. Merke: Zurückfliegen lohnt sich nur, wenn der Bart nah ist.',
    ],
    setup: {
      world: { terrain: 'flat', wind: 0, clouds: 'blue', quality: 0.5, extraThermals: [{ x: -650, w0: 3.2, r: 210, tb: -900, life: 6000, birds: true }] },
      tStart: 3000, duration: 1500, airStart: 420, showThermals: false, glider: 'EN-B', missedAt: -650,
    },
    check(s, p) {
      const h = agl(s, p);
      if (h >= 900) return { done: true };
      return { text: `${Math.round(h)} / 900 m über Grund` + (p.dir === -1 ? ' · zurück' : '') };
    },
  },
  {
    id: 'linie',
    title: 'Linienwahl im Gebirge',
    goal: 'Fliege im Gebirge 20 km weit.',
    intro: [
      'Im Gebirge wählst du deine Linie. An der sonnigen Hangkante (Taste Q) stehen viele kräftige Bärte, aber der Grat ist nah.',
      'In der Talmitte (Taste E) ist viel Luft unter dir. Dort trägt es schlecht, dafür schiebt ab Mittag der Talwind.',
      'Mit Höhe an die Kante, tief ins Tal: Die Anzeige «über Grat» unten hilft dir bei der Entscheidung. Der Wechsel dauert knapp eine Flugminute.',
    ],
    setup: { world: { terrain: 'mountain', wind: 0, clouds: 'cumulus', quality: 1, seed: 7 }, tStart: 1800, duration: 3600, showThermals: false, glider: 'EN-B', penalty: 0 },
    check(s, p) {
      const d = p.score() / 1000;
      if (d >= 20) return { done: true };
      return { text: `${d.toFixed(1)} / 20 km · ${p.l < 0.5 ? 'Hangkante' : 'Talmitte'}` };
    },
  },
  {
    id: 'wind',
    title: 'Bärte im Wind',
    goal: 'Nutze 2 Thermiken mit je mindestens 200 m Höhengewinn bei 20 km/h Rückenwind.',
    intro: [
      'Die Thermik löst sich an einem festen Punkt am Boden ab. Auf dem Weg nach oben versetzt sie der Wind, der Bart steht also schräg.',
      'Auf deiner Höhe liegt das Steigen deshalb luvseitig der Wolke. Bei Rückenwind triffst du es schon, bevor du unter der Wolke bist.',
      'Beim Kreisen driftest du mit dem Wind. Achte auf die Schleifen in deiner Spur, und darauf, wie sich der Kern mit der Höhe verschiebt.',
    ],
    setup: { world: { terrain: 'flat', wind: 20, clouds: 'cumulus', quality: 1.1 }, tStart: 2700, duration: 1800, airStart: 700, showThermals: true, glider: 'EN-B' },
    check(s, p) {
      const n = (p.flight?.thermals ?? 0) + (p.circling && p.z - (p.flight?.circStart?.z ?? p.z) >= 200 ? 1 : 0);
      if (n >= 2) return { done: true };
      return { text: `${n} / 2 Thermiken genutzt` };
    },
  },
  {
    id: 'pruefung',
    title: 'Prüfungsflug',
    goal: 'Fliege in einer vollen Runde 25 km.',
    intro: [
      'Jetzt alles zusammen: Du entscheidest selbst, wann du startest. Die Anzeige «Thermikentwicklung» hilft dir dabei.',
      'Zu früh: schwache Thermik, tiefe Basis, Absaufgefahr. Zu spät: beste Bedingungen, aber weniger Zeit.',
      'Nach einer Aussenlandung kannst du wieder hochlaufen. Das kostet 10 Flugminuten.',
    ],
    setup: { world: { terrain: 'flat', wind: 5, clouds: 'cumulus', quality: 1 }, tStart: 0, duration: 7200, penalty: 600, showThermals: false, glider: 'EN-B' },
    check(s, p) {
      const d = p.score() / 1000;
      if (d >= 25) return { done: true };
      return { text: `${d.toFixed(1)} / 25 km` };
    },
  },
];
