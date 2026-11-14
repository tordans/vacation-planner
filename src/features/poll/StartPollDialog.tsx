import { ChatBubbleLeftRightIcon } from '@heroicons/react/20/solid'
import { useNavigate } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { buttonClass, inputClass, primaryButtonClass } from '@/components/ui/classes'
import { Modal } from '@/components/ui/Modal'
import type { Period } from '@/features/holidays/periods'
import type { Plan } from '@/features/plan/plan-schema'
import { defaultFamilyName, ideasOfYear, pollFromPlan } from './poll-from-plan'
import { MAX_TITLE_LENGTH } from './poll-schema'
import { slugify } from './poll-slug'
import { pollToHash } from './poll-url'

type StartPollProps = {
  plan: Plan
  year: number
  /** School holidays of the plan's calendar, corrections included. */
  schoolHolidays: Period[]
}

/** Header button of the planner: starts a poll with this plan's family already in it. */
export function StartPollButton(props: StartPollProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
        <ChatBubbleLeftRightIcon className="size-4 text-zinc-500" />
        Abstimmung
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Abstimmung starten">
        <StartPollForm {...props} onClose={() => setOpen(false)} />
      </Modal>
    </>
  )
}

function StartPollForm({
  plan,
  year,
  schoolHolidays,
  onClose,
}: StartPollProps & { onClose: () => void }) {
  const id = useId()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [familyName, setFamilyName] = useState(() => defaultFamilyName(plan))
  const [withHolidays, setWithHolidays] = useState(true)
  const [withIdeas, setWithIdeas] = useState(true)
  const ideaCount = ideasOfYear(plan, year).length
  const slug = slugify(title)
  const canStart = slug !== '' && familyName.trim() !== ''

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!canStart) return
        const poll = pollFromPlan(plan, {
          title,
          familyName,
          year,
          schoolHolidays: withHolidays ? schoolHolidays : null,
          withIdeas: withIdeas && ideaCount > 0,
        })
        void navigate({ to: '/abstimmung/$name', params: { name: slug }, hash: pollToHash(poll) })
      }}
    >
      <p className="text-sm/6 text-zinc-700">
        Du bekommst einen Link, den du verschicken kannst. Er enthält nur die Abstimmung, nicht
        deinen Plan.
      </p>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-title`} className="block text-sm font-medium">
          Wie heißt die Abstimmung?
        </label>
        <input
          id={`${id}-title`}
          autoComplete="off"
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Sommer 2027 mit Oma"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-family`} className="block text-sm font-medium">
          Name unserer Familie
        </label>
        <input
          id={`${id}-family`}
          autoComplete="off"
          maxLength={60}
          value={familyName}
          onChange={(event) => setFamilyName(event.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={withHolidays}
            onChange={(event) => setWithHolidays(event.target.checked)}
            className="rounded border-zinc-300 text-sky-700 focus:ring-sky-600"
          />
          Unsere Schulferien {year} eintragen
        </label>
        {ideaCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={withIdeas}
              onChange={(event) => setWithIdeas(event.target.checked)}
              className="rounded border-zinc-300 text-sky-700 focus:ring-sky-600"
            />
            Unsere Ideen {year} als Chancen eintragen
          </label>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={buttonClass} onClick={onClose}>
          Abbrechen
        </button>
        <button type="submit" className={primaryButtonClass} disabled={!canStart}>
          Abstimmung anlegen
        </button>
      </div>
    </form>
  )
}
