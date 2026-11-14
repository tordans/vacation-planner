import { addEntry, addHousehold, updateEntry } from '@/features/plan/plan-actions'
import type { Plan } from '@/features/plan/plan-schema'
import { chancenOf, familiesOf } from './poll-data'
import { defaultFamilyName } from './poll-from-plan'
import type { Poll, PollRange } from './poll-schema'

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Something from the poll that can go into the plan; `done` when the plan has it already. */
export type TakeoverItem =
  | { kind: 'household'; name: string; federalState: string; done: boolean }
  | { kind: 'no-federal-state'; name: string }
  | { kind: 'idea'; range: PollRange; done: boolean }

/**
 * What the plan can take from a poll: families as households (their school holidays then come
 * from the federal state), Chancen as ideas. The plan's own family, which the poll was started
 * from, is skipped; it is recognised by its default name and, if set, its federal state.
 */
export function takeoverItems(plan: Plan, poll: Poll): TakeoverItem[] {
  const own = defaultFamilyName(plan)
  const items: TakeoverItem[] = []
  for (const family of familiesOf(poll)) {
    const isOwn =
      sameName(family.name, own) &&
      (family.federalState === undefined || family.federalState === plan.federalState)
    if (isOwn) continue
    if (family.federalState === undefined) {
      items.push({ kind: 'no-federal-state', name: family.name })
    } else {
      items.push({
        kind: 'household',
        name: family.name,
        federalState: family.federalState,
        done: plan.households.some((household) => sameName(household.name, family.name)),
      })
    }
  }
  for (const range of chancenOf(poll)?.ranges ?? []) {
    items.push({
      kind: 'idea',
      range,
      done: plan.entries.some(
        (entry) => entry.isIdea && entry.start === range.start && entry.end === range.end,
      ),
    })
  }
  return items
}

export function takeOverHousehold(plan: Plan, name: string, federalState: string): Plan {
  return addHousehold(plan, { name, federalState }).plan
}

/** An idea for the range, named after the Chancen entry. */
export function takeOverIdea(plan: Plan, range: PollRange): Plan {
  const added = addEntry(plan, { start: range.start, end: range.end }, true)
  return updateEntry(added.plan, added.id, { place: range.name })
}
