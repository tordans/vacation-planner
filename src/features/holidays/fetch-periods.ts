import { z } from 'zod'
import { isIsoDay } from '@/lib/dates'
import { normalizePeriods, schoolHolidayLabel, type Period, type YearPeriods } from './periods'

const API_BASE = 'https://www.mehr-schulferien.de/api/v2.1'

const apiResponseSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      starts_on: z.string().refine(isIsoDay),
      ends_on: z.string().refine(isIsoDay),
    }),
  ),
})

const cachedSchema = z.object({
  schoolHolidays: z.array(z.object({ name: z.string(), start: z.string(), end: z.string() })),
  publicHolidays: z.array(z.object({ name: z.string(), start: z.string(), end: z.string() })),
})

function cacheKey(slug: string, year: number) {
  return `vacation-planner:periods:v1:${slug}:${year}`
}

function readCache(key: string): YearPeriods | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const result = cachedSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

function writeCache(key: string, periods: YearPeriods) {
  try {
    localStorage.setItem(key, JSON.stringify(periods))
  } catch {
    // Storage full or blocked: the next visit simply fetches again.
  }
}

async function fetchKind(slug: string, year: number, kind: 'vacation' | 'holiday') {
  const url = `${API_BASE}/federal-states/${slug}/periods?start_date=${year}-01-01&end_date=${year}-12-31&type=${kind}`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`mehr-schulferien.de antwortet mit Fehler ${response.status}`)
  }
  const body = apiResponseSchema.parse(await response.json())
  return body.data.map<Period>((item) => ({
    name: kind === 'vacation' ? schoolHolidayLabel(item.name) : item.name,
    start: item.starts_on,
    end: item.ends_on,
  }))
}

/** School and public holidays overlapping the year. Loaded once per browser, then cached. */
export async function fetchYearPeriods(slug: string, year: number): Promise<YearPeriods> {
  const key = cacheKey(slug, year)
  const cached = readCache(key)
  if (cached) return cached

  const [schoolHolidays, publicHolidays] = await Promise.all([
    fetchKind(slug, year, 'vacation'),
    fetchKind(slug, year, 'holiday'),
  ])
  const periods = {
    schoolHolidays: normalizePeriods(schoolHolidays),
    publicHolidays: normalizePeriods(publicHolidays),
  }
  // Far-future years are not published yet; keep asking until they are.
  if (periods.schoolHolidays.length > 0 && periods.publicHolidays.length > 0) {
    writeCache(key, periods)
  }
  return periods
}
