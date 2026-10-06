import { describe, expect, it } from 'vitest'
import { coverageGaps } from '@/features/plan/coverage-gaps'
import { leaveAccount, rangeCost } from '@/features/plan/leave-account'
import {
  addEntry,
  addPersonalLeave,
  blockersFor,
  freeWindow,
  removeEntry,
  splitEntry,
  toggleCarer,
  updateEntry,
} from '@/features/plan/plan-actions'
import { emptyPlan } from '@/features/plan/plan-schema'
import { decodePlan, encodePlan } from '@/features/plan/plan-url'
import { berlin2027, familyPlan } from './fixtures'

function planWithEntry(start: string, end: string, patch: Parameters<typeof updateEntry>[2]) {
  const added = addEntry(familyPlan(), { start, end })
  return { plan: updateEntry(added.plan, added.id, patch), id: added.id }
}

describe('plan url', () => {
  it('round-trips a plan', () => {
    let { plan } = planWithEntry('2027-07-12', '2027-07-30', {
      kind: 'away',
      place: 'Dänemark',
      note: 'Fähre buchen',
      carers: ['mother', 'father'],
    })
    plan = addPersonalLeave(plan, 'father', { start: '2027-09-06', end: '2027-09-10' }).plan
    plan.parents.mother.name = 'Anna'
    expect(decodePlan(encodePlan(plan))).toEqual(plan)
  })

  it('falls back to an empty plan for broken links', () => {
    expect(decodePlan(undefined)).toEqual(emptyPlan())
    expect(decodePlan('not-a-plan')).toEqual(emptyPlan())
    expect(decodePlan(encodePlan(emptyPlan()).slice(0, 10))).toEqual(emptyPlan())
  })

  it('stays short enough to share', () => {
    let plan = familyPlan()
    for (let month = 1; month <= 12; month++) {
      const mm = String(month).padStart(2, '0')
      const added = addEntry(plan, { start: `2027-${mm}-05`, end: `2027-${mm}-15` })
      plan = updateEntry(added.plan, added.id, { place: `Ort ${month}`, carers: ['mother'] })
    }
    expect(encodePlan(plan).length).toBeLessThan(700)
  })
})

describe('leave account', () => {
  it('charges only working days: the four-day week saves the Fridays', () => {
    // Mon 12.07. – Sun 25.07.2027: two full weeks
    const { plan } = planWithEntry('2027-07-12', '2027-07-25', {
      kind: 'away',
      carers: ['mother', 'father'],
    })
    expect(leaveAccount(plan, 'mother', 2027, berlin2027)).toMatchObject({
      budget: 30,
      family: 10,
      planned: 10,
      remaining: 20,
    })
    expect(leaveAccount(plan, 'father', 2027, berlin2027)).toMatchObject({
      budget: 24,
      family: 8,
      planned: 8,
      remaining: 16,
    })
  })

  it('does not charge public holidays', () => {
    // Easter week Mon 22.03. – Fri 02.04.2027 contains Karfreitag and Ostermontag
    const { plan } = planWithEntry('2027-03-22', '2027-04-02', { carers: ['mother', 'father'] })
    expect(leaveAccount(plan, 'mother', 2027, berlin2027).care).toBe(8)
    // Father: Mon–Thu both weeks = 8, minus Ostermontag = 7; Karfreitag is his day off anyway
    expect(leaveAccount(plan, 'father', 2027, berlin2027).care).toBe(7)
  })

  it('makes the bridge day free for whoever never works Fridays', () => {
    const range = { start: '2027-05-07', end: '2027-05-07' }
    expect(rangeCost(familyPlan(), 'mother', range, berlin2027)).toBe(1)
    expect(rangeCost(familyPlan(), 'father', range, berlin2027)).toBe(0)
  })

  it('charges nobody when the grandparents take over', () => {
    const { plan } = planWithEntry('2027-10-11', '2027-10-15', { carers: ['grandparents'] })
    expect(leaveAccount(plan, 'mother', 2027, berlin2027).planned).toBe(0)
    expect(leaveAccount(plan, 'father', 2027, berlin2027).planned).toBe(0)
  })

  it('counts personal leave separately and never twice', () => {
    let { plan } = planWithEntry('2027-07-12', '2027-07-16', { carers: ['mother'] })
    plan = addPersonalLeave(plan, 'father', { start: '2027-09-06', end: '2027-09-10' }).plan
    // Overlaps the family entry: these days must not be charged a second time.
    plan = addPersonalLeave(plan, 'mother', { start: '2027-07-14', end: '2027-07-20' }).plan
    expect(leaveAccount(plan, 'father', 2027, berlin2027)).toMatchObject({
      personal: 4,
      planned: 4,
    })
    expect(leaveAccount(plan, 'mother', 2027, berlin2027)).toMatchObject({
      care: 5,
      personal: 2,
      planned: 7,
    })
  })

  it('splits a period across New Year between both budgets', () => {
    const { plan } = planWithEntry('2027-12-27', '2028-01-07', { carers: ['mother'] })
    expect(leaveAccount(plan, 'mother', 2027, berlin2027).planned).toBe(5)
    // The 2028 holidays are not loaded in this fixture, so all ten January weekdays count.
    expect(leaveAccount(plan, 'mother', 2028, berlin2027).planned).toBe(5)
  })
})

