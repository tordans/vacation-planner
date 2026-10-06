import { useState, type ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type DraftInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'onBlur'> & {
  value: string
  onCommit: (value: string) => void
}

/** Text input that keeps typing local and commits on blur or Enter (one URL write per edit). */
export function DraftInput({ value, onCommit, className, ...props }: DraftInputProps) {
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    if (draft !== null && draft !== value) onCommit(draft)
    setDraft(null)
  }

  return (
    <input
      {...props}
      className={cn(
        'block w-full rounded-md border-zinc-300 text-sm shadow-xs focus:border-sky-600 focus:ring-sky-600',
        className,
      )}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}
