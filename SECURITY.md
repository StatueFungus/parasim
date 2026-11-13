# Sicherheit

## Unterstützte Versionen

Sicherheitskorrekturen gibt es für die jeweils neueste veröffentlichte Version.

## Lücke melden

Bitte **kein** öffentliches Issue anlegen. Stattdessen über *Security → Report a vulnerability* in diesem Repository melden (private Sicherheitsmeldung von GitHub). Wir melden uns innerhalb von 7 Tagen.

## Maßnahmen

- Container läuft ohne root, mit schreibgeschütztem Dateisystem und ohne Linux-Capabilities.
- nginx setzt eine Content-Security-Policy und weitere Security-Header.
- Jedes Image wird in der CI mit Trivy gescannt; Releases enthalten SBOM und Provenance.
- Dependabot aktualisiert Abhängigkeiten, Actions und Basis-Images wöchentlich.
