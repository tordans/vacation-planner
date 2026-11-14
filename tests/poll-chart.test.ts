import { describe, expect, it } from 'vitest'
import { computeChartLayout, frameOf } from '@/features/poll/poll-chart'
import type { PollRow } from '@/features/poll/poll-data'

function row(kind: PollRow['kind'], start: string, end: string): PollRow {
  return {
    section: kind === 'chancen' ? 'Chancen' : 'Familie',
    kind,
    familyIndex: 0,
    range: { id: 'r1', name: 'X', start, end },
    firstInSection: true,
  }
}

describe('chart layout', () => {
  it('has nothing to draw without ranges', () => {
    expect(computeChartLayout([], '2027-07-01')).toBeNull()
  })

  it('spans whole weeks with a week of room on each side', () => {
    // 2027-07-14 is a Wednesday, 2027-07-30 a Friday.
    const layout = computeChartLayout([row('family', '2027-07-14', '2027-07-30')], '2027-07-20')!
    expect(layout.start).toBe('2027-07-05')
    expect(layout.dayCount % 7).toBe(0)
    expect(layout.dayCount).toBe(35)
    expect(layout.weekCount).toBe(5)
  })

  it('places bars including their last day', () => {
    const layout = computeChartLayout([row('family', '2027-07-14', '2027-07-30')], '2027-07-20')!
    const frame = frameOf(layout, { id: 'r1', name: 'X', start: '2027-07-12', end: '2027-07-18' })
    expect(frame.left).toBeCloseTo((7 / 35) * 100)
    expect(frame.width).toBeCloseTo((7 / 35) * 100)
  })

  it('highlights Chancen and marks today only when it is in view', () => {
    const rows = [
      row('family', '2027-07-14', '2027-07-30'),
      row('chancen', '2027-07-20', '2027-07-21'),
    ]
    expect(computeChartLayout(rows, '2027-07-12')!.chancen).toHaveLength(1)
    expect(computeChartLayout(rows, '2027-07-05')!.today).toBeCloseTo(0)
    expect(computeChartLayout(rows, '2027-01-01')!.today).toBeNull()
  })

  it('labels months, and the first and each January with the year', () => {
    const layout = computeChartLayout([row('family', '2027-12-10', '2028-02-10')], '2027-01-01')!
    expect(layout.months.map((month) => month.label)).toEqual(['Dez 2027', 'Jan 2028', 'Feb'])
  })
})
