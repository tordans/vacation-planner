import { useId, useState } from 'react'
import { buttonClass, inputClass } from '@/components/ui/classes'
import { addFamily, findSection, isChancen } from './poll-data'
import type { Poll } from './poll-schema'

type AddFamilyFormProps = {
  poll: Poll
  onChange: (poll: Poll) => void
}

export function AddFamilyForm({ poll, onChange }: AddFamilyFormProps) {
  const id = useId()
  const [name, setName] = useState('')
  const trimmed = name.trim()
  const problem = isChancen(trimmed)
    ? '„Chancen“ ist für gemeinsame Zeiträume reserviert.'
    : findSection(poll, trimmed)
      ? 'Diese Familie gibt es schon.'
      : null

  return (
    <form
      className="space-y-1"
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed === '' || problem) return
        onChange(addFamily(poll, trimmed))
        setName('')
      }}
    >
      <label htmlFor={id} className="block text-sm font-medium">
        Familie hinzufügen
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          maxLength={60}
          autoComplete="off"
          placeholder="Familie Schmidt"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
        />
        <button type="submit" className={buttonClass} disabled={trimmed === '' || problem !== null}>
          Anlegen
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-xs text-red-800">
          {problem}
        </p>
      )}
    </form>
  )
}
