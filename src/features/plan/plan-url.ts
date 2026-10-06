import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import {
  CARERS,
  emptyPlan,
  PARENT_ROLES,
  wirePlanSchema,
  type Carer,
  type Parent,
  type ParentRole,
  type Plan,
  type WirePlan,
} from './plan-schema'

function carersToMask(carers: Carer[]) {
  return CARERS.reduce(
    (mask, carer, index) => (carers.includes(carer) ? mask | (1 << index) : mask),
    0,
  )
}

function maskToCarers(mask: number) {
  return CARERS.filter((_, index) => (mask & (1 << index)) !== 0)
}

function toWireParent(parent: Parent): WirePlan['p'][number] {
  const leave = Object.entries(parent.leaveDaysByYear)
  return {
    ...(parent.name.trim() ? { n: parent.name.trim() } : {}),
    w: parent.workingDays.toSorted((a, b) => a - b),
    ...(leave.length > 0 ? { l: Object.fromEntries(leave) } : {}),
  }
}

function fromWireParent(role: ParentRole, wire: WirePlan['p'][number]): Parent {
  const leaveDaysByYear: Record<number, number> = {}
  for (const [year, days] of Object.entries(wire.l ?? {})) {
    if (/^\d{4}$/.test(year)) leaveDaysByYear[Number(year)] = days
  }
  return { role, name: wire.n ?? '', workingDays: [...new Set(wire.w)], leaveDaysByYear }
}

function toWire(plan: Plan): WirePlan {
  return {
    v: 1,
    s: plan.federalState,
    p: [toWireParent(plan.parents.mother), toWireParent(plan.parents.father)],
    e: plan.entries.map((entry) => [
      entry.start,
      entry.end,
      entry.kind === 'away' ? 1 : 0,
      carersToMask(entry.carers),
      entry.place,
      entry.note,
    ]),
    x: plan.personalLeave.map((leave) => [
      leave.parent === 'mother' ? 0 : 1,
      leave.start,
      leave.end,
      leave.kind === 'away' ? 1 : 0,
      leave.place,
      leave.note,
    ]),
    ...(plan.customDays.length > 0
      ? { d: plan.customDays.map((day) => [day.start, day.end, day.name] as const) }
      : {}),
    ...(plan.adjustments.length > 0
      ? {
          a: plan.adjustments.map((adjustment) => {
            const shown = adjustment.replacement ?? { ...adjustment, name: '' }
            return [
              adjustment.kind === 'public' ? 1 : 0,
              adjustment.start,
              adjustment.end,
              adjustment.replacement === null ? 1 : 0,
              shown.start,
              shown.end,
              shown.name,
            ] as const
          }),
        }
      : {}),
  }
}

function fromWire(wire: WirePlan): Plan {
  return {
    federalState: wire.s,
    parents: {
      mother: fromWireParent('mother', wire.p[0]),
      father: fromWireParent('father', wire.p[1]),
    },
    entries: wire.e
      .filter(([start, end]) => start <= end)
      .map(([start, end, kind, mask, place, note], index) => ({
        id: `e${index}`,
        start,
        end,
        kind: kind === 1 ? 'away' : 'home',
        carers: maskToCarers(mask),
        place,
        note,
      })),
    personalLeave: wire.x
      .filter(([, start, end]) => start <= end)
      .map(([parent, start, end, kind, place, note], index) => ({
        id: `x${index}`,
        parent: PARENT_ROLES[parent],
        start,
        end,
        kind: kind === 1 ? 'away' : 'home',
        place,
        note,
      })),
    customDays: (wire.d ?? [])
      .filter(([start, end]) => start <= end)
      .map(([start, end, name]) => ({ name, start, end })),
    adjustments: (wire.a ?? []).map(([kind, start, end, removed, newStart, newEnd, name]) => ({
      kind: kind === 1 ? 'public' : 'school',
      start,
      end,
      replacement:
        removed === 1 || newStart > newEnd ? null : { name, start: newStart, end: newEnd },
    })),
  }
}

/** Ids are positional (`e0`, `x3`); re-number after every structural change. */
export function withFreshIds(plan: Plan): Plan {
  return {
    ...plan,
    entries: plan.entries.map((entry, index) => ({ ...entry, id: `e${index}` })),
    personalLeave: plan.personalLeave.map((leave, index) => ({ ...leave, id: `x${index}` })),
  }
}

export function encodePlan(plan: Plan) {
  return compressToEncodedURIComponent(JSON.stringify(toWire(plan)))
}

/** Never throws: a broken or outdated link falls back to an empty plan. */
export function decodePlan(encoded: string | undefined): Plan {
  if (!encoded) return emptyPlan()
  try {
    const json = decompressFromEncodedURIComponent(encoded)
    if (!json) return emptyPlan()
    const result = wirePlanSchema.safeParse(JSON.parse(json))
    return result.success ? fromWire(result.data) : emptyPlan()
  } catch {
    return emptyPlan()
  }
}
