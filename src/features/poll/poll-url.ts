import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { EMPTY_POLL, pollSchema, type Poll } from './poll-schema'

/**
 * The poll lives in the fragment (`#d=…`), which browsers never send to a server. The alphabet
 * of the compressed text (letters, digits, `+`, `-`, `$`) is valid there as it is.
 */
const HASH_PREFIX = 'd='

/** The fragment for a poll, without `#`; empty for a poll that has nothing in it yet. */
export function pollToHash(poll: Poll): string {
  if (poll.sections.length === 0 && poll.title === undefined) return ''
  return `${HASH_PREFIX}${compressToEncodedURIComponent(JSON.stringify(poll))}`
}

function dataOfHash(hash: string): string | null {
  for (const part of hash.replace(/^#/, '').split('&')) {
    if (part.startsWith(HASH_PREFIX)) {
      const value = part.slice(HASH_PREFIX.length)
      try {
        // Other tools may have percent-encoded `+` or `$`.
        return decodeURIComponent(value)
      } catch {
        return null
      }
    }
  }
  return null
}

/** Reads `#d=…`. A missing, damaged or unexpected value is an empty poll. */
export function pollFromHash(hash: string): Poll {
  const encoded = dataOfHash(hash)
  if (!encoded) return EMPTY_POLL
  try {
    const json = decompressFromEncodedURIComponent(encoded)
    if (!json) return EMPTY_POLL
    const result = pollSchema.safeParse(JSON.parse(json))
    return result.success ? result.data : EMPTY_POLL
  } catch {
    return EMPTY_POLL
  }
}
