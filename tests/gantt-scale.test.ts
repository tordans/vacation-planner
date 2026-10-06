import { describe, expect, it } from 'vitest'
import { boxFor, createScale, dayAtOffset, dragPreview } from '@/features/detail-gantt/gantt-scale'

const scale = createScale({ start: '2027-07-01', end: '2027-07-31' }, 20)

describe('gantt scale', () => {
  it('maps pixels to days and clamps to the visible range', () => {
    expect(dayAtOffset(scale, 0)).toBe('2027-07-01')
    expect(dayAtOffset(scale, 59)).toBe('2027-07-03')
    expect(dayAtOffset(scale, -50)).toBe('2027-07-01')
    expect(dayAtOffset(scale, 99_999)).toBe('2027-07-31')
  })

  it('positions bars and clips them at the edges', () => {
    expect(boxFor(scale, { start: '2027-07-03', end: '2027-07-05' })).toEqual({
      left: 40,
      width: 60,
      clippedStart: false,
      clippedEnd: false,
    })
    expect(boxFor(scale, { start: '2027-06-20', end: '2027-07-02' })).toMatchObject({
      left: 0,
      width: 40,
      clippedStart: true,
    })
    expect(boxFor(scale, { start: '2027-08-02', end: '2027-08-05' })).toBeNull()
  })
})

describe('dragPreview', () => {
  const window = { start: '2027-07-05', end: '2027-07-25' }
  const origin = { start: '2027-07-10', end: '2027-07-14' }

  it('creates in both directions from the anchor', () => {
    const anchor = { start: '2027-07-10', end: '2027-07-10' }
    expect(dragPreview('create', anchor, '2027-07-10', '2027-07-13', window)).toEqual({
      start: '2027-07-10',
      end: '2027-07-13',
    })
    expect(dragPreview('create', anchor, '2027-07-10', '2027-07-01', window)).toEqual({
      start: '2027-07-05',
      end: '2027-07-10',
    })
  })

  it('moves a bar without changing its length and stops at the neighbours', () => {
    expect(dragPreview('move', origin, '2027-07-12', '2027-07-15', window)).toEqual({
      start: '2027-07-13',
      end: '2027-07-17',
    })
    expect(dragPreview('move', origin, '2027-07-12', '2027-07-31', window)).toEqual({
      start: '2027-07-21',
      end: '2027-07-25',
    })
    expect(dragPreview('move', origin, '2027-07-12', '2027-07-01', window)).toEqual({
      start: '2027-07-05',
      end: '2027-07-09',
    })
  })

  it('resizes one edge and never inverts the bar', () => {
    expect(dragPreview('resize-end', origin, '2027-07-14', '2027-07-30', window)).toEqual({
      start: '2027-07-10',
      end: '2027-07-25',
    })
    expect(dragPreview('resize-end', origin, '2027-07-14', '2027-07-08', window)).toEqual({
      start: '2027-07-10',
      end: '2027-07-10',
    })
    expect(dragPreview('resize-start', origin, '2027-07-10', '2027-07-20', window)).toEqual({
      start: '2027-07-14',
      end: '2027-07-14',
    })
  })
})
