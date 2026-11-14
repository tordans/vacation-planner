import { describe, expect, it } from 'vitest'
import { addEntry, addHousehold, updateEntry, updateParent } from '@/features/plan/plan-actions'
import { emptyPlan, type Plan } from '@/features/plan/plan-schema'
import { addFamily, addHolidays, addRange } from '@/features/poll/poll-data'
import { defaultFamilyName, ideasOfYear, pollFromPlan } from '@/features/poll/poll-from-plan'
import { EMPTY_POLL, type Poll } from '@/features/poll/poll-schema'
import { takeOverHousehold, takeOverIdea, takeoverItems } from '@/features/poll/poll-takeover'

function planWithIdea(): Plan {
  const added = addEntry(emptyPlan(), { start: '2027-08-01', end: '2027-08-14' }, true)
  return updateEntry(added.plan, added.id, { place: 'Ostsee' })
}

const holidays = [
  { name: 'Sommerferien', start: '2027-07-01', end: '2027-08-13' },
  { name: 'Herbstferien', start: '2027-10-11', end: '2027-10-23' },
  { name: 'Weihnachtsferien', start: '2027-12-22', end: '2028-01-02' },
  { name: 'Osterferien 2026', start: '2026-03-30', end: '2026-04-10' },
]

describe('default family name', () => {
  it('joins the names that are set', () => {
    let plan = emptyPlan()
    expect(defaultFamilyName(plan)).toBe('Unsere Familie')
    plan = updateParent(plan, 'mother', { name: ' Anna ' })
    expect(defaultFamilyName(plan)).toBe('Anna')
    plan = updateParent(plan, 'father', { name: 'Ben' })
    expect(defaultFamilyName(plan)).toBe('Anna & Ben')
  })
})

describe('poll from plan', () => {
  it('puts in the family with its school holidays of the year and the federal state', () => {
    const plan = { ...planWithIdea(), federalState: 'BY' }
    const poll = pollFromPlan(plan, {
      title: ' Sommer 2027 ',
      familyName: 'Anna & Ben',
      year: 2027,
      schoolHolidays: holidays,
      withIdeas: false,
    })
    expect(poll.title).toBe('Sommer 2027')
    expect(poll.sections).toHaveLength(1)
    expect(poll.sections[0]).toMatchObject({ name: 'Anna & Ben', federalState: 'BY' })
    expect(poll.sections[0]?.ranges.map((range) => range.name)).toEqual([
      'Sommerferien',
      'Herbstferien',
      'Weihnachtsferien',
    ])
  })

  it('leaves out holidays and ideas when asked, and names ideas after their place', () => {
    const plan = planWithIdea()
    const bare = pollFromPlan(plan, {
      title: 'X',
      familyName: 'F',
      year: 2027,
      schoolHolidays: null,
      withIdeas: false,
    })
    expect(bare.sections).toEqual([{ name: 'F', ranges: [] }])
    const withIdeas = pollFromPlan(plan, {
      title: 'X',
      familyName: 'F',
      year: 2027,
      schoolHolidays: null,
      withIdeas: true,
    })
    expect(withIdeas.sections[1]).toMatchObject({
      name: 'Chancen',
      ranges: [{ name: 'Ostsee', start: '2027-08-01', end: '2027-08-14' }],
    })
    expect(ideasOfYear(plan, 2028)).toEqual([])
  })

  it('falls back to the default family name when the plan name is "Chancen"', () => {
    const poll = pollFromPlan(planWithIdea(), {
      title: 'X',
      familyName: ' Chancen ',
      year: 2027,
      schoolHolidays: null,
      withIdeas: false,
    })
    expect(poll.sections).toEqual([{ name: 'Unsere Familie', ranges: [] }])
  })

  it('calls an idea without a place "Idee" and skips fixed entries', () => {
    let plan = addEntry(emptyPlan(), { start: '2027-05-01', end: '2027-05-03' }, true).plan
    plan = addEntry(plan, { start: '2027-06-01', end: '2027-06-03' }).plan
    const poll = pollFromPlan(plan, {
      title: 'X',
      familyName: 'F',
      year: 2027,
      schoolHolidays: null,
      withIdeas: true,
    })
    expect(poll.sections[1]?.ranges.map((range) => range.name)).toEqual(['Idee'])
  })
})

function sampleCompletePoll(): Poll {
  let poll = addFamily(addFamily(addFamily(EMPTY_POLL, 'Oma'), 'Cousins'), 'Anna & Ben')
  poll = addHolidays(poll, 'Oma', 'NI', [])
  poll = addHolidays(poll, 'Anna & Ben', 'BE', [])
  poll = addRange(poll, 'Chancen', { name: 'Besuch', start: '2027-08-01', end: '2027-08-14' })
  return addRange(poll, 'Chancen', { name: 'Wochenende', start: '2027-09-03', end: '2027-09-05' })
}

describe('take over', () => {
  it('offers families with a federal state, notes the others, and skips the own family', () => {
    let plan = updateParent(updateParent(emptyPlan(), 'mother', { name: 'Anna' }), 'father', {
      name: 'Ben',
    })
    plan = { ...plan, federalState: 'BE' }
    expect(
      takeoverItems(plan, sampleCompletePoll()).map((item) => [
        item.kind,
        'name' in item ? item.name : item.range.name,
      ]),
    ).toEqual([
      ['household', 'Oma'],
      ['no-federal-state', 'Cousins'],
      ['idea', 'Besuch'],
      ['idea', 'Wochenende'],
    ])
  })

  it('does not skip a family that only has the same name in another federal state', () => {
    const plan = { ...updateParent(emptyPlan(), 'mother', { name: 'Anna' }), federalState: 'BY' }
    let poll = addFamily(EMPTY_POLL, 'Anna')
    poll = addHolidays(poll, 'Anna', 'BE', [])
    expect(takeoverItems(plan, poll)).toEqual([
      { kind: 'household', name: 'Anna', federalState: 'BE', done: false },
    ])
  })

  it('marks what the plan already has, ignoring case', () => {
    let plan = planWithIdea()
    plan = addHousehold(plan, { name: 'oma', federalState: 'NI' }).plan
    const items = takeoverItems(plan, sampleCompletePoll())
    expect(items.find((item) => item.kind === 'household')).toMatchObject({ done: true })
    // Same start and end as the idea in the plan: done; the other one is not.
    expect(items.filter((item) => item.kind === 'idea').map((item) => item.done)).toEqual([
      true,
      false,
    ])
  })

  it('takes a family over as a household and a Chancen range as an idea', () => {
    const plan = takeOverIdea(takeOverHousehold(emptyPlan(), 'Oma', 'NI'), {
      id: 'r1',
      name: 'Besuch',
      start: '2027-08-01',
      end: '2027-08-14',
    })
    expect(plan.households).toMatchObject([
      { id: 'h0', name: 'Oma', federalState: 'NI', absences: [] },
    ])
    expect(plan.entries).toMatchObject([
      { start: '2027-08-01', end: '2027-08-14', isIdea: true, place: 'Besuch' },
    ])
    const again = takeoverItems(plan, sampleCompletePoll())
    expect(again.filter((item) => item.kind !== 'no-federal-state' && item.done)).toHaveLength(2)
  })
})
