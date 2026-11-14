/** The three sentences everyone has to understand before they enter anything. */
export function HowItWorks() {
  return (
    <section className="space-y-2 rounded-lg bg-sky-50 p-4 ring-1 ring-sky-200">
      <h2 className="text-base font-semibold text-sky-950">So funktioniert die Abstimmung</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm/6 text-sky-950">
        <li>
          Trag ein, wann ihr könnt: Familie anlegen, Ferien laden oder Zeiträume von Hand eintragen.
        </li>
        <li>
          Kopier danach den Link und schick ihn zurück. Jede Änderung ändert den Link – der alte
          Link zeigt deine Einträge nicht.
        </li>
        <li>Gespeichert wird nichts: Alles steht nur in diesem Link.</li>
      </ol>
    </section>
  )
}
