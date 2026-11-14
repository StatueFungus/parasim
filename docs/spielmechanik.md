# Spielmechanik

Wie ParaSim Thermik, Wind, Gelände und Flugverhalten simuliert und wie man es steuert.

## Modi

- **Freies Training**: Schirmklasse (EN-A bis CCC), Flachland, Hügelland oder Gebirge, Cumulus, Wolkenstrassen oder Blauthermik, Wind, Thermikqualität, Tageszeit (Vormittag 11:30 mit Thermikaufbau, Mittag 12:00 oder Nachmittag 13:00 mit voll entwickelter Thermik), 0–7 Gegner, Rundendauer. Thermik kann eingeblendet werden, Neustart ist sofort möglich.
- **Tagesaufgabe**: jeden Tag ein festes Wetter aus dem Datum. Dein bester Flug wird als «Rekordflug»-Geist gespeichert und fliegt beim nächsten Versuch mit.
- **Wettkampf**: gegen bis zu 7 Computerpiloten mit unterschiedlichen MacCready-Werten und Können. Hochlaufen kostet 20 Flugminuten.
- **Lernpfad**: 9 Lektionen mit Ziel und Erfolgskontrolle (Zentrieren, Zentrieren mit dem Schieber, Wolken lesen, Sollfahrt im Gegenwind, tiefe Situationen retten, Zurück zum Bart, Linienwahl im Gebirge, Bärte im Wind, Prüfungsflug).

## Wenden und Linienwahl

- **Wenden** (← / →): Eine 180°-Wende dauert 7 Flugsekunden und kostet etwas Höhe. Gezählt wird die Landeposition, Zurückfliegen lohnt sich also nur, wenn ein guter Bart nah hinter dir liegt. Am Handy tippst du dafür die linke Hälfte kurz an (halten heisst kreisen, das beginnt erst nach 0.2 s).
- **Linien im Gebirge** (Q / E): An der **Hangkante** gibt es dichte, kräftige Thermik und Hangaufwind, aber der Grat ist nah. In der **Talmitte** liegt der Boden tief, dafür trägt es schwach, es sinkt etwas stärker und ab Mittag schiebt der Talwind. Der Wechsel dauert knapp eine Flugminute, in der du langsamer vorankommst.
- Computerpiloten nutzen beides: Gute Piloten fliegen mit Höhenreserve an der Kante, weichen tief ins Tal aus und kehren zu einem überflogenen Bart zurück. Anfänger bleiben in der Talmitte.

## Lebenszyklus der Thermik

- **Stärke und Dauer**: Kerne von etwa 2 bis 3.5 m/s (netto im Kreis meist 0.7 bis 2.5 m/s), Lebensdauer 18 bis 38 Minuten.
- **Wachstum von unten**: Die Thermikblase steigt mit doppelter Steiggeschwindigkeit vom Boden auf (bei 1500 m Säule etwa 5 Minuten). Darüber trägt es noch nicht. Die Wolke entsteht erst, wenn die Blase die Basis erreicht, und wächst dann einige Minuten.
- **Abreissen beim Zerfall**: Ab drei Vierteln der Lebensdauer steigt die Unterkante des Barts. Wer tief ist, verliert ihn zuerst.
- **Breiter mit der Höhe**: Unten hat der Bart gut die Hälfte seines vollen Radius, ab 900 m über Grund die volle Breite. Ein reifer Bart ist etwas breiter als ein junger.
- **Stärker unter der Wolke**: Bei Cumulus legt der Bart in den letzten 450 m unter der Basis bis zu 15 % zu (Kondensationswärme). Bei Blauthermik bremst stattdessen die Inversion.
- **Verschmelzen**: Etwa jede fünfte Quelle erzeugt einen Zwillingsbart in 300–520 m Abstand. Nahe Bärte ziehen sich an und verschmelzen zu einem breiteren, kräftigeren Bart mit grösserer Wolke.

## Gelände und Bodenarten

