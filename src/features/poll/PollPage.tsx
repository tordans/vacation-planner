import { getRouteApi, useLocation, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useKeyState } from '@/features/server/key-store'
import { PRODUCT_NAME } from '@/lib/brand'
import { CopyLink, type LinkStatus } from './CopyLink'
import { HowItWorks } from './HowItWorks'
import { pollRows } from './poll-data'
import type { UpdatePoll } from './poll-schema'
import { titleFromSlug } from './poll-slug'
import { pollFromHash, pollToHash } from './poll-url'
import { PollChart } from './PollChart'
import { PollEditor } from './PollEditor'
import { PollHeader } from './PollHeader'
import { TakeOver } from './TakeOver'

const routeApi = getRouteApi('/abstimmung/$name')

/** `/abstimmung/<name>#d=…`: everything the poll knows is in the address. */
export function PollPage() {
  const { name } = routeApi.useParams()
  const router = useRouter()
  const hash = useLocation({ select: (location) => location.hash })
  const navigate = routeApi.useNavigate()
  const { key } = useKeyState()
  const [status, setStatus] = useState<LinkStatus>('initial')
  const poll = useMemo(() => pollFromHash(hash), [hash])
  const title = poll.title ?? titleFromSlug(name)

  /**
   * Every change goes through here. It reads the poll from the address at call time, because
   * the rendered poll can be older (a holiday load may finish after other edits). The router's
   * history is updated at once, unlike the rendered `poll`.
   */
  const updatePoll: UpdatePoll = (update, since = router.history.location.pathname) => {
    if (router.history.location.pathname !== since) return false
    const latest = pollFromHash(router.history.location.hash)
    const next = update(latest)
    if (next === latest) return false
    setStatus('changed')
    void navigate({ hash: pollToHash(next), replace: true, resetScroll: false })
    return true
  }

  return (
    <div className="mx-auto max-w-[96rem] space-y-6 px-4 py-6 sm:px-6">
      <title>{`${title} – Abstimmung – ${PRODUCT_NAME}`}</title>
      <PollHeader />
      <main className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <HowItWorks />
        <CopyLink status={status} onStatus={setStatus} />
        {poll.sections.length === 0 ? (
          <p className="rounded-lg bg-white p-4 text-sm text-zinc-600 shadow-xs ring-1 ring-zinc-200">
            Noch keine Familie eingetragen.
          </p>
        ) : (
          <PollChart rows={pollRows(poll)} />
        )}
        {key !== null && <TakeOver planKey={key} poll={poll} />}
        <PollEditor poll={poll} updatePoll={updatePoll} />
      </main>
    </div>
  )
}
