# Architektur

ParaSim ist eine statische Web-App ohne Laufzeitabhängigkeiten. Die gesamte Simulation läuft im Browser.

```
src/
├── index.html          Seiteninhalt (ohne Dokumentgerüst; scripts/page.mjs ergänzt es)
├── css/style.css       Cockpit, Menüs, Thermik-Assistent
├── favicon.svg
└── js/
    ├── main.js         Spielablauf, Eingaben, Cockpit, Fluglehrer-Tipps, Auswertung
    ├── render.js       Canvas: Himmel, Gelände, Wolken, Thermik, Schirme, Übersicht, Barogramm, Assistent
    ├── audio.js        Akustisches Vario (Web Audio)
    ├── lessons.js      Lernpfad: Szenarien und Zielprüfung
    ├── store.js        localStorage (Bestweiten, Rekordflüge, Einstellungen)
    └── sim/            Simulation ohne DOM, auch headless in Node lauffähig
        ├── rng.js      Deterministischer Zufall und Rauschen
        ├── gliders.js  Polaren EN-A bis CCC, MacCready-Sollfahrt, Kurvensinken
        ├── world.js    Gelände, Linien, Thermik-Lebenszyklus, Wind, Wolken, Abwind
        ├── pilot.js    Flugphysik, Kreisen mit Kurvenschieber, Bot-Taktik
        └── session.js  Runde: Uhr, Piloten, Bots, Neustarts
```

## Grundsätze

- **Determinismus**: Eine Saat ergibt immer denselben Tag. Thermikquellen haben eigene Zufallsgeneratoren, damit die Reihenfolge der Erzeugung keine Rolle spielt. Das ist die Grundlage für Tagesaufgabe, Rekordflug-Geist und späteres gemeinsames Fliegen.
- **Feste Spielzeit**: Die Simulation läuft für alle im gleichen Tempo (Standard: 2 Flugstunden in 12 Minuten). Langsamere Kreisbewegung im Bart ist Teil der Physik (`CIRCLE_PACE`), keine Zeitlupe.
- **Sim ohne DOM**: `src/js/sim/` importiert nichts aus dem Browser. Tests und `npm run balance` laufen direkt in Node.

## Auslieferung

`npm run build` erzeugt `dist/` mit vollständigem `index.html` und `version.json`. Das Container-Image liefert `dist/` mit nginx (unprivilegiert, Port 8080) aus; Konfiguration in `deploy/nginx/`.
