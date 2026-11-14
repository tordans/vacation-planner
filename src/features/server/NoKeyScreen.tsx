import { KeyIcon } from '@heroicons/react/24/outline'

/** Shown instead of the planner while this device holds no (valid) key. No API calls happen. */
export function NoKeyScreen({ revoked }: { revoked: boolean }) {
  return (
    <main className="mx-auto grid min-h-svh max-w-md place-content-center gap-5 px-6 py-10 text-center">
      <title>Urlaubsplaner</title>
      <KeyIcon className="mx-auto size-10 text-sky-700" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">Urlaubsplaner</h1>
      <p className="text-base/7 text-zinc-700">
        Das ist der private Urlaubsplaner einer Familie. Du brauchst den Link, den du bekommen hast.
      </p>
      {revoked && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 px-4 py-3 text-left text-sm text-amber-950 ring-1 ring-amber-200"
        >
          Dieser Link gilt nicht mehr. Frag nach dem neuen Link, um wieder am gemeinsamen Plan
          teilzunehmen.
        </p>
      )}
    </main>
  )
}
