import { ChevronDownIcon } from '@heroicons/react/20/solid'
import type { ReactNode } from 'react'

/** Anchors other parts of the page link to. */
export const INFO_TOPICS = {
  storage: 'info-daten',
  keeping: 'info-link-sichern',
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
          <Topic id={INFO_TOPICS.keeping} title="Wie sichere ich meinen Plan?">
            <p>
              Der Plan steckt vollständig im Link in der Adresszeile. Mit jeder Änderung ändert sich
              dieser Link. Es gibt kein Konto und keinen Speichern-Knopf:{' '}
              <strong className="font-semibold text-zinc-900">
                Wer den aktuellen Link hat, hat den aktuellen Plan.
              </strong>
            </p>
            <p>
              Ein gespeicherter Link ist deshalb immer eine Momentaufnahme. Ein Lesezeichen, eine
              E-Mail oder eine Textnachricht zeigen den Stand von dem Moment, in dem sie angelegt
              wurden, und aktualisieren sich nicht von selbst. Nach jeder Planungsrunde müsstest du
              sie neu anlegen.
            </p>
            <p>
              Besser eignet sich ein Ort, an dem du den Link einfach überschreiben kannst: eine
              Notiz in einer Notizen-App oder ein geteiltes Dokument, in das alle Beteiligten
              schauen. Nach dem Planen auf „Link kopieren“ klicken und den alten Link dort ersetzen.
            </p>
            <p>
              Unter dem Titel und im Namen des Browser-Tabs steht, von wann der geöffnete Stand ist.
              Dieselbe Angabe steht lesbar im Link (
              <code className="rounded-sm bg-zinc-100 px-1 py-0.5 text-xs">saved=…</code>). So
              erkennst du einen veralteten Link, bevor du darin weiterplanst.
            </p>
            <p>
              Mit dem Zurück-Knopf des Browsers nimmst du die letzten Änderungen schrittweise
              zurück.
            </p>
          </Topic>

          <Topic id={INFO_TOPICS.storage} title="Welche Daten werden wo gespeichert?">
            <p>
              <strong className="font-semibold text-zinc-900">Im Link:</strong> der gesamte Plan,
              also Bundesland, Namen, Arbeitstage und Urlaubstage der Eltern, alle Zeiträume mit
              Ort, Notiz und Betreuung sowie deine Anpassungen an Ferien und Feiertagen. Der Plan
              wird an keinen Server geschickt und dort nicht gespeichert.
            </p>
            <p>
              <strong className="font-semibold text-zinc-900">In deinem Browser:</strong> zwei
              Dinge, damit die Seite bequemer ist. Erstens die geladenen Ferien und Feiertage je
              Bundesland und Jahr, damit sie nicht bei jedem Besuch neu abgefragt werden. Zweitens
              der zuletzt in diesem Browser bearbeitete Link, damit die Seite ihn dir beim nächsten
              leeren Aufruf wieder anbieten kann. Beides bleibt auf deinem Gerät und lässt sich über
              „Websitedaten löschen“ im Browser entfernen.
            </p>
            <p>
              <strong className="font-semibold text-zinc-900">Wer den Link bekommt</strong>, kann
              alles darin lesen und daraus einen eigenen, geänderten Link machen. Dein Link ändert
              sich dadurch nicht. Teile ihn also nur mit Menschen, die den Plan sehen sollen. Keine
              Cookies, keine Statistik, keine Werbung.
            </p>
          </Topic>

          <Topic title="Welche externen Dienste werden genutzt?">
            <p>
              <strong className="font-semibold text-zinc-900">GitHub Pages</strong> liefert diese
              Seite aus. Dabei verarbeitet GitHub technische Zugriffsdaten wie deine IP-Adresse. Der
              Plan gehört nicht dazu: Er steht hinter dem Fragezeichen im Link und wird nur in
              deinem Browser ausgewertet. Siehe{' '}
              <ExternalLink href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement">
                Datenschutzerklärung von GitHub
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

          <Topic title="Was bedeuten die roten Punkte?">
            <p>
              Ein roter Punkt markiert einen schulfreien Wochentag, für den noch niemand als
              Betreuung eingetragen ist. Das gilt auch für Zeiträume, bei denen die Betreuung noch
              offen ist. Tage in der Vergangenheit werden nicht mehr markiert.
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
