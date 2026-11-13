# Changelog

Alle nennenswerten Änderungen. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).

## [Unveröffentlicht]

## [0.1.0]

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
