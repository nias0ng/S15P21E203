/** 자연어 추천 도메인 타입 (A06 — NLR-01 · NLR-06 · NLR-07) */

/** 추천 이유 한 줄 (NLR-07). 예: "'차분한' → 시더 · 베티버", "가을 어울림 평가 71%". */
interface RecommendReason {
  /** 사용자가 입력한 표현. 근거가 입력어와 무관하면 비워둡니다 */
  phrase: string | null
  evidence: string
}

export interface RecommendedPerfume {
  perfumeId: number
  /** 한국어 이름이 없으면 영어입니다 */
  name: string
  brand: string | null
  thumbnailUrl: string | null
  /** 1~3개입니다 */
  reasons: RecommendReason[]
}

/**
 * 결과의 종류. 0개인 경우가 둘(`NO_CONDITION` 조건을 못 뽑음 · `NO_RESULT` 향수가 없음)이고
 * 할 말이 다릅니다. NOTE: 0개일 때 인기 향수를 대신 보여주면 근거가 없어 NLR-07 을 어깁니다.
 */
type RecommendStatus = 'OK' | 'OK_RELAXED' | 'NO_CONDITION' | 'NO_RESULT'

/** 향수는 0~5개입니다. `OK` · `OK_RELAXED` 면 비어 있지 않습니다 */
export interface RecommendResult {
  status: RecommendStatus
  query: string
  perfumes: RecommendedPerfume[]
}

/**
 * 개인화 맞춤 추천 (REC-12 · REC-13) — 진열대의 추천 카드 한 건. 묻지 않았는데 오는 것이라
 * 이유가 없으면 광고로 읽힙니다. 입력한 표현이 없어 `phrase` 는 늘 null 입니다.
 */
export interface PersonalRecommendation {
  perfumeId: number
  name: string
  brand: string
  thumbnailUrl: string | null
  headline: string
  reasons: RecommendReason[]
}

/** 추천 카드가 나타나는 진열대 향수 수. NOTE: 임시값이고 추천 엔진이 붙으면 다시 정합니다. */
export const RECOMMEND_MIN_SHELF_ITEMS = 3
