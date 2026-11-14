import { describe, expect, it } from 'vitest'
import {
  isValidKey,
  linkForKey,
  parseKeyFromHash,
  removeKeyFromHash,
} from '@/features/server/key-hash'

const KEY = 'aB3_-xYz0123456789ABCDEFghij'

describe('key in the URL fragment', () => {
  it('reads #key=…', () => {
    expect(parseKeyFromHash(`#key=${KEY}`)).toBe(KEY)
    expect(parseKeyFromHash(`key=${KEY}`)).toBe(KEY)
  })

  it('finds the key next to other fragment parts', () => {
    expect(parseKeyFromHash(`#foo=1&key=${KEY}`)).toBe(KEY)
  })

  it('returns null without or with a malformed key', () => {
    expect(parseKeyFromHash('')).toBeNull()
    expect(parseKeyFromHash('#')).toBeNull()
    expect(parseKeyFromHash('#other=1')).toBeNull()
    expect(parseKeyFromHash('#key=')).toBeNull()
    expect(parseKeyFromHash('#key=short')).toBeNull()
    expect(parseKeyFromHash('#key=has spaces in it okay')).toBeNull()
    expect(parseKeyFromHash(`#key=${'a'.repeat(300)}`)).toBeNull()
  })

  it('validates keys', () => {
    expect(isValidKey(KEY)).toBe(true)
    expect(isValidKey('<script>alert(1)</script>')).toBe(false)
  })

  it('removes only the key from the fragment', () => {
    expect(removeKeyFromHash(`#key=${KEY}`)).toBe('')
    expect(removeKeyFromHash(`#foo=1&key=${KEY}`)).toBe('#foo=1')
    expect(removeKeyFromHash('#foo=1')).toBe('#foo=1')
    expect(removeKeyFromHash('')).toBe('')
  })

  it('builds a link that reads back as the same key', () => {
    const link = linkForKey(KEY, 'https://vacation.ingsparks.de/')
    expect(link).toBe(`https://vacation.ingsparks.de/#key=${KEY}`)
    expect(parseKeyFromHash(new URL(link).hash)).toBe(KEY)
  })
})
