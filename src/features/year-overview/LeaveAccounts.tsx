import type { Calendar } from '@/features/holidays/periods'
import {
  LEAVE_CATEGORY_LABELS,
  leaveAccount,
  type LeaveCategory,
} from '@/features/plan/leave-account'
import { PARENT_ROLES, parentLabel, type Plan } from '@/features/plan/plan-schema'
import { CARER_STYLES } from '@/features/plan/styles'
import { cn } from '@/lib/cn'
import { WEEKDAY_LABELS } from '@/lib/dates'

const CATEGORY_BAR: Record<LeaveCategory, string> = {
  care: 'bg-emerald-600',
  family: 'bg-sky-600',
  personal: 'bg-violet-500',
}

const CATEGORIES: LeaveCategory[] = ['care', 'family', 'personal']

type LeaveAccountsProps = {
  plan: Plan
  year: number
  calendar: Calendar
}

/** Leave budget per parent: everything the plan uses, split by what it is used for. */
export function LeaveAccounts({ plan, year, calendar }: LeaveAccountsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PARENT_ROLES.map((role) => {
        const account = leaveAccount(plan, role, year, calendar)
        const parent = plan.parents[role]
        const scale = Math.max(account.budget, account.planned, 1)
        return (
          <section key={role} className="rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-200">
            <header className="flex items-baseline justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span className={cn('size-2.5 rounded-full', CARER_STYLES[role].dot)} />
                {parentLabel(plan, role)}
              </h3>
              <p className="text-xs text-zinc-500">
                arbeitet{' '}
                {parent.workingDays.length > 0
                  ? parent.workingDays
                      .toSorted((a, b) => a - b)
                      .map((weekday) => WEEKDAY_LABELS[weekday - 1])
                      .join(' ')
                  : 'an keinem Tag'}
              </p>
            </header>
            <p className="mt-2 flex items-baseline gap-2">
              <span
                className={cn(
                  'text-3xl font-semibold tabular-nums',
                  account.remaining < 0 && 'text-red-600',
                )}
              >
                {account.remaining}
              </span>
              <span className="text-sm text-zinc-600">
                von {account.budget} Urlaubstagen {year} übrig
              </span>
            </p>
            <div
              className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-zinc-100"
              role="img"
              aria-label={`${account.planned} von ${account.budget} Urlaubstagen verplant`}
            >
              {CATEGORIES.map((category) => (
                <span
                  key={category}
                  className={CATEGORY_BAR[category]}
                  style={{ width: `${(account[category] / scale) * 100}%` }}
                />
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              {CATEGORIES.map((category) => (
                <div key={category}>
                  <dt className="flex items-center gap-1.5 text-zinc-600">
                    <span className={cn('size-2 shrink-0 rounded-full', CATEGORY_BAR[category])} />
                    {LEAVE_CATEGORY_LABELS[category]}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium tabular-nums">{account[category]}</dd>
                </div>
              ))}
            </dl>
            {account.remaining < 0 && (
              <p className="mt-3 text-xs font-medium text-red-600">
                {account.remaining === -1 ? '1 Tag' : `${-account.remaining} Tage`} mehr verplant
                als vorhanden.
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}
