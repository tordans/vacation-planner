/**
 * The access key travels in the URL fragment (`#key=…`): fragments are never sent to a server,
 * so the link can be shared without the key showing up in access logs.
 */

/** URL-safe characters only (the deploy script generates base64url keys). */
const KEY_PATTERN = /^[A-Za-z0-9_.~-]{8,256}$/

export function isValidKey(value: string) {
  return KEY_PATTERN.test(value)
}

/** `#key=abc` or `#foo=1&key=abc` → `abc`; `null` for anything missing or malformed. */
export function parseKeyFromHash(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('key')
  return value !== null && isValidKey(value) ? value : null
}

/** The fragment without `key`, so the address bar never keeps it. Returns '' when nothing is left. */
export function removeKeyFromHash(hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (!params.has('key')) return hash
  params.delete('key')
  const rest = params.toString()
  return rest ? `#${rest}` : ''
}
