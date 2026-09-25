const PAGE_PARAM = 'page'

export function withQueryParams(
  current: URLSearchParams,
  updates: Record<string, string | null>,
): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
  }
  return next
}

export function readOption<T extends string>(
  value: string | null,
  options: readonly { value: T }[],
): T | null {
  return options.some((option) => option.value === value) ? (value as T) : null
}

export function readPage(params: URLSearchParams): number {
  const raw = Number(params.get(PAGE_PARAM))
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.floor(raw) - 1)
}

export function writePage(
  current: URLSearchParams,
  page: number,
): URLSearchParams {
  const next = new URLSearchParams(current)
  if (page <= 0) next.delete(PAGE_PARAM)
  else next.set(PAGE_PARAM, String(page + 1))
  return next
}
