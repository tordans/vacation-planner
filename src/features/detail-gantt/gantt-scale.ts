import type { DayRange } from '@/features/plan/plan-actions'
import { addDays, daysBetween, type IsoDay } from '@/lib/dates'

export const ZOOM_LEVELS = [14, 20, 28, 40, 56] as const
export const DEFAULT_ZOOM_INDEX = 2
export const MAX_RANGE_DAYS = 400

export type Scale = {
  range: DayRange
  dayWidth: number
  dayCount: number
}

export function createScale(range: DayRange, dayWidth: number): Scale {
  return { range, dayWidth, dayCount: daysBetween(range.start, range.end) + 1 }
}

/** Day under a horizontal pixel offset inside the timeline, clamped to the visible range. */
export function dayAtOffset(scale: Scale, offsetX: number): IsoDay {
  const index = Math.min(Math.max(Math.floor(offsetX / scale.dayWidth), 0), scale.dayCount - 1)
  return addDays(scale.range.start, index)
}

/** Pixel box of a period, clipped to the visible range. Null when fully outside. */
export function boxFor(scale: Scale, period: DayRange) {
  if (period.end < scale.range.start || period.start > scale.range.end) return null
  const startIndex = Math.max(daysBetween(scale.range.start, period.start), 0)
  const endIndex = Math.min(daysBetween(scale.range.start, period.end), scale.dayCount - 1)
  return {
    left: startIndex * scale.dayWidth,
    width: (endIndex - startIndex + 1) * scale.dayWidth,
    clippedStart: period.start < scale.range.start,
    clippedEnd: period.end > scale.range.end,
  }
}

export type DragMode = 'create' | 'move' | 'resize-start' | 'resize-end'

/**
 * Where a bar ends up while dragging: follows the pointer day, keeps its length when moved,
 * and never leaves the free window between its neighbours.
 */
export function dragPreview(
  mode: DragMode,
  origin: DayRange,
  anchor: IsoDay,
  pointer: IsoDay,
  window: DayRange,
): DayRange {
  const clamp = (day: IsoDay) =>
    day < window.start ? window.start : day > window.end ? window.end : day
  switch (mode) {
    case 'create': {
      const target = clamp(pointer)
      return target < anchor ? { start: target, end: anchor } : { start: anchor, end: target }
    }
    case 'move': {
      const length = daysBetween(origin.start, origin.end)
      const latestStart = addDays(window.end, -length)
      let start = addDays(origin.start, daysBetween(anchor, pointer))
      if (start < window.start) start = window.start
      if (start > latestStart) start = latestStart
      return { start, end: addDays(start, length) }
    }
    case 'resize-start': {
      const start = clamp(pointer)
      return { start: start > origin.end ? origin.end : start, end: origin.end }
    }
    case 'resize-end': {
      const end = clamp(pointer)
      return { start: origin.start, end: end < origin.start ? origin.start : end }
    }
  }
}