describe('coverage gaps', () => {
  it('lists school-free weekdays without care', () => {
    const gaps = coverageGaps(familyPlan(), 2027, berlin2027)
    expect(gaps.has('2027-07-01')).toBe(true)
    expect(gaps.has('2027-07-03')).toBe(false) // Saturday
    expect(gaps.has('2027-03-26')).toBe(false) // Karfreitag
    expect(gaps.has('2026-12-23')).toBe(false) // previous year
    expect(gaps.size).toBe(5 + 8 + 1 + 2 + 32 + 10 + 8)
  })

  it('closes gaps once someone takes care, but not while care is open', () => {
    const open = addEntry(familyPlan(), { start: '2027-02-01', end: '2027-02-05' })
    expect(coverageGaps(open.plan, 2027, berlin2027).has('2027-02-01')).toBe(true)
    const covered = toggleCarer(open.plan, open.id, 'grandparents')
    expect(coverageGaps(covered, 2027, berlin2027).has('2027-02-01')).toBe(false)
  })
})

describe('plan actions', () => {
  it('splits an entry into two with the same care', () => {
    const { plan, id } = planWithEntry('2027-07-12', '2027-07-25', { carers: ['mother'] })
    const split = splitEntry(plan, id, '2027-07-19')
    expect(split.entries.map(({ start, end, carers }) => ({ start, end, carers }))).toEqual([
      { start: '2027-07-12', end: '2027-07-18', carers: ['mother'] },
      { start: '2027-07-19', end: '2027-07-25', carers: ['mother'] },
    ])
  })

  it('removes an entry', () => {
    const { plan, id } = planWithEntry('2027-07-12', '2027-07-25', {})
    expect(removeEntry(plan, id).entries).toEqual([])
  })

  it('keeps bars between their neighbours', () => {
    let plan = addEntry(familyPlan(), { start: '2027-07-01', end: '2027-07-09' }).plan
    plan = addEntry(plan, { start: '2027-07-20', end: '2027-07-30' }).plan
    const limits = { start: '2027-06-01', end: '2027-08-31' }
    const blockers = blockersFor(plan, { row: 'family' })
    expect(freeWindow(blockers, { start: '2027-07-12', end: '2027-07-12' }, limits)).toEqual({
      start: '2027-07-10',
      end: '2027-07-19',
    })
    expect(freeWindow(blockers, { start: '2027-07-05', end: '2027-07-05' }, limits)).toBeNull()
    expect(freeWindow(blockers, { start: '2027-08-05', end: '2027-08-05' }, limits)).toEqual({
      start: '2027-07-31',
      end: '2027-08-31',
    })
  })

  it('blocks personal leave only where the parent already cares', () => {
    const { plan } = planWithEntry('2027-07-12', '2027-07-16', { carers: ['mother'] })
    expect(blockersFor(plan, { row: 'mother' })).toHaveLength(1)
    expect(blockersFor(plan, { row: 'father' })).toHaveLength(0)
  })
})
