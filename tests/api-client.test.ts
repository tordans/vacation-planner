import { describe, expect, it } from 'vitest'
import { toWire } from '@/features/plan/plan-wire'
import { ApiError, createApiClient, type FetchLike } from '@/features/server/api-client'
import { familyPlan } from './fixtures'

type Call = { url: string; init: RequestInit }

function client(respond: (call: Call) => Response) {
  const calls: Call[] = []
  const fetch: FetchLike = (url, init = {}) => {
    const call = { url, init }
    calls.push(call)
    return Promise.resolve(respond(call))
  }
  return { api: createApiClient({ key: 'secret-key-1234', fetch }), calls }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const data = toWire(familyPlan())
const serverPlan = { version: 3, updatedAt: '2026-11-14T12:00:00.123Z', data }

function headersOf(call: Call) {
  return new Headers(call.init.headers)
}

describe('api client getPlan', () => {
  it('sends the key as bearer token and parses the plan', async () => {
    const { api, calls } = client(() => json(200, { role: 'edit', plan: serverPlan }))
    const result = await api.getPlan()
    expect(result.role).toBe('edit')
    expect(result.plan?.version).toBe(3)
    expect(calls[0]?.url).toBe('/api/plan')
    expect(calls[0]?.init.method).toBe('GET')
    expect(headersOf(calls[0]!).get('Authorization')).toBe('Bearer secret-key-1234')
  })

  it('accepts an empty server', async () => {
    const { api } = client(() => json(200, { role: 'view', plan: null }))
    expect(await api.getPlan()).toEqual({ role: 'view', plan: null })
  })

  it('throws ApiError with the status for 401', async () => {
    const { api } = client(() => json(401, { error: 'unauthorized' }))
    await expect(api.getPlan()).rejects.toMatchObject({ name: 'ApiError', status: 401 })
  })

  it('rejects answers of the wrong shape', async () => {
    const { api } = client(() => json(200, { role: 'admin', plan: null }))
    await expect(api.getPlan()).rejects.toBeInstanceOf(ApiError)
  })

  it('rejects an answer that is not JSON', async () => {
    const { api } = client(() => new Response('<html>', { status: 200 }))
    await expect(api.getPlan()).rejects.toBeInstanceOf(ApiError)
  })

  it('passes network errors on unchanged', async () => {
    const api = createApiClient({
      key: 'secret-key-1234',
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    })
    await expect(api.getPlan()).rejects.toBeInstanceOf(TypeError)
  })
})

describe('api client putPlan', () => {
  it('updates with If-Match and sends the wire plan as data', async () => {
    const { api, calls } = client(() =>
      json(200, { version: 4, updatedAt: '2026-11-14T12:01:00.000Z' }),
    )
    const result = await api.putPlan(data, 3)
    expect(result).toEqual({ ok: true, version: 4, updatedAt: '2026-11-14T12:01:00.000Z' })
    const headers = headersOf(calls[0]!)
    expect(calls[0]?.init.method).toBe('PUT')
    expect(headers.get('If-Match')).toBe('"3"')
    expect(headers.get('If-None-Match')).toBeNull()
    expect(headers.get('Content-Type')).toBe('application/json')
    const body = calls[0]?.init.body
    expect(typeof body === 'string' ? JSON.parse(body) : null).toEqual({ data })
  })

  it('creates with If-None-Match', async () => {
    const { api, calls } = client(() =>
      json(200, { version: 1, updatedAt: '2026-11-14T12:01:00.000Z' }),
    )
    await api.putPlan(data, null)
    const headers = headersOf(calls[0]!)
    expect(headers.get('If-None-Match')).toBe('*')
    expect(headers.get('If-Match')).toBeNull()
  })

  it('returns the server plan on 409 instead of throwing', async () => {
    const { api } = client(() => json(409, { plan: serverPlan }))
    const result = await api.putPlan(data, 2)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.conflict.version).toBe(3)
  })

  it('throws for the view key (403), a wrong key (401) and missing precondition (428)', async () => {
    for (const status of [401, 403, 428]) {
      const { api } = client(() => json(status, { error: 'x' }))
      await expect(api.putPlan(data, 1)).rejects.toMatchObject({ status })
    }
  })

  it('rejects a 409 without a plan', async () => {
    const { api } = client(() => json(409, {}))
    await expect(api.putPlan(data, 1)).rejects.toBeInstanceOf(ApiError)
  })
})
