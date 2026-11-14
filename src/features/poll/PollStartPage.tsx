import { useNavigate } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { inputClass, primaryButtonClass } from '@/components/ui/classes'
import { PRODUCT_NAME } from '@/lib/brand'
import { MAX_TITLE_LENGTH } from './poll-schema'
import { slugify } from './poll-slug'
import { pollToHash } from './poll-url'
import { PollHeader } from './PollHeader'

/** `/abstimmung`: the name becomes the address of the poll. */
export function PollStartPage() {
  const nameId = useId()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const slug = slugify(name)

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <title>{`Abstimmung anlegen – ${PRODUCT_NAME}`}</title>
      <PollHeader />
      <main className="space-y-4 rounded-xl bg-white p-5 shadow-xs ring-1 ring-zinc-200">
        <h1 className="text-xl font-semibold tracking-tight">Neue Abstimmung</h1>
        <p className="text-sm/6 text-zinc-700">
          Zeiträume mit anderen abgleichen, ohne Plan und ohne Einladungswort. Du legst die
          Abstimmung an und schickst den Link weiter; die anderen tragen ihre Zeiten ein und
          schicken dir den neuen Link zurück.
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (slug === '') return
            void navigate({
              to: '/abstimmung/$name',
              params: { name: slug },
              hash: pollToHash({ title: name.trim().slice(0, MAX_TITLE_LENGTH), sections: [] }),
            })
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor={nameId} className="block text-sm font-medium">
              Wie heißt die Abstimmung?
            </label>
            <input
              id={nameId}
              type="text"
              name="name"
              autoComplete="off"
              maxLength={MAX_TITLE_LENGTH}
              placeholder="Sommer 2027 mit Oma"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </div>
          <button type="submit" className={primaryButtonClass} disabled={slug === ''}>
            Abstimmung anlegen
          </button>
        </form>
      </main>
    </div>
  )
}
