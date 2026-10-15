import { useState, type ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type DraftInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'onBlur'> & {
  value: string
  onCommit: (value: string) => void
}

/**
 * Text input that commits every change right away (callers use history `replace`), but keeps
 * showing what was typed until it loses focus, so the cursor never jumps while the URL updates.
 * Committing on change instead of on blur means nothing is lost when the input disappears
 * without a blur, e.g. when a dialog closes with Escape.
 */
export function DraftInput({ value, onCommit, className, ...props }: DraftInputProps) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      {...props}
      className={cn(
        'block w-full rounded-md border-zinc-300 text-sm shadow-xs focus:border-sky-600 focus:ring-sky-600',
        className,
      )}
      value={draft ?? value}
      onChange={(event) => {
        setDraft(event.target.value)
        if (event.target.value !== value) onCommit(event.target.value)
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}
