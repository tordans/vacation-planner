# Datenschutz: was wo liegt und wer was sehen kann

Technische Beschreibung für Nutzer:innen von vacation.ingsparks.de
und für alle, die den Code selbst betreiben. Stand: November 2026, gilt für den Code in diesem
Repository. Keine Rechtsberatung; wer eine eigene Instanz öffentlich betreibt, ist selbst für
Datenschutzerklärung und ggf. Impressum verantwortlich. Die App zeigt eine Kurzfassung unter
„Datenschutz“.

## Verantwortlich und Impressum

Tobias Jordans, Böhmische Straße 54, 12055 Berlin, E-Mail: t@tobiasjordans.de. Privates, nicht
kommerzielles Projekt.

Kontakt für Fragen, Auskunft und das Löschen eines Plans: dieselbe Adresse.

## Grundsätze

- Es gibt keine Konten und keine Registrierung, keine Cookies, kein Tracking und keine Werbung.
  Schrift, Icons und Code werden vom eigenen Server geladen; die Content-Security-Policy erlaubt
  nur die eigene Domain und die eine Ausnahme unten.
- Wer den Plan sehen oder ändern will, braucht einen Link. Wer keinen hat, kann nichts öffnen. Einen
  eigenen Plan legt nur an, wer das Einladungswort kennt, das wir persönlich weitergeben.
