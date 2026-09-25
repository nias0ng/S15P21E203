export function parseId(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
