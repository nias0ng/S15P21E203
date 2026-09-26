export function keywordMatcher(
  keyword: string,
): (...fields: (string | null | undefined)[]) => boolean {
  const needle = keyword.trim().toLowerCase()
  return (...fields) =>
    !needle ||
    fields.some((field) => field?.toLowerCase().includes(needle) ?? false)
}
