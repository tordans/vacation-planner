import { parseSearchWith, stringifySearchWith } from '@tanstack/react-router'

const parseSearch = parseSearchWith(JSON.parse)
const stringifySearchDefault = stringifySearchWith(JSON.stringify)

/** Undo JSON percent-encoding so dates and timestamps stay readable. */
const makeSearchPretty = (searchString: string) =>
  searchString
    .replaceAll('%22', '"')
    .replaceAll('%2C', ',')
    .replaceAll('%27', "'")
    .replaceAll('%28', '(')
    .replaceAll('%29', ')')
    .replaceAll('%3A', ':')
    .replaceAll('%3B', ';')
    .replaceAll('%5B', '[')
    .replaceAll('%5D', ']')
    .replaceAll('%7B', '{')
    .replaceAll('%7D', '}')
    .replaceAll('%2F', '/')

/** Readable params first, the long compressed plan last. */
const PARAM_ORDER = ['year', 'from', 'to', 'saved', 'plan']

function orderParams(search: Record<string, unknown>) {
  const ordered: Record<string, unknown> = {}
  for (const key of PARAM_ORDER) {
    if (search[key] !== undefined) ordered[key] = search[key]
  }
  for (const [key, value] of Object.entries(search)) {
    if (!(key in ordered)) ordered[key] = value
  }
  return ordered
}

export const routerSearch = {
  parse: parseSearch,
  stringify: (search: Record<string, unknown>) =>
    makeSearchPretty(stringifySearchDefault(orderParams(search))),
}