- **Flachland**: flach um 420 m, Start mit der Winde (600 m).
- **Hügelland**: sanfte Hügel bis etwa 800 m, Start mit der Winde (750 m) aus einer Mulde. Über Kuppen löst es etwas besser aus, die Basis liegt höher als im Flachland.
- **Gebirge**: Hangkante und Talmitte, Start am Hang (siehe oben).

Entlang der Strecke wechselt die Bodenbedeckung in Abschnitten von 300 m bis 2.5 km (aus der Saat bestimmt, `coverSeg` in `world.js`). Sie verändert die Stärke der Bärte, die dort auslösen:

| Boden     | Thermik | Darstellung                |
| --------- | ------- | -------------------------- |
| Ortschaft | 115 %   | Häuser mit roten Dächern   |
| Acker     | 110 %   | ockerfarbener Streifen     |
| Fels      | 110 %   | nur im Gebirge über 2050 m |
| Wiese     | 95 %    | grün                       |
| Wald      | 60 %    | Bäume                      |
| See       | keine   | Wasserfläche mit Uferlinie |

- **Abrisskanten**: Wo der Untergrund wechselt, lösen Bärte bevorzugt aus. Liegt eine Quelle bis 400 m neben einer Grenze, wandert der Bart 40 m auf die wärmere Seite (Ortschaft, Acker und Fels vor Wiese, Wiese vor Wald, alles vor Wasser) und wird je nach Unterschied bis 18 % kräftiger.
- **Seen**: keine Thermik; bis 900 m über dem Wasser sinkt es zusätzlich (bis 0.35 m/s direkt über dem Spiegel). Am Startplatz liegt nie ein See, an der Gebirgsflanke auch nicht.
- **Hügelland**: Ohne Kante in der Nähe löst der Bart auf der höchsten Kuppe im Umkreis von 400 m aus. Kuppen tragen besser als Mulden.
- **Gebirge, Hangkante**: Bärte sitzen auf Gipfeln und Graten (höchster Punkt im Umkreis von 600 m). Sie werden mit der Höhe deutlich kräftiger; in Senken zwischen den Gipfeln bleiben sie schwach (bis auf 30 %).
- **Gebirge, Talmitte**: Bärte sind nur halb so stark, und an vier von zehn Stellen entsteht gar keine Thermik.
- **Verschmelzen**: Ein Bart, der schon aus zwei Bärten entstanden ist, verschmilzt nicht noch einmal; die Stärke beim Verschmelzen wächst höchstens bis 5.5 m/s.
- Im Gebirge wächst an der Flanke oberhalb von 1650 m kein Wald mehr. Die Minimap zeigt Seen blau und Wälder dunkelgrün.

## Sonnenstand

Die Strecke führt nach Westen, der Blick geht nach Süden. Die Sonne folgt einem Sommertag in den Alpen (47° N, Höchststand um 13:30 Uhr, `src/js/sim/sun.js`).

- **Himmel und Licht**: Vormittags steht die Sonne links und es liegt Dunst über dem Horizont, der sich bis gegen 12:45 Uhr auflöst. Ab etwa 14 Uhr wird das Licht wärmer.
- **Sonnige Flanke**: Im Gebirge trägt an der Hangkante die Flanke besser, die gerade zur Sonne zeigt: vormittags die Ostflanken (Gelände steigt in Flugrichtung an), nachmittags die Westflanken. Der Effekt liegt bei bis zu ±20 % und verschwindet um 13:30 Uhr.

## Bärte im Wind

- Thermik löst sich an einem festen Punkt am Boden ab und wird beim Aufsteigen vom Wind versetzt. Der Kern auf Höhe h liegt um `0.35 · 833 · (h/1000)^1.2 · Wind / Steigen` Meter leewärts (Windprofil `(h/1000)^0.2`; der Faktor 0.35 berücksichtigt, dass Thermikkerne geschlossener aufsteigen als einzelne Luftpakete). Bei 10 km/h steht ein Bart über 1500 m etwa 0.5 km schräg.
- Auf Flughöhe liegt das Steigen damit luvseitig der Wolke: bei Rückenwind vor ihr, bei Gegenwind hinter ihr.
- Der Wind nimmt mit der Höhe zu. Das Cockpit zeigt den Wind auf deiner Flughöhe.
- Beim Kreisen driftest du mit dem Wind; die Flugspur zeigt das als Schleifen.
- Ab etwa 20 km/h zerreisst der Wind die Bärte: Sie werden schmaler, schwächer und pulsieren.

