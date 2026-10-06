import { buildCalendar } from '@/features/holidays/periods'
import { emptyPlan, type Plan } from '@/features/plan/plan-schema'

/** Berlin 2027 as returned by mehr-schulferien.de (fetched 2026-10-06). */
export const BERLIN_2027 = {
  schoolHolidays: [
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-02' },
    { name: 'Winterferien', start: '2027-02-01', end: '2027-02-06' },
    { name: 'Osterferien', start: '2027-03-22', end: '2027-04-02' },
    { name: 'Himmelfahrt (schulfrei)', start: '2027-05-07', end: '2027-05-07' },
    { name: 'Pfingstferien', start: '2027-05-18', end: '2027-05-19' },
    { name: 'Sommerferien', start: '2027-07-01', end: '2027-08-14' },
    { name: 'Herbstferien', start: '2027-10-11', end: '2027-10-23' },
    { name: 'Weihnachtsferien', start: '2027-12-22', end: '2027-12-31' },
  ],
  publicHolidays: [
    { name: 'Neujahrstag', start: '2027-01-01', end: '2027-01-01' },
    { name: 'Frauentag', start: '2027-03-08', end: '2027-03-08' },
    { name: 'Karfreitag', start: '2027-03-26', end: '2027-03-26' },
    { name: 'Ostermontag', start: '2027-03-29', end: '2027-03-29' },
    { name: 'Tag der Arbeit', start: '2027-05-01', end: '2027-05-01' },
    { name: 'Christi Himmelfahrt', start: '2027-05-06', end: '2027-05-06' },
    { name: 'Pfingstmontag', start: '2027-05-17', end: '2027-05-17' },
    { name: 'Tag der Deutschen Einheit', start: '2027-10-03', end: '2027-10-03' },
    { name: '1. Weihnachtstag', start: '2027-12-25', end: '2027-12-25' },
    { name: '2. Weihnachtstag', start: '2027-12-26', end: '2027-12-26' },
  ],
}

export const berlin2027 = buildCalendar([BERLIN_2027])

/** Father works Mon–Thu (four-day week), mother Mon–Fri. */
export function familyPlan(): Plan {
  const plan = emptyPlan()
  plan.parents.father.workingDays = [1, 2, 3, 4]
  plan.parents.father.leaveDaysByYear = { 2027: 24 }
  plan.parents.mother.leaveDaysByYear = { 2027: 30 }
  return plan
}
