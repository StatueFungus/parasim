# ParaSim

[![CI](https://github.com/StatueFungus/parasim/actions/workflows/ci.yml/badge.svg)](https://github.com/StatueFungus/parasim/actions/workflows/ci.yml)
[![Lizenz: MPL-2.0](https://img.shields.io/badge/Lizenz-MPL--2.0-blue.svg)](LICENSE)

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

| Befehl | Zweck |
|---|---|
| `npm start` | Lokaler Entwicklungsserver (Port über `PORT`) |
| `npm test` | Tests der Simulation (`node:test`) |
| `npm run lint` | ESLint |
| `npm run build` | Auslieferbares `dist/` erzeugen |
| `npm run balance -- flat EN-B 10 cumulus` | Bots über 8 Tage fliegen lassen, Distanzen ausgeben |
| `npm run check` | Lint, Tests und Build in einem |

Voraussetzung: Node.js 22 oder neuer (siehe `.nvmrc`).

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

| Wert | Standard | Bedeutung |
|---|---|---|
| `replicaCount` | `2` | Anzahl Pods (ohne Autoscaling) |
| `image.repository` / `image.tag` | GHCR / `appVersion` | Container-Image |
| `imagePullSecrets` | `[]` | Nötig, solange Image und Repository privat sind |
| `ingress.enabled`, `ingress.hosts`, `ingress.tls` | aus | Externer Zugriff |
| `autoscaling.enabled` | aus | HorizontalPodAutoscaler nach CPU |
| `podDisruptionBudget.enabled` | an | Mindestens ein Pod bleibt bei Wartung erreichbar |
| `networkPolicy.enabled` | aus | Nur Port 8080 eingehend, nichts ausgehend |

Der Pod läuft ohne root, mit schreibgeschütztem Dateisystem, ohne Linux-Capabilities und mit `RuntimeDefault`-Seccomp. `helm test parasim` prüft die Erreichbarkeit.

## CI/CD

| Workflow | Auslöser | Was passiert |
|---|---|---|
| [CI](.github/workflows/ci.yml) | Push auf `main`, Pull Requests | Lint, Tests, Build, Bot-Balance als Zusammenfassung; Helm-Lint und Schema-Prüfung (kubeconform); Dockerfile-Lint (hadolint), Image-Build, Smoke-Test des Containers, Sicherheitsscan (Trivy) |
| [Release](.github/workflows/release.yml) | Tag `v*.*.*` | Tests; Multi-Arch-Image nach GHCR (`<version>`, `<major>.<minor>`, `latest`); Helm-Chart als OCI-Paket nach GHCR; GitHub-Release mit Chart und Installationshinweisen |
| [Deploy](.github/workflows/deploy.yml) | Veröffentlichtes Release oder manuell | `helm upgrade --install` mit `deploy/helm/values-production.yaml` und `helm test` |

### Release erstellen

1. `CHANGELOG.md` ergänzen, `version` in `package.json` anheben.
2. Commit, dann Tag setzen und pushen:
   ```sh
   git tag v0.2.0 && git push origin v0.2.0
   ```

Chart- und App-Version werden aus dem Tag gesetzt.

### Deploy einrichten

Der Deploy-Workflow ist inaktiv, bis er konfiguriert ist:

1. Environment `production` anlegen (Settings → Environments) und darin das Secret `KUBECONFIG` hinterlegen: Inhalt einer kubeconfig, base64-kodiert.
2. Repository-Variable `DEPLOY_ENABLED` auf `true` setzen.
3. Im Ziel-Namespace ein Pull-Secret `ghcr-pull` anlegen (siehe Kommentar in `deploy/helm/values-production.yaml`) und dort Hostname und Ingress-Klasse anpassen.

Dependabot hält Actions, npm-Pakete und Basis-Images aktuell.

## Mitmachen

Siehe [CONTRIBUTING.md](CONTRIBUTING.md). Sicherheitslücken bitte nach [SECURITY.md](SECURITY.md) melden.

## Lizenz

[Mozilla Public License 2.0](LICENSE). Nutzung, auch kommerziell, ist frei; Änderungen an den Dateien dieses Projekts müssen unter derselben Lizenz offen bleiben.
