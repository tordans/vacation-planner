import { Link } from '@tanstack/react-router'
import { linkClass } from '@/components/ui/classes'
import { Wordmark } from '@/components/Wordmark'

/** Brand and the way back to the planner, for every poll page. */
export function PollHeader() {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <p className="text-sm font-semibold tracking-tight text-zinc-700">
        <Wordmark claim="none" />
      </p>
      <Link to="/" className={`${linkClass} text-sm`}>
        Zum Urlaubsplaner
      </Link>
    </header>
  )
}
