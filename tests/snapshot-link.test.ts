import { describe, expect, it } from 'vitest'
import { decodePlan, decodeWirePlan, encodePlan, toWire } from '@/features/plan/plan-url'
import { snapshotLink } from '@/features/server/snapshot-link'
import { routerSearch } from '@/lib/router-search'
import { appSearchSchema } from '@/lib/search'
import { familyPlan } from './fixtures'

describe('wire format for the server', () => {
  it('round-trips a plan without compression', () => {
    const plan = familyPlan()
    plan.parents.mother.name = 'Anna'
    const wire = JSON.parse(JSON.stringify(toWire(plan)))
    expect(decodeWirePlan(wire)).toEqual(plan)
  })

  it('is the same data the link carries', () => {
    const plan = familyPlan()
    expect(decodePlan(encodePlan(plan))).toEqual(decodeWirePlan(toWire(plan)))
  })

  it('returns null for data that is no plan', () => {
    expect(decodeWirePlan({ v: 2 })).toBeNull()
    expect(decodeWirePlan({})).toBeNull()
    expect(decodeWirePlan(null)).toBeNull()
  })
})

describe('snapshot link', () => {
  const plan = familyPlan()
  const link = snapshotLink({
    base: 'https://urlaub.example/',
    plan,
    year: 2027,
    saved: '2026-11-14T13:00',
    showOthers: true,
  })

  it("has today's URL format and never the key", () => {
    expect(link.startsWith('https://urlaub.example/?year=2027&saved=2026-11-14T13:00&plan=')).toBe(
      true,
    )
    expect(link).not.toContain('key')
  })

  it('opens as the same plan in link mode', () => {
    const search = appSearchSchema.parse(routerSearch.parse(link.slice(link.indexOf('?'))))
    expect(search.year).toBe(2027)
    expect(search.saved).toBe('2026-11-14T13:00')
    expect(decodePlan(search.plan)).toEqual(plan)
  })

  it('keeps hidden households hidden', () => {
    const hidden = snapshotLink({
      base: 'https://urlaub.example/',
      plan,
      year: 2027,
      saved: '2026-11-14T13:00',
      showOthers: false,
    })
    expect(hidden).toContain('others=hide')
  })
})
