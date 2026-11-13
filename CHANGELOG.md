# Changelog

Wird bei jedem Release von semantic-release aus den Commit-Nachrichten erzeugt.

## [0.4.0](https://github.com/StatueFungus/parasim/compare/v0.3.1...v0.4.0) (2026-11-13)

### Neue Funktionen

* **hud:** Handy-Bedienung, Assistent rechts und Tageszeit im Training ([583e62c](https://github.com/StatueFungus/parasim/commit/583e62c353e8f9bf5259dffbd227e2116bfc2eae))

## [0.3.1](https://github.com/StatueFungus/parasim/compare/v0.3.0...v0.3.1) (2026-11-13)

### Fehlerbehebungen

* **hud:** Flugpfad im Zentrierassistenten springt nicht mehr ([72249bb](https://github.com/StatueFungus/parasim/commit/72249bbc438b4da93894bb4373dad498ad77df63))

## [0.3.0](https://github.com/StatueFungus/parasim/compare/v0.2.1...v0.3.0) (2026-11-13)

### Neue Funktionen

* **hud:** neues Cockpit, schönere Schirme mit Liegegurtzeug ([333efd5](https://github.com/StatueFungus/parasim/commit/333efd5310ea50c6d1cdc9f2829655c556ce6dd2))

## [0.2.1](https://github.com/StatueFungus/parasim/compare/v0.2.0...v0.2.1) (2026-11-13)

### Fehlerbehebungen

* **security:** Content-Security-Policy zusätzlich als Meta-Tag ([816ea9b](https://github.com/StatueFungus/parasim/commit/816ea9b1f8f1f2580836d20e0057a03e5bf01c72))

## [0.2.0](https://github.com/StatueFungus/parasim/compare/v0.1.0...v0.2.0) (2026-11-13)

### Neue Funktionen

* Version im Hauptmenü anzeigen ([18fdcd1](https://github.com/StatueFungus/parasim/commit/18fdcd1e1c47787693dc6024da389d7d439c44a6))

### Fehlerbehebungen

* **container:** Health-Check in JSON-Schreibweise, numerischer Benutzer ([0191f63](https://github.com/StatueFungus/parasim/commit/0191f63705fc6424c7a4028a4931a78a5e02b578))

### Build und Abhängigkeiten

* **deps-dev:** Changelog-Preset auf 9.3.1 (passend zu semantic-release 25) ([0d36603](https://github.com/StatueFungus/parasim/commit/0d366030a084fd86ebd0f3cb464f57ebfb926204))

## 0.1.0 (2026-11-13)

Erste Version.

### Spiel
- Modi: Freies Training, Tagesaufgabe mit Rekordflug-Geist, Wettkampf gegen Computerpiloten, Lernpfad mit 9 Lektionen
- Thermik mit Lebenszyklus: Wachstum von unten, Verschmelzen naher Bärte, Abreissen beim Zerfall, stärker unter der Wolke
- Wind: schräg stehende Bärte, Windprofil, Talwind, Zerreissen bei Starkwind; Hangaufwind im Gebirge
- Linienwahl im Gebirge (Hangkante, Talmitte), Wenden
- Selbst zentrieren mit stufenlosem Kurvenschieber und Thermik-Assistent (Stufen Automatisch, Assistiert, Profi)
- Polaren EN-A bis CCC, MacCready-Sollfahrt, akustisches Vario, Fluglehrer-Tipps, Barogramm

### Betrieb
- Container-Image (nginx, unprivilegiert, Security-Header) und gehärtetes Helm-Chart
- CI mit Lint, Tests, Helm-Prüfung, Container-Smoke-Test und Trivy; Release nach GHCR; optionaler Deploy-Workflow
