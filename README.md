# ParaSim

[![CI](https://github.com/StatueFungus/parasim/actions/workflows/ci.yml/badge.svg)](https://github.com/StatueFungus/parasim/actions/workflows/ci.yml)
[![CodeQL](https://github.com/StatueFungus/parasim/actions/workflows/codeql.yml/badge.svg)](https://github.com/StatueFungus/parasim/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/StatueFungus/parasim?label=Release)](https://github.com/StatueFungus/parasim/releases)
[![Lizenz: MPL-2.0](https://img.shields.io/badge/Lizenz-MPL--2.0-blue.svg)](LICENSE)

**Direkt spielen: <https://statuefungus.github.io/parasim/>**

Streckenflug-Simulator für Gleitschirmpiloten im Browser: Thermik finden, hochkreisen, weit gleiten.

Eine Runde simuliert zwei Flugstunden ab 11:30 Uhr. Thermik entsteht, wächst von unten zur Wolkenbasis, verschmilzt und zerfällt. Wind versetzt die Bärte, im Gebirge entscheidet die Linienwahl. Wer will, zentriert selbst mit einem stufenlosen Kurvenschieber.

- **Modi**: Freies Training, Tagesaufgabe mit Rekordflug-Geist, Wettkampf gegen bis zu 7 Computerpiloten, Lernpfad mit 9 Lektionen
- **Physik**: Polaren EN-A bis CCC, MacCready-Sollfahrt, Thermik-Lebenszyklus, Windprofil, Hangaufwind, Talwind
- **Bedienung**: Tastatur oder ein Daumen am Handy; akustisches Vario, Thermik-Assistent, Fluglehrer-Tipps

Details zur Simulation: [docs/spielmechanik.md](docs/spielmechanik.md) · Aufbau des Codes: [docs/architektur.md](docs/architektur.md)

## Schnellstart

```sh
npm ci          # nur Entwicklungswerkzeuge (ESLint); die App selbst hat keine Abhängigkeiten
npm start       # http://localhost:8000
```

| Befehl                                    | Zweck                                               |
| ----------------------------------------- | --------------------------------------------------- |
| `npm start`                               | Lokaler Entwicklungsserver (Port über `PORT`)       |
| `npm test`                                | Tests der Simulation (`node:test`)                  |
| `npm run lint`                            | ESLint und Prettier                                 |
| `npm run format`                          | Code mit Prettier formatieren                       |
| `npm run build`                           | Auslieferbares `dist/` erzeugen                     |
| `npm run balance -- flat EN-B 10 cumulus` | Bots über 8 Tage fliegen lassen, Distanzen ausgeben |
| `npm run check`                           | Lint, Tests und Build in einem                      |

Voraussetzung: Node.js 22 oder neuer, empfohlen 24 LTS (siehe `.nvmrc`).

## Container

```sh
docker build -t parasim .
docker run --rm -p 8080:8080 --read-only --tmpfs /tmp parasim
# http://localhost:8080 · Health-Check: /healthz · Build-Info: /version.json
```

Das Image basiert auf `nginx-unprivileged`, läuft als Benutzer 101 auf Port 8080, verträgt ein schreibgeschütztes Dateisystem und setzt Security-Header (CSP, `X-Frame-Options`, `Permissions-Policy`).

Fertige Images liegen nach jedem Release unter `ghcr.io/statuefungus/parasim` (amd64 und arm64, mit SBOM und Provenance).

## Kubernetes mit Helm

```sh
helm install parasim oci://ghcr.io/statuefungus/charts/parasim --version <version> \
  --namespace parasim --create-namespace
```

Oder direkt aus dem Repository:

```sh
helm install parasim charts/parasim --namespace parasim --create-namespace \
  -f deploy/helm/values-production.yaml
```

Wichtige Werte (vollständig in [`charts/parasim/values.yaml`](charts/parasim/values.yaml)):

| Wert                                              | Standard            | Bedeutung                                        |
| ------------------------------------------------- | ------------------- | ------------------------------------------------ |
| `replicaCount`                                    | `2`                 | Anzahl Pods (ohne Autoscaling)                   |
| `image.repository` / `image.tag`                  | GHCR / `appVersion` | Container-Image                                  |
| `imagePullSecrets`                                | `[]`                | Nur für private Registries nötig                 |
| `ingress.enabled`, `ingress.hosts`, `ingress.tls` | aus                 | Externer Zugriff                                 |
| `autoscaling.enabled`                             | aus                 | HorizontalPodAutoscaler nach CPU                 |
| `podDisruptionBudget.enabled`                     | an                  | Mindestens ein Pod bleibt bei Wartung erreichbar |
| `networkPolicy.enabled`                           | aus                 | Nur Port 8080 eingehend, nichts ausgehend        |

Der Pod läuft ohne root, mit schreibgeschütztem Dateisystem, ohne Linux-Capabilities und mit `RuntimeDefault`-Seccomp. `helm test parasim` prüft die Erreichbarkeit.

## CI/CD und Versionierung

Versionen folgen [Semantic Versioning](https://semver.org/lang/de/) und entstehen automatisch aus den Commit-Nachrichten ([Conventional Commits](https://www.conventionalcommits.org/de/)):

| Commit                                                                       | Beispiel                                   | Neue Version      |
| ---------------------------------------------------------------------------- | ------------------------------------------ | ----------------- |
| `feat:`                                                                      | `feat: Thermik-Assistent zeigt Kernstärke` | Minor (0.**2**.0) |
| `fix:`, `perf:`                                                              | `fix: Vögel springen nicht mehr`           | Patch (0.1.**1**) |
| `build(deps):`                                                               | Dependabot-Update des Basis-Images         | Patch             |
| `feat!:` oder `BREAKING CHANGE:` im Text                                     |                                            | Major (**1**.0.0) |
| `docs:`, `style:`, `refactor:`, `test:`, `ci:`, `chore:`, `build(deps-dev):` |                                            | keine             |

Die Pipeline ([`ci.yml`](.github/workflows/ci.yml)) läuft bei jedem Pull Request und jedem Push auf `main`:

| Stufe                                       | Inhalt                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Lint**                                    | ESLint, Prettier, commitlint (Commit-Nachrichten), actionlint (Workflows)                                                                        |
| **Tests und Build**                         | `node:test`, Build von `dist/`, Bot-Balance als Zusammenfassung                                                                                  |
| **Helm-Chart**                              | `helm lint --strict`, Schema-Prüfung mit kubeconform                                                                                             |
| **Container-Image**                         | hadolint, Build, Smoke-Test mit schreibgeschütztem Dateisystem, Trivy-Scan                                                                       |
| **Release** _(nur `main`)_                  | semantic-release: nächste Version, `CHANGELOG.md`, Version in `package.json` und `Chart.yaml`, Tag, GitHub-Release                               |
| **Veröffentlichen** _(bei neuer Version)_   | Multi-Arch-Image (`<version>`, `<major>.<minor>`, `latest`) mit SBOM und Provenance nach GHCR; Helm-Chart als OCI-Paket nach GHCR und am Release |
| **GitHub Pages** _(bei neuer Version)_      | `dist/` des Releases unter <https://statuefungus.github.io/parasim/>; manuell erneut auslösbar über _Actions → CI/CD → Run workflow_             |
| **Rollout** _(bei neuer Version, optional)_ | [`deploy.yml`](.github/workflows/deploy.yml): `helm upgrade --install` und `helm test`                                                           |

[CodeQL](.github/workflows/codeql.yml) analysiert JavaScript-Code und Workflows auf Sicherheitsprobleme. Zusätzlich prüft [`pr-title.yml`](.github/workflows/pr-title.yml) den Titel von Pull Requests, denn beim Squash-Merge wird er zur Commit-Nachricht auf `main`.

Lokal prüfen Git-Hooks (husky) vor jedem Commit die geänderten Dateien (ESLint, Prettier) und die Commit-Nachricht (commitlint). Sie werden mit `npm ci` eingerichtet.

### Deploy einrichten

Der Rollout ist inaktiv, bis er konfiguriert ist:

1. Environment `production` anlegen (Settings → Environments) und darin das Secret `KUBECONFIG` hinterlegen: Inhalt einer kubeconfig, base64-kodiert.
2. Repository-Variable `DEPLOY_ENABLED` auf `true` setzen.
3. In `deploy/helm/values-production.yaml` Hostname und Ingress-Klasse anpassen.

Ein bestimmtes Release lässt sich jederzeit von Hand ausrollen, auch als Rollback: _Actions → Deploy → Run workflow_ mit der gewünschten Version.

Dependabot hält Actions, npm-Pakete und Basis-Images aktuell; Updates der Basis-Images lösen ein Patch-Release aus.

## Mitmachen

Siehe [CONTRIBUTING.md](CONTRIBUTING.md). Sicherheitslücken bitte nach [SECURITY.md](SECURITY.md) melden.

## Lizenz

[Mozilla Public License 2.0](LICENSE). Nutzung, auch kommerziell, ist frei; Änderungen an den Dateien dieses Projekts müssen unter derselben Lizenz offen bleiben.
