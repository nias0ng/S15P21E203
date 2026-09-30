import { i18n } from '@/shared/i18n'

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

const BACK_LABEL_KEY = {
  NATURAL_LANGUAGE_RECOMMENDATION: 'recommendation',
  PERSONALIZED_RECOMMENDATION: 'recommendation',
  SCENT_MAP: 'scentMap',
  COMMUNITY: 'community',
  SEARCH: 'perfumeList',
  SHELF: 'shelf',
  COLLECTION: 'collection',
  RELATED_PERFUME: 'previousPerfume',
  DIRECT: 'perfumeList',
} as const satisfies Record<PerfumeViewSource, string>

/**
 * 향수 상세의 '← 돌아가기' 이름. 값은 **읽을 때의** 화면 언어로 풉니다(번역 묶음 common 의 perfumeViewBack).
 */
export const PERFUME_VIEW_BACK_LABEL: Readonly<
  Record<PerfumeViewSource, string>
> = Object.defineProperties(
  {} as Record<PerfumeViewSource, string>,
  Object.fromEntries(
    PERFUME_VIEW_SOURCES.map((source) => [
      source,
      {
        get: () => i18n.t(`common:perfumeViewBack.${BACK_LABEL_KEY[source]}`),
        enumerable: true,
      },
    ]),
  ),
)

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
