/**
 * 향수 상세로 들어온 길 (`POST /perfume-views` 의 `fromLocationType`)
 *
 * **`shared/config` 에 둡니다.** 값을 넘기는 쪽이 커뮤니티 · 향 지도 · 추천 · 컬렉션처럼
 * 여러 도메인이고, `features/a` 는 `features/b` 를 import 할 수 없어 `features/perfume`
 * 안에 두면 나머지가 문자열을 손으로 적게 됩니다. 향 계열(`scentFamilies`)과 같은 이유입니다.
 *
 * 서버 enum 과 **값이 정확히 같아야 합니다** — 모르는 값은 400 입니다.
 */
export const PERFUME_VIEW_SOURCES = [
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
 * 링크에 실어 보내는 값.
 *
 * **들어온 길을 아는 것은 상세 화면이 아니라 보낸 쪽입니다.** 상세 화면은 자기가 어디서
 * 불렸는지 모르므로, 향수로 보내는 자리마다 이 값을 함께 넘깁니다. 주소에 담지 않고
 * 라우터 state 로 보내는 이유: 주소는 사람이 복사해 남에게 보내는 것이라, 거기 들어온
 * 길이 박히면 받은 사람의 기록까지 보낸 사람의 길로 남습니다.
 */
export type PerfumeViewLocationState = {
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
 * 라우터 state 에서 읽어냅니다.
 *
 * state 는 **주소창에서 새로 고침하거나 링크를 붙여 넣으면 비어 있고**, 다른 화면이
 * 아무 값이나 넣을 수도 있는 자리라 `unknown` 에서 좁힙니다. 모르는 값은 `DIRECT` 입니다 —
 * 서버가 400 으로 막는 값을 보내느니 "바로 들어왔다" 로 두는 편이 낫습니다.
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
