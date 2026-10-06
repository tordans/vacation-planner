import type { Carer, StayKind } from './plan-schema'

/** Shared colours so calendar, chart, lists and legend always agree. */
export const STAY_STYLES: Record<StayKind, { bar: string; soft: string; label: string }> = {
  away: { bar: 'bg-sky-600', soft: 'bg-sky-100 text-sky-900', label: 'Unterwegs' },
  home: { bar: 'bg-emerald-600', soft: 'bg-emerald-100 text-emerald-900', label: 'Zuhause' },
}

export const CARER_STYLES: Record<Carer, { bar: string; soft: string; dot: string }> = {
  mother: { bar: 'bg-fuchsia-600', soft: 'bg-fuchsia-100 text-fuchsia-900', dot: 'bg-fuchsia-600' },
  father: { bar: 'bg-indigo-600', soft: 'bg-indigo-100 text-indigo-900', dot: 'bg-indigo-600' },
  grandparents: { bar: 'bg-lime-700', soft: 'bg-lime-100 text-lime-900', dot: 'bg-lime-700' },
}

export function stayTitle(stay: { kind: StayKind; place: string }) {
  return stay.place.trim() || STAY_STYLES[stay.kind].label
}
