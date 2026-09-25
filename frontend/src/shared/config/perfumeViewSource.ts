const PERFUME_VIEW_SOURCES = [
  'NATURAL_LANGUAGE_RECOMMENDATION',
  'PERSONALIZED_RECOMMENDATION',
  'SCENT_MAP',
  'COMMUNITY',
  'SEARCH',
  'SHELF',
  'COLLECTION',
  'RELATED_PERFUME',
  'DIRECT',
] as const

export type PerfumeViewSource = (typeof PERFUME_VIEW_SOURCES)[number]

type PerfumeViewLocationState = {
  perfumeViewSource?: PerfumeViewSource
  fromPerfumeId?: number
}

export function perfumeViewState(
  source: PerfumeViewSource,
  fromPerfumeId?: number,
): PerfumeViewLocationState {
  return fromPerfumeId === undefined
    ? { perfumeViewSource: source }
    : { perfumeViewSource: source, fromPerfumeId }
}

export const PERFUME_VIEW_BACK_LABEL: Record<PerfumeViewSource, string> = {
  NATURAL_LANGUAGE_RECOMMENDATION: '추천 결과',
  PERSONALIZED_RECOMMENDATION: '추천 결과',
  SCENT_MAP: '향 지도',
  COMMUNITY: '커뮤니티',
  SEARCH: '향수 목록',
  SHELF: '진열대',
  COLLECTION: '컬렉션',
  RELATED_PERFUME: '이전 향수',
  DIRECT: '향수 목록',
}

export function readPerfumeViewState(state: unknown): {
  source: PerfumeViewSource
  fromPerfumeId?: number
} {
  const value = (state ?? {}) as PerfumeViewLocationState
  const source = PERFUME_VIEW_SOURCES.includes(
    value.perfumeViewSource as PerfumeViewSource,
  )
    ? (value.perfumeViewSource as PerfumeViewSource)
    : 'DIRECT'

  const fromPerfumeId =
    source === 'RELATED_PERFUME' &&
    typeof value.fromPerfumeId === 'number' &&
    Number.isFinite(value.fromPerfumeId)
      ? value.fromPerfumeId
      : undefined

  return { source, fromPerfumeId }
}