- Der einzige Dienst von Dritten ist die Ferien-Schnittstelle **www.mehr-schulferien.de**. Dein
  Browser ruft sie direkt auf (nicht über unseren Server). Der Dienst sieht dabei deine IP-Adresse
  und welches Bundesland und Jahr abgefragt wird, nichts aus deinem Plan. Siehe dessen
  [Impressum und Datenschutzerklärung](https://www.mehr-schulferien.de/impressum).

## Im Browser

| Was                                                                                                          | Wo                                                                          | Hinweis                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Zugangsschlüssel (der Teil nach `#key=` aus deinem Link; bestimmt, ob du bearbeiten oder nur ansehen darfst) | `localStorage`, Schlüssel `vacation-planner:key:v1`                         | Damit die Adresse ohne Link funktioniert, etwa vom Startbildschirm.                       |
| Geladene Ferien und Feiertage je Bundesland und Jahr, mit Abrufzeit                                          | `localStorage`, Schlüssel `vacation-planner:periods:v2:<Bundesland>:<Jahr>` | Damit sie nicht bei jedem Besuch neu abgefragt werden; nach etwa einem Monat neu geladen. |

Der Plan selbst liegt nicht im Browser, sondern nur auf dem Server. Wer Zugriff auf das entsperrte
Gerät bzw. Browserprofil hat, kann den Plan mit dem gespeicherten Schlüssel öffnen. Der Schlüssel
steht nur kurz in der Adresszeile; die App entfernt ihn nach dem Öffnen des Links. Der Teil nach
`#` wird von Browsern nie an einen Server gesendet und taucht deshalb nicht in Zugriffsprotokollen
auf.

## Auf dem Server

Der Server ist Webspace bei **all-inkl.com** (ALL-INKL.COM – Neue Medien Münnich) in Deutschland,
mit PHP und einer MySQL-Datenbank.

| Was                                                                                                                                                                                                                                                           | Form                                                                                                                                                 | Lesbar für                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Der Plan: Bundesland, Namen der Eltern und anderer Haushalte (optional, frei wählbar), Arbeitstage und Urlaubstage, Zeiträume mit Orten, Notizen und Betreuung, Anpassungen an Ferien und Feiertagen, eigene schulfreie Tage, Abwesenheiten anderer Haushalte | **Klartext** (JSON) in der Datenbank. Keine Ende-zu-Ende-Verschlüsselung                                                                             | wer den Link zum Bearbeiten oder zum Ansehen hat; der Betreiber; der Hoster                                                  |
| Link-Schlüssel (Bearbeiten und Ansehen)                                                                                                                                                                                                                       | nur als SHA-256-Fingerabdruck; der Schlüssel selbst wird nur einmal beim Anlegen oder Erneuern angezeigt                                             | – (nicht umkehrbar)                                                                                                          |
| Einladungswort                                                                                                                                                                                                                                                | nur als SHA-256-Fingerabdruck in der Konfiguration                                                                                                   | –                                                                                                                            |
| Fehlversuche mit dem Einladungswort                                                                                                                                                                                                                           | IP-Adresse gemischt mit einem täglich wechselnden Salz und gehasht (keine Klar-IP), mit Zeitpunkt; Zeilen älter als etwa eine Stunde werden gelöscht | Betreiber, Hoster                                                                                                            |
| Fehlerprotokoll der API                                                                                                                                                                                                                                       | kurze Fehlermeldungen ohne Inhalte der Anfrage                                                                                                       | Betreiber                                                                                                                    |
| Zugriffsprotokolle des Webservers (IP-Adresse, Zeit, aufgerufene Adresse, Browser)                                                                                                                                                                            | beim Hoster                                                                                                                                          | Hoster, nach dessen Regeln; siehe [Datenschutzinformationen von all-inkl.com](https://all-inkl.com/datenschutzinformationen) |

Der Plan ist **nicht verschlüsselt**, damit der Server die Links prüfen und Änderungen annehmen
kann, ohne Passphrasen zu verwalten. Trag deshalb nur ein, was du auch einem Webhoster in Deutschland
anvertrauen würdest. Vollständige Namen und genaue Adressen sind nicht nötig; die App kommt mit
Vornamen oder Kürzeln aus.

Pro Plan gibt es zwei Links, aber keine Nutzerkonten und keine Zuordnung zu Personen. Die Server-
Datenbank enthält keine E-Mail-Adressen und keine Klar-IP-Adressen.

## Wer kann was?

|                                                      | Link zum Bearbeiten | Link zum Ansehen |
| ---------------------------------------------------- | ------------------- | ---------------- |
| Plan lesen, einschließlich Notizen und Urlaubskonten | ja                  | ja               |
| Plan ändern                                          | ja                  | nein             |
| Links erneuern                                       | ja                  | nein             |

- **Links erneuern:** Im Menü „Gemeinsamer Plan“ gibt es „Ansicht-Link erneuern“ und
  „Bearbeiten-Link erneuern“. Der neue Link wird einmal angezeigt; der alte gilt sofort nicht mehr,
  auf allen Geräten. Wer den alten öffnet, sieht „Dieser Link gilt nicht mehr“. Weil nur
  Fingerabdrücke gespeichert sind, kann niemand einen verlorenen Link wieder anzeigen; er lässt sich
  nur erneuern. Speichere den Link zum Bearbeiten deshalb sicher, zum Beispiel in einem
  Passwortmanager.
- **Weitergabe:** Wer einen Link weitergibt, gibt den Zugriff weiter. Gib den Link zum Ansehen an
  alle, die nur schauen sollen, den Link zum Bearbeiten nur an Mitbearbeitende.
- **Eigene Pläne:** Das Einladungswort schützt davor, dass Fremde Pläne auf dem Server anlegen. Es
  schützt keinen bestehenden Plan.

## Löschen

- **Ein Plan:** Auf Anfrage an den Betreiber (E-Mail oben) löscht dieser den Plan samt Schlüsseln aus
  der Datenbank. Dazu den Link zum Bearbeiten (oder einen Hinweis, welcher Plan gemeint ist) mitteilen.
  Eine Löschfunktion in der App gibt es noch nicht.
- **Im Browser:** „Auf diesem Gerät abmelden“ (Menü „Gemeinsamer Plan“ bzw. „Zugang“) entfernt den
  Zugangsschlüssel. Die gemerkten Ferien und Feiertage verschwinden über „Websitedaten löschen“ in
  den Browser-Einstellungen.
- **Zugriffsprotokolle** beim Hoster löscht dieser nach seinen Fristen.
