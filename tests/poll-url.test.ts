import { describe, expect, it } from 'vitest'
import { EMPTY_POLL, type Poll } from '@/features/poll/poll-schema'
import { slugify, titleFromSlug } from '@/features/poll/poll-slug'
import { pollFromHash, pollToHash } from '@/features/poll/poll-url'

const poll: Poll = {
  title: 'Sommer 2027 mit Oma',
  sections: [
    {
      name: 'Familie Müller',
      federalState: 'BE',
      ranges: [{ id: 'r1', name: 'Sommerferien', start: '2027-07-01', end: '2027-08-13' }],
    },
    {
      name: 'Chancen',
      ranges: [{ id: 'r2', name: 'Besuch', start: '2027-07-20', end: '2027-07-25' }],
    },
  ],
}

describe('poll link', () => {
  it('round-trips a poll through the fragment', () => {
    const hash = pollToHash(poll)
    expect(hash.startsWith('d=N4Ig')).toBe(true)
    expect(hash).not.toMatch(/[%"?]/)
    expect(pollFromHash(`#${hash}`)).toEqual(poll)
    expect(pollFromHash(hash)).toEqual(poll)
  })

  it('keeps a title without sections, and leaves the fragment out for nothing', () => {
    expect(pollFromHash(pollToHash({ title: 'Nur ein Name', sections: [] }))).toEqual({
      title: 'Nur ein Name',
      sections: [],
    })
    expect(pollToHash(EMPTY_POLL)).toBe('')
  })

  it('reads percent-encoded characters and other parameters around it', () => {
    const hash = pollToHash(poll)
    expect(
      pollFromHash(`#foo=1&${hash.replaceAll('+', '%2B').replaceAll('$', '%24')}&bar=2`),
    ).toEqual(poll)
  })

  it('treats missing, damaged or unexpected data as an empty poll', () => {
    expect(pollFromHash('')).toEqual(EMPTY_POLL)
    expect(pollFromHash('#key=abcdefgh12')).toEqual(EMPTY_POLL)
    expect(pollFromHash('#d=')).toEqual(EMPTY_POLL)
    expect(pollFromHash('#d=not-a-poll')).toEqual(EMPTY_POLL)
    expect(pollFromHash('#d=%E0%A4%A')).toEqual(EMPTY_POLL)
    const wrong = pollToHash({
      sections: [
        { name: 'A', ranges: [{ id: 'r1', name: 'X', start: '2027-07-10', end: '2027-07-01' }] },
      ],
    })
    expect(pollFromHash(wrong)).toEqual(EMPTY_POLL)
  })

  it('drops an unknown federal state or an oversized title but keeps the rest', () => {
    const hash = pollToHash({
      title: 'x'.repeat(81),
      sections: [{ name: 'A', federalState: 'XX', ranges: [] }],
    })
    expect(pollFromHash(hash)).toEqual({ sections: [{ name: 'A', ranges: [] }] })
  })
})

describe('slug', () => {
  it('writes umlauts out and joins everything else with dashes', () => {
    expect(slugify('Sommer 2027 mit Oma')).toBe('sommer-2027-mit-oma')
    expect(slugify('Größe Ärzte über Öl')).toBe('groesse-aerzte-ueber-oel')
    expect(slugify('  --Ferien!!  ')).toBe('ferien')
  })

  it('is empty when nothing usable is left', () => {
    expect(slugify('')).toBe('')
    expect(slugify(' ?! ')).toBe('')
  })

  it('stops at 60 characters without a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(59)} bbb`)
    expect(slug).toBe('a'.repeat(59))
    expect(slugify('x'.repeat(100))).toHaveLength(60)
  })

  it('turns back into words', () => {
    expect(titleFromSlug('sommer-2027-mit-oma')).toBe('Sommer 2027 mit oma')
    expect(titleFromSlug('')).toBe('Abstimmung')
  })
})
