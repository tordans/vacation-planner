import { z } from 'zod'
import type { WirePlan } from '@/features/plan/plan-schema'
import { isValidKey } from './key-hash'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** `data` is the plan in wire format; whether it is understood is decided when decoding it. */
const serverPlanSchema = z.object({
  version: z.number().int().nonnegative(),
  updatedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  data: z.record(z.string(), z.unknown()),
})

export type ServerPlan = z.infer<typeof serverPlanSchema>

const ROLES = ['edit', 'view'] as const
export type Role = (typeof ROLES)[number]
/** The links an edit key can renew: the two plan links and the calendar link. */
export type LinkKind = Role | 'calendar'

const getPlanSchema = z.object({
  role: z.enum(ROLES),
  plan: serverPlanSchema.nullable(),
})

export type PlanResponse = z.infer<typeof getPlanSchema>

const putPlanSchema = z.object({
  version: z.number().int().nonnegative(),
  updatedAt: serverPlanSchema.shape.updatedAt,
})

const conflictSchema = z.object({ plan: serverPlanSchema })

export type PutPlanResult =
  | { ok: true; version: number; updatedAt: string }
  | { ok: false; conflict: ServerPlan }

const keySchema = z.string().refine(isValidKey)

const createPlanSchema = z.object({ editKey: keySchema, viewKey: keySchema })

const renewKeySchema = z.object({ key: keySchema })

/** Why creating a plan failed, as the API reports it (403, 429, 503). */
export type CreatePlanFailure = 'invalid_invite' | 'rate_limited' | 'plans_full'

export type CreatePlanResult =
  | { ok: true; editKey: string; viewKey: string }
  | { ok: false; reason: CreatePlanFailure }

const CREATE_FAILURES: Record<number, CreatePlanFailure> = {
  403: 'invalid_invite',
  429: 'rate_limited',
  503: 'plans_full',
}

async function readJson<T>(response: Response, label: string, schema: z.ZodType<T>): Promise<T> {
  let json: unknown
  try {
    json = await response.json()
  } catch {
    throw new ApiError(response.status, `${label}: response is not valid JSON`)
  }
  const result = schema.safeParse(json)
  if (!result.success) throw new ApiError(response.status, `${label}: unexpected response shape`)
  return result.data
}

function assertOk(response: Response, label: string) {
  if (!response.ok) {
    throw new ApiError(response.status, `${label} failed with HTTP ${response.status}`)
  }
}

/**
 * `POST /api/plans`: creates a plan with the invite word. Needs no key. A refused request is a
 * result (so the screen can say why); network errors and unexpected answers throw.
 */
export async function createPlan(
  invite: string,
  {
    baseUrl = '',
    fetch = (input, init) => globalThis.fetch(input, init),
  }: { baseUrl?: string; fetch?: FetchLike } = {},
): Promise<CreatePlanResult> {
  const label = 'POST /api/plans'
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/plans`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invite }),
  })
  const reason = CREATE_FAILURES[response.status]
  if (reason) return { ok: false, reason }
  assertOk(response, label)
  return { ok: true, ...(await readJson(response, label, createPlanSchema)) }
}

export function createApiClient({
  key,
  baseUrl = '',
  fetch = (input, init) => globalThis.fetch(input, init),
}: {
  key: string
  baseUrl?: string
  fetch?: FetchLike
}) {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/plan`

  function call(method: string, headers: Record<string, string>, body?: unknown) {
    return fetch(url, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  return {
    /** Throws `ApiError` (401: key unknown) or the network error; `plan` is `null` before the first save. */
    async getPlan(): Promise<PlanResponse> {
      const label = 'GET /api/plan'
      const response = await call('GET', {})
      assertOk(response, label)
      return readJson(response, label, getPlanSchema)
    },

    /**
     * `base: null` creates the plan (`If-None-Match: *`), a version updates it (`If-Match`).
     * A stale version answers 409; that is a result, not an error. 403 (view key) and 401 throw.
     */
    async putPlan(data: WirePlan, base: number | null): Promise<PutPlanResult> {
      const label = 'PUT /api/plan'
      const response = await call(
        'PUT',
        base === null ? { 'If-None-Match': '*' } : { 'If-Match': `"${base}"` },
        { data },
      )
      if (response.status === 409) {
        const { plan } = await readJson(response, label, conflictSchema)
        return { ok: false, conflict: plan }
      }
      assertOk(response, label)
      return { ok: true, ...(await readJson(response, label, putPlanSchema)) }
    },

    /**
     * `POST /api/plan/keys` (edit key only): replaces the view, edit or calendar key and returns the
     * new one, shown once. The old link stops working at once. Throws `ApiError` (401, 403).
     */
    async renewKey(which: LinkKind): Promise<string> {
      const label = 'POST /api/plan/keys'
      const response = await fetch(`${url}/keys`, {
        method: 'POST',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ which }),
      })
      assertOk(response, label)
      return (await readJson(response, label, renewKeySchema)).key
    },
  }
}
