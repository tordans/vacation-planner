const MAX_SLUG_LENGTH = 60

const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }

/** "Sommer 2027 mit Oma" -> "sommer-2027-mit-oma". Empty when nothing usable is left. */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replaceAll(/[äöüß]/g, (letter) => UMLAUTS[letter] ?? letter)
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replaceAll(/-+$/g, '')
}

const FALLBACK_TITLE = 'Abstimmung'

/** "sommer-2027-mit-oma" -> "Sommer 2027 mit oma" */
export function titleFromSlug(slug: string) {
  const words = slug.replaceAll('-', ' ').trim()
  if (words === '') return FALLBACK_TITLE
  return words.charAt(0).toUpperCase() + words.slice(1)
}
