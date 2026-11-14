import { useState } from 'react'
import { buttonClass, linkClass } from '@/components/ui/classes'
import { Modal } from '@/components/ui/Modal'

export const PRIVACY_DOC_URL =
  'https://github.com/tordans/vacation-planner/blob/main/docs/datenschutz.md'

/** A text-style button that opens the short privacy text. */
export function PrivacyButton({ className = linkClass }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Datenschutz
      </button>
      <PrivacyDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

/** Short version of docs/datenschutz.md. Keep both in step. */
function PrivacyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Datenschutz" size="lg">
      <div className="space-y-4 text-sm/6 text-zinc-700">
        <p>
          vacation.ingsparks.de ist ein privates, nicht kommerzielles Projekt von Tobias Jordans. Es
          gibt keine Konten, keine Cookies, kein Tracking und keine Werbung. Schriften und Code
          kommen von dieser Seite.
        </p>
        <Section title="Was auf dem Server liegt">
          <p>
            Dein Plan liegt auf unserem Webspace bei all-inkl.com in Deutschland,{' '}
            <strong className="font-semibold text-zinc-900">unverschlüsselt</strong> in einer
            Datenbank: Namen (falls du sie einträgst), Termine, Orte, Notizen, Urlaubstage. Lesen
            kann ihn, wer einen deiner Links hat, außerdem der Betreiber und der Hoster. Die Links
            selbst speichert der Server nur als Fingerabdruck (SHA-256).
          </p>
        </Section>
        <Section title="Kalender-Link">
          <p>
            Den geheimen Kalender-Link (iCal) gibt es nur, wenn jemand mit dem Link zum Bearbeiten
            ihn erstellt. Er liefert feste Zeiträume, eigenen Urlaub und eigene schulfreie Tage als
            Termine und kann nichts ändern. Wer ihn in Google, Apple oder Outlook abonniert, gibt
            diesem Anbieter den Link und die Termine. Sein Schlüssel steht in der Adresse und kann
            daher in den Zugriffsprotokollen des Hosters stehen.
          </p>
        </Section>
        <Section title="Abstimmungen">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Die Einträge einer Abstimmung stehen nur im Link nach dem „#“; dieser Teil wird nie an
              einen Server geschickt, auch nicht an unseren.
            </li>
            <li>
              Der Name der Abstimmung steht vorne in der Adresse (z. B. /abstimmung/sommer-2027) und
              erscheint damit wie jede aufgerufene Seite im Zugriffsprotokoll des Hosters.
            </li>
            <li>
              Wer etwas über „In deinen Plan übernehmen“ in seinen Plan übernimmt, speichert es
              damit im Plan auf unserem Server, wie jede andere Änderung am Plan.
            </li>
            <li>Der Link bleibt im Browserverlauf, wie jede Adresse.</li>
          </ul>
        </Section>
        <Section title="Was sonst anfällt">
          <p>
            Falsche Einladungswörter werden kurz gezählt (anonymisierter IP-Fingerabdruck, höchstens
            etwa eine Stunde). Der Webserver beim Hoster schreibt übliche Zugriffsprotokolle (IP,
            Zeit, URL) nach dessen Regeln. Unser Fehlerprotokoll enthält keine Inhalte.
          </p>
        </Section>
        <Section title="Was im Browser liegt">
          <p>
            Dein Zugangsschlüssel (damit die Adresse ohne Link funktioniert) und die geladenen
            Ferien und Feiertage. „Auf diesem Gerät abmelden“ entfernt den Schlüssel; den Rest
            entfernst du über „Websitedaten löschen“.
          </p>
        </Section>
        <Section title="Externe Dienste">
          <p>
            <strong className="font-semibold text-zinc-900">all-inkl.com</strong> (Neue Medien
            Münnich, Deutschland) hostet diese Seite und den Plan und verarbeitet dabei technische
            Zugriffsdaten wie deine IP-Adresse. Siehe{' '}
            <a
              className={linkClass}
              href="https://all-inkl.com/datenschutzinformationen"
              target="_blank"
              rel="noreferrer"
            >
              Datenschutzinformationen von all-inkl.com
            </a>
            .
          </p>
          <p>
            <strong className="font-semibold text-zinc-900">www.mehr-schulferien.de</strong> ist der
            einzige Dienst, den dein Browser selbst aufruft: Ferien und Feiertage. Dort sind deine
            IP-Adresse sowie Bundesland und Jahr sichtbar, nichts aus deinem Plan. Siehe{' '}
            <a
              className={linkClass}
              href="https://www.mehr-schulferien.de/impressum"
              target="_blank"
              rel="noreferrer"
            >
              Impressum und Datenschutz von mehr-schulferien.de
            </a>
            .
          </p>
        </Section>
        <Section title="Löschen">
          <p>
            Einen Plan löschen wir auf Anfrage per E-Mail an t@tobiasjordans.de. Im Browser entfernt
            „Auf diesem Gerät abmelden“ den Schlüssel.
          </p>
        </Section>
        <Section title="Impressum">
          <p>
            Tobias Jordans, Böhmische Straße 54, 12055 Berlin, E-Mail: t@tobiasjordans.de. Privates,
            nicht kommerzielles Projekt.
          </p>
        </Section>
        <p>
          <a className={linkClass} href={PRIVACY_DOC_URL} target="_blank" rel="noreferrer">
            Vollständige Datenschutzhinweise
          </a>
        </p>
      </div>
      <div className="flex justify-end">
        <button type="button" className={buttonClass} onClick={onClose}>
          Schließen
        </button>
      </div>
    </Modal>
  )
}
