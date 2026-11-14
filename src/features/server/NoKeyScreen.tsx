import { KeyIcon } from '@heroicons/react/24/outline'
import { Link } from '@tanstack/react-router'
import { buttonClass } from '@/components/ui/classes'
import { Wordmark } from '@/components/Wordmark'
import { PrivacyButton } from '@/features/privacy/PrivacyDialog'
import { PRODUCT_CLAIM, PRODUCT_TITLE } from '@/lib/brand'
import { CreatePlan } from './CreatePlan'

/** Shown instead of the planner while this device holds no (valid) key. Only creating a plan calls the API. */
export function NoKeyScreen({ revoked }: { revoked: boolean }) {
  return (
    <main className="mx-auto grid min-h-svh max-w-md content-center gap-6 px-6 py-10">
      <title>{PRODUCT_TITLE}</title>
      <header className="space-y-3 text-center">
        <KeyIcon className="mx-auto size-10 text-sky-700" aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight">
          <Wordmark claim="none" />
        </h1>
        <p className="text-sm text-zinc-600">{PRODUCT_CLAIM}</p>
      </header>
      <p className="text-base/7 text-zinc-700">
        Das ist ein privater Urlaubsplaner für Familien: Schulferien, Feiertage, Brückentage, wo wir
        sind und wer die Kinder betreut. Du brauchst den Link, den du bekommen hast.
      </p>
      {revoked && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200"
        >
          Dieser Link gilt nicht mehr. Frag nach dem neuen Link, um wieder am gemeinsamen Plan
          teilzunehmen.
        </p>
      )}
      <CreatePlan />
      <section className="space-y-3 rounded-xl bg-white p-5 text-left shadow-xs ring-1 ring-zinc-200">
        <h2 className="text-base font-semibold">Nur eine Abstimmung?</h2>
        <p className="text-sm/6 text-zinc-700">
          Zeiträume mit anderen abgleichen, ohne Plan und ohne Einladungswort.
        </p>
        <Link to="/abstimmung" className={buttonClass}>
          Abstimmung starten
        </Link>
      </section>
      <p className="text-center text-sm text-zinc-600">
        <PrivacyButton />
      </p>
    </main>
  )
}