## Selbst zentrieren

Einstellung «Zentrieren» im Training und Wettkampf (gilt auch für die Tagesaufgabe):

| Stufe       | Kurve                                                                                   | Thermik-Assistent                               |
| ----------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Automatisch | feste Kurve, die Automatik zieht den Kreis bis etwa einen halben Bartradius an den Kern | Draufsicht mit Kern-Markierung, zum Zuschauen   |
| Assistiert  | Kurvenschieber                                                                          | Draufsicht mit Kern-Markierung                  |
| Profi       | Kurvenschieber                                                                          | Draufsicht ohne Kern, nur das gemessene Steigen |

- **Leertaste halten** startet eine moderate Kurve (≈ 40 m Radius) in der zuletzt geflogenen Drehrichtung.
- **Kurvenschieber** mit ← / → (am Handy: den Kreis-Daumen waagrecht ziehen): stufenlos von enger Linkskurve über geradeaus bis zur engen Rechtskurve. Am Handy zeigt ein Feld unten links, wo der Daumen hingehört. Der Assistent steht beim Kreisen rechts an Stelle des Beschleunigers. Der Radius ist `25 m / |Schieber|`; enge Kurven kosten mehr Sinken.
- **Zentrieren**: Wird das Steigen stärker, Kurve aufmachen (Schieber zur Mitte), so fliegt man Richtung Kern. Wird es schwächer, enger eindrehen.
- **Ausleiten**: Beim Loslassen fliegt man in die Richtung weiter, in die man gerade schaut, also auf Kurs oder zurück.
- Die Simulation läuft für alle im gleichen Tempo (keine Zeitlupe), damit später mehrere Piloten gemeinsam fliegen können.
- **Kreistempo**: Weil die Runde die Zeit rafft, läuft die Bewegung relativ zum Bart mit 40 % der Fluggeschwindigkeit (`CIRCLE_PACE` in `pilot.js`). Ein Kreis dauert so etwa 7 statt 2.5 Sekunden Echtzeit. Das gilt auch für das Herausdriften im Wind; Steigen, Bart und Uhr bleiben unverändert. Je weiter die Kurve aufgemacht wird, desto mehr nähert sich das Tempo der Fluggeschwindigkeit.
- Im Test steigt ein Pilot mit dieser Technik ohne Wind etwa 1.6 statt 1.25 m/s (Automatik). Im Wind muss man gegen den Wind nachsetzen: Wer den Kern ansteuert, steigt bei 15 km/h 0.86 statt 0.57 m/s.
- Computerpiloten nutzen die Automatik, je nach Können unterschiedlich nah am Kern.

## Steuerung

| Taste            | Funktion                                                                          |
| ---------------- | --------------------------------------------------------------------------------- |
| Leertaste halten | Kreisen                                                                           |
| ↑ / ↓            | Beschleuniger                                                                     |
| ← / →            | Wenden: zurück / wieder auf Kurs; im Kreis beim selbst Zentrieren: Kurvenschieber |
| Q / E            | Gebirge: Hangkante / Talmitte                                                     |
| Enter            | Starten / Hochlaufen                                                              |
| M                | MacCready-Wert (0–3)                                                              |
| T / C / S / Z    | Thermik, Tipps, Ton, Zoom                                                         |
| X                | Zeitraffer am Boden                                                               |
| F                | Kamera folgt dem Führenden                                                        |
| R                | Neustart (nur Training)                                                           |
| P / Esc          | Pause                                                                             |

Touch: linke Hälfte halten = kreisen, rechts senkrecht wischen = Beschleuniger, beim selbst Zentrieren den Kreis-Daumen waagrecht ziehen = Kurvenschieber.
