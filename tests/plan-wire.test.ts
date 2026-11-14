import { describe, expect, it } from 'vitest'
import { decodeWirePlan, toWire } from '@/features/plan/plan-wire'
import { familyPlan } from './fixtures'

describe('wire format for the server', () => {
  it('survives the JSON the server stores', () => {
    const plan = familyPlan()
    plan.parents.mother.name = 'Anna'
    const wire = JSON.parse(JSON.stringify(toWire(plan)))
    expect(decodeWirePlan(wire)).toEqual(plan)
  })

  it('returns null for data that is no plan', () => {
    expect(decodeWirePlan({ v: 2 })).toBeNull()
    expect(decodeWirePlan({})).toBeNull()
    expect(decodeWirePlan(null)).toBeNull()
  })
})
