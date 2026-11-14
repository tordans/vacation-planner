import { ChevronDownIcon } from '@heroicons/react/20/solid'
import type { ReactNode } from 'react'

/** Anchors other parts of the page link to. */
export const INFO_TOPICS = {
  keeping: 'info-plan-ablage',
} as const

/** Opens a topic in the footer and scrolls to it. */
export function showInfoTopic(id: string) {
  const topic = document.getElementById(id)
  if (!(topic instanceof HTMLDetailsElement)) return
  topic.open = true
  topic.scrollIntoView({ behavior: 'smooth', block: 'center' })
  topic.querySelector('summary')?.focus({ preventScroll: true })
}

const linkClass = 'font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900'

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={linkClass} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

type TopicProps = {
  id?: string
  title: string
  children: ReactNode
}

function Topic({ id, title, children }: TopicProps) {
  return (
    <details
      id={id}
      className="group scroll-mt-6 rounded-lg bg-white shadow-xs ring-1 ring-zinc-200 open:ring-zinc-300 print:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-semibold outline-none select-none hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-600 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDownIcon className="size-5 shrink-0 text-zinc-400 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="space-y-3 px-4 pb-4 text-sm/6 text-zinc-700">{children}</div>
    </details>
  )
}

/** Explanations about data, saving and counting, as collapsible topics in two columns. */
export function InfoFooter() {
  return (
    <footer className="space-y-4 border-t border-zinc-200 pt-6">
      <h2 className="text-base font-semibold">Gut zu wissen</h2>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <Topic id={INFO_TOPICS.keeping} title="Wo liegt der Plan?">
            <p>
              Der Plan liegt gemeinsam auf dem Server. Er wird eine Sekunde nach jeder Änderung
              automatisch gespeichert, es gibt keinen Speichern-Knopf. Oben steht, wann zuletzt
              gespeichert wurde. Wer den Link zum Bearbeiten hat, sieht immer den aktuellen Stand;
              die Seite schaut nach Änderungen anderer, sobald du zu ihr zurückkehrst.
            </p>
            <p>
              Ändern zwei Menschen gleichzeitig, gewinnt, wer zuletzt speichert. Die Seite zeigt
              dann den neuen Stand und fragt, ob die eigene Änderung trotzdem gespeichert werden
              soll. Ohne Verbindung bleibt die Änderung auf dem Bildschirm und wird gespeichert,
              sobald es wieder klappt.
            </p>
          </Topic>

          <Topic title="Welche Daten werden wo gespeichert?">
            <p>
              <strong className="font-semibold text-zinc-900">Auf dem Server:</strong> der
              gemeinsame Plan, also Bundesland, Namen, Arbeitstage und Urlaubstage der Eltern, alle
              Zeiträume mit Ort, Notiz und Betreuung, Anpassungen an Ferien und Feiertagen sowie
              andere Haushalte mit ihren Abwesenheiten. Er liegt auf unserem eigenen Webspace bei
              all-inkl.com in Deutschland, unverschlüsselt in einer Datenbank. Wer den Server und
              die Datenbank verwaltet, kann ihn lesen; wie bei allem auf eigenem Webspace.
            </p>
            <p>
              <strong className="font-semibold text-zinc-900">Wer den Plan sehen kann:</strong>{' '}
              jeder, der einen der beiden Links hat. Der Link zum Ansehen zeigt alles, auch Notizen
              und Urlaubskonten, und kann nichts ändern. Der Link zum Bearbeiten kann auch ändern.
              Teile die Links nur mit Menschen, die den Plan sehen sollen. Der Server speichert von
              den Links nur einen Fingerabdruck, nicht den Link selbst.
            </p>
            <p>
              <strong className="font-semibold text-zinc-900">Links austauschen:</strong> Ein Link
              wird ersetzt, indem wir seinen Schlüssel auf dem Server austauschen und die Seite neu
              ausliefern. Danach gilt der alte Link nicht mehr; die Seite meldet dann „Dieser Link
              gilt nicht mehr“.
            </p>
            <p>
              <strong className="font-semibold text-zinc-900">In deinem Browser:</strong> zwei
              Dinge, damit die Seite bequemer ist. Erstens die geladenen Ferien und Feiertage je
              Bundesland und Jahr, damit sie nicht bei jedem Besuch neu abgefragt werden. Zweitens
              der Zugangsschlüssel, nachdem du den Zugangslink geöffnet hast; so funktioniert auch
              die Adresse ohne Schlüssel, etwa vom Startbildschirm. „Auf diesem Gerät abmelden“
              entfernt ihn wieder. Alles bleibt auf deinem Gerät und lässt sich über „Websitedaten
              löschen“ im Browser entfernen. Keine Cookies, keine Statistik, keine Werbung.
            </p>
          </Topic>

          <Topic title="Welche externen Dienste werden genutzt?">
            <p>
              <strong className="font-semibold text-zinc-900">all-inkl.com</strong> liefert diese
              Seite aus und speichert den gemeinsamen Plan, auf unserem Webspace in Deutschland.
              Dabei verarbeitet der Anbieter technische Zugriffsdaten wie deine IP-Adresse. Siehe{' '}
              <ExternalLink href="https://all-inkl.com/datenschutzinformationen">
                Datenschutzinformationen von all-inkl.com
              </ExternalLink>
              .
            </p>
            <p>
              <strong className="font-semibold text-zinc-900">mehr-schulferien.de</strong> liefert
              Ferien und Feiertage. Dein Browser fragt dort einmal je Bundesland und Jahr an und
              merkt sich das Ergebnis; übertragen werden nur Bundesland und Jahr, nichts aus deinem
              Plan. Siehe{' '}
              <ExternalLink href="https://www.mehr-schulferien.de/developers/api">
                Beschreibung der Schnittstelle
              </ExternalLink>{' '}
              und{' '}
              <ExternalLink href="https://www.mehr-schulferien.de/impressum">
                Impressum und Datenschutzerklärung von mehr-schulferien.de
              </ExternalLink>
              .
            </p>
            <p>Schriften und alles Weitere kommen direkt von dieser Seite, nicht von Dritten.</p>
          </Topic>
        </div>

        <div className="space-y-3">
          <Topic title="Wie werden Urlaubstage gezählt?">
            <p>
              Ein Urlaubstag wird nur an Tagen abgezogen, an denen die Person laut Einstellungen
              arbeitet und die kein Feiertag sind. Wochenenden, der freie Tag einer Vier-Tage-Woche
              und Feiertage kosten nichts. In der Detailplanung sind diese Tage schraffiert.
            </p>
            <p>Gezählt wird alles, wofür Urlaub nötig ist:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Betreuung zu Hause: Zeiträume „Zuhause“, in denen die Person betreut</li>
              <li>Familienurlaub: Zeiträume „Unterwegs“, in denen die Person dabei ist</li>
              <li>Eigener Urlaub: Urlaub, den die Person für sich in ihrer Zeile einträgt</li>
            </ul>
            <p>
              Betreuen die Großeltern, kostet das niemanden Urlaub. Zeiträume über den Jahreswechsel
              werden tageweise dem jeweiligen Jahr zugerechnet. Halbe Tage gibt es nicht; Resturlaub
              trägst du einfach in die Urlaubstage des Jahres mit ein.
            </p>
          </Topic>

          <Topic title="Woher kommen Ferien und Feiertage?">
            <p>
              Sie werden für das gewählte Bundesland von mehr-schulferien.de geladen. Brückentage
              berechnet die Seite selbst: der Freitag nach einem Feiertag am Donnerstag und der
              Montag vor einem Feiertag am Dienstag.
            </p>
            <p>
              Über „Anpassen“ bei den Ferien und Feiertagen kannst du einzelne Termine korrigieren
              oder entfernen und eigene schulfreie Tage ergänzen, zum Beispiel Studientage oder
              Schließzeiten des Horts. Für Jahre, die noch nicht veröffentlicht sind, bleibt der
              Kalender leer.
            </p>
          </Topic>

          <Topic title="Wie plane ich mit Ideen?">
            <p>
              Unter „Wo sind wir“ ziehst du in der Zeile „+ Idee“ Zeiträume auf, die noch nicht
              entschieden sind, zum Beispiel „bei den einen Großeltern“ und „bei den anderen“. Ideen
              dürfen sich überschneiden, auch mit festen Zeiträumen.
            </p>
            <p>
              Ideen kosten keine Urlaubstage und zählen nicht als Betreuung; der Editor zeigt aber,
              was sie kosten würden. Mit „Fest einplanen“ wird eine Idee zu einem festen Zeitraum,
              sobald sie sich mit keinem anderen festen Zeitraum überschneidet.
            </p>
          </Topic>

          <Topic title="Was bedeuten die roten Punkte?">
            <p>
              Ein roter Punkt markiert einen schulfreien Wochentag, für den noch niemand als
              Betreuung eingetragen ist. Das gilt auch für Zeiträume, bei denen die Betreuung noch
              offen ist. Tage in der Vergangenheit werden nicht mehr markiert.
            </p>
          </Topic>

          <Topic title="Was sind andere Haushalte?">
            <p>
              Du kannst weitere Haushalte anlegen, zum Beispiel Oma & Opa oder die Cousinen. Mit
              einem Bundesland erscheinen deren Schulferien als Information in ihrer Zeile.
            </p>
            <p>
              Außerdem trägst du ein, wann sie nicht zu Hause sind. So siehst du, wann ein Besuch
              sich lohnt.
            </p>
            <p>
              Das ist nur Information: Andere Haushalte brauchen keine Betreuung, kosten keine
              Urlaubstage und erzeugen keine roten Punkte. Über den Schalter „Andere Haushalte“
              lassen sie sich ausblenden; die Adresse trägt dann{' '}
              <code className="rounded-sm bg-zinc-100 px-1 py-0.5 text-xs">others=hide</code>.
            </p>
          </Topic>

          <Topic title="Wer steckt dahinter?">
            <p>
              Ein privates, nicht kommerzielles Projekt. Der{' '}
              <ExternalLink href="https://github.com/tordans/vacation-planner">
                Quellcode liegt auf GitHub
              </ExternalLink>{' '}
              und steht unter der Lizenz AGPL-3.0. Fehler und Wünsche gern dort als Issue.
            </p>
          </Topic>
        </div>
      </div>
    </footer>
  )
}
