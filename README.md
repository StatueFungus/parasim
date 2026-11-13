# ParaSim – Streckenflug-Simulator

2D-Streckenflug-Simulator für Gleitschirme im Browser. Keine Abhängigkeiten und kein Build-Schritt.

## Starten

```sh
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

ES-Module brauchen einen Webserver; `index.html` direkt als Datei öffnen funktioniert nicht.

## Modi

- **Freies Training**: Schirmklasse (EN-A bis CCC), Flachland oder Gebirge, Cumulus, Wolkenstrassen oder Blauthermik, Wind, Thermikqualität, 0–7 Gegner, Rundendauer. Thermik kann eingeblendet werden, Neustart ist sofort möglich.
- **Tagesaufgabe**: jeden Tag ein festes Wetter aus dem Datum. Dein bester Flug wird als «Rekordflug»-Geist gespeichert und fliegt beim nächsten Versuch mit.
- **Wettkampf**: gegen bis zu 7 Computerpiloten mit unterschiedlichen MacCready-Werten und Können. Hochlaufen kostet 20 Flugminuten.
- **Lernpfad**: 9 Lektionen mit Ziel und Erfolgskontrolle (Zentrieren, Zentrieren mit dem Schieber, Wolken lesen, Sollfahrt im Gegenwind, tiefe Situationen retten, Zurück zum Bart, Linienwahl im Gebirge, Bärte im Wind, Prüfungsflug).

## Wenden und Linienwahl

- **Wenden** (← / →): Eine 180°-Wende dauert 7 Flugsekunden und kostet etwas Höhe. Gezählt wird die Landeposition, Zurückfliegen lohnt sich also nur, wenn ein guter Bart nah hinter dir liegt.
- **Linien im Gebirge** (Q / E): An der **Hangkante** gibt es dichte, kräftige Thermik und Hangaufwind, aber der Grat ist nah. In der **Talmitte** liegt der Boden tief, dafür trägt es schwach, es sinkt etwas stärker und ab Mittag schiebt der Talwind. Der Wechsel dauert knapp eine Flugminute, in der du langsamer vorankommst.
- Computerpiloten nutzen beides: Gute Piloten fliegen mit Höhenreserve an der Kante, weichen tief ins Tal aus und kehren zu einem überflogenen Bart zurück. Anfänger bleiben in der Talmitte.

## Bärte im Wind

- Thermik löst sich an einem festen Punkt am Boden ab und wird beim Aufsteigen vom Wind versetzt. Der Kern auf Höhe h liegt um `833 · (h/1000)^1.2 · Wind / Steigen` Meter leewärts (Windprofil `(h/1000)^0.2`).
- Auf Flughöhe liegt das Steigen damit luvseitig der Wolke: bei Rückenwind vor ihr, bei Gegenwind hinter ihr.
- Der Wind nimmt mit der Höhe zu. Das Cockpit zeigt den Wind auf deiner Flughöhe.
- Beim Kreisen driftest du mit dem Wind; die Flugspur zeigt das als Schleifen.
- Ab etwa 20 km/h zerreisst der Wind die Bärte: Sie werden schmaler, schwächer und pulsieren.

## Selbst zentrieren

Einstellung «Zentrieren» im Training und Wettkampf (gilt auch für die Tagesaufgabe):

| Stufe | Kurve | Thermik-Assistent |
|---|---|---|
| Automatisch | feste Kurve, die Automatik zieht den Kreis bis etwa einen halben Bartradius an den Kern | – |
| Assistiert | Kurvenschieber | Draufsicht mit Kern-Markierung |
| Profi | Kurvenschieber | Draufsicht ohne Kern, nur das gemessene Steigen |

- **Leertaste halten** startet eine moderate Kurve (≈ 40 m Radius) in der zuletzt geflogenen Drehrichtung.
- **Kurvenschieber** mit ← / → (am Handy: den Kreis-Daumen waagrecht ziehen): stufenlos von enger Linkskurve über geradeaus bis zur engen Rechtskurve. Der Radius ist `25 m / |Schieber|`; enge Kurven kosten mehr Sinken.
- **Zentrieren**: Wird das Steigen stärker, Kurve aufmachen (Schieber zur Mitte), so fliegt man Richtung Kern. Wird es schwächer, enger eindrehen.
- **Ausleiten**: Beim Loslassen fliegt man in die Richtung weiter, in die man gerade schaut, also auf Kurs oder zurück.
- Die Simulation läuft immer in Echtzeit (keine Zeitlupe), damit später mehrere Piloten gemeinsam fliegen können.
- Im Test steigt ein Pilot mit dieser Technik ohne Wind etwa 1.7 statt 1.24 m/s (Automatik), bei 15 km/h Wind 1.1 statt 0.75 m/s. Das gilt auch, wenn der Schieber nur langsam bewegt wird.
- Computerpiloten nutzen die Automatik, je nach Können unterschiedlich nah am Kern.

## Steuerung

| Taste | Funktion |
|---|---|
| Leertaste halten | Kreisen |
| ↑ / ↓ | Beschleuniger |
| ← / → | Wenden: zurück / wieder auf Kurs; im Kreis beim selbst Zentrieren: Kurvenschieber |
| Q / E | Gebirge: Hangkante / Talmitte |
| Enter | Starten / Hochlaufen |
| M | MacCready-Wert (0–3) |
| T / C / S / Z | Thermik, Tipps, Ton, Zoom |
| X | Zeitraffer am Boden |
| F | Kamera folgt dem Führenden |
| R | Neustart (nur Training) |
| P / Esc | Pause |

Touch: linke Hälfte halten = kreisen, rechts senkrecht wischen = Beschleuniger, beim selbst Zentrieren den Kreis-Daumen waagrecht ziehen = Kurvenschieber.

## Aufbau

- `js/sim/` – Simulation ohne DOM: Polaren (`gliders.js`), Gelände, Thermik-Lebenszyklus, Wolken, Abwind, Hangaufwind (`world.js`), Pilot und Bot-Logik (`pilot.js`), Runde (`session.js`).
- `js/render.js` – Canvas-Darstellung, Übersichtsleiste, Barogramm.
- `js/main.js` – Spielablauf, Eingaben, Cockpit, Fluglehrer-Tipps, Auswertung.
- `tools/simtest.mjs` – Bots headless über mehrere Saaten fliegen lassen, um die Balance abzustimmen:
  `node tools/simtest.mjs flat EN-B 0 cumulus`
