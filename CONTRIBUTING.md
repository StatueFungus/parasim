# Mitmachen

## Entwicklung

```sh
npm ci
npm start        # http://localhost:8000
npm run check    # Lint, Tests, Build – muss vor jedem Pull Request grün sein
```

## Regeln

- **Branches und Pull Requests**: Änderungen über einen Branch und Pull Request auf `main`. Die CI muss grün sein.
- **Commits nach [Conventional Commits](https://www.conventionalcommits.org/de/)**: `typ(bereich): Beschreibung`, z. B. `feat(thermik): Bärte verschmelzen` oder `fix: Vögel springen nicht mehr`. Daraus berechnet semantic-release die nächste Version (siehe README). Ein Git-Hook prüft das beim Commit.
- **Pull-Request-Titel** folgen demselben Format; beim Squash-Merge wird der Titel zur Commit-Nachricht.
- **Formatierung** übernimmt Prettier automatisch beim Commit (`npm run format` für alles).
- **Releases** nie von Hand taggen: Das erledigt die Pipeline nach jedem Merge auf `main`.
- **Simulation ändern**: Änderungen in `src/js/sim/` beeinflussen Balance und Determinismus.
  - Mit `npm run balance` vorher und nachher vergleichen und das Ergebnis im Pull Request nennen.
  - Wenn sich der Tag für eine Saat ändert, passen gespeicherte Rekordflüge der Tagesaufgabe nicht mehr. Das im `CHANGELOG.md` vermerken.
- **Tests**: Für neues Verhalten der Simulation einen Test in `tests/` ergänzen.
- **Sprache**: Oberfläche, Kommentare und Dokumentation auf Deutsch.
- **Keine Laufzeitabhängigkeiten**: Die App bleibt eine statische Seite ohne Build-Werkzeuge im Browser.

## Lizenz

Mit einem Beitrag stimmst du zu, dass er unter der [MPL-2.0](LICENSE) steht.
