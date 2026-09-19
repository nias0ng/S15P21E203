/**
 * 향수 상세로 들어온 길 (`POST /perfume-views` 의 `fromLocationType`)
 *
 * 넘기는 쪽이 여러 도메인이라 `shared/config` 에 둡니다 — `features/perfume` 안에
 * 두면 나머지가 문자열을 손으로 적게 됩니다.
 * 서버 enum 과 **값이 정확히 같아야 합니다** — 모르는 값은 400 입니다.
 */
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

/**
 * 링크에 실어 보내는 값. **들어온 길을 아는 것은 보낸 쪽**이라 향수로 보내는 자리마다
 * 넘깁니다. 주소가 아니라 라우터 state 인 이유: 주소는 복사해 남에게 보내는 것이라,
 * 거기 길이 박히면 받은 사람의 기록까지 보낸 사람의 길로 남습니다.
 */
type PerfumeViewLocationState = {
  perfumeViewSource?: PerfumeViewSource
  /** 다른 향수 상세에서 건너온 경우의 이전 향수 (`RELATED_PERFUME`) */
  fromPerfumeId?: number
}

/** `<Link to={toPerfumeDetail(id)} state={perfumeViewState('COMMUNITY')}>` */
export function perfumeViewState(
  source: PerfumeViewSource,
  fromPerfumeId?: number,
): PerfumeViewLocationState {
  return fromPerfumeId === undefined
    ? { perfumeViewSource: source }
    : { perfumeViewSource: source, fromPerfumeId }
}

/**
 * 라우터 state 에서 읽어냅니다. **새로 고침하거나 링크를 붙여 넣으면 비어 있고** 아무
 * 값이나 들어올 수 있어 `unknown` 에서 좁히고, 모르는 값은 `DIRECT` 입니다.
 */
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
