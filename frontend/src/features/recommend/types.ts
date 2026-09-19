/**
 * 자연어 추천 도메인 타입 (와이어프레임 A06 — NLR-01 · NLR-06 · NLR-07)
 */

/**
 * 추천 이유 한 줄 (NLR-07). 예: "'차분한' → 시더 · 베티버", "가을 어울림 평가 71%".
 */
export interface RecommendReason {
  /** 사용자가 입력한 표현. 근거가 입력어와 무관하면 비워둡니다. */
  phrase: string | null
  /** 그 표현이 가리키는 노트 · 평가 */
  evidence: string
}

export interface RecommendedPerfume {
  perfumeId: number
  /** 한국어 이름이 없으면 영어입니다 */
  name: string
  /** 브랜드가 없는 향수면 null 입니다 */
  brand: string | null
  thumbnailUrl: string | null
  /** 1~3개입니다 */
  reasons: RecommendReason[]
}

/**
 * 결과의 종류. **화면이 넷을 구분해야 합니다** — 0개인 경우가 두 종류이고 할 말이
 * 다릅니다(조건을 못 뽑은 사람에게 없는 것은 향수가 아니라 알아들은 조건입니다).
 *
 * ⚠️ **0개일 때 인기 향수를 대신 보여주면 안 됩니다** — 근거가 없어 NLR-07 을 어깁니다.
 * ⚠️ `NO_CONDITION` 은 드물지 않습니다 — 실사용자 설문 155건에서 48.4% 입니다.
 *
 * - `OK` 조건을 전부 만족 → 그대로
 * - `OK_RELAXED` 조건을 넓혔거나 향 조건이 하나뿐 → "조건이 넓습니다" 를 함께
 * - `NO_CONDITION` 향 조건을 하나도 못 뽑음 → 다시 쓰도록 유도
 * - `NO_RESULT` 조건은 찾았으나 보여줄 향수가 없음 → 다시 쓰도록 유도
 */
export type RecommendStatus = 'OK' | 'OK_RELAXED' | 'NO_CONDITION' | 'NO_RESULT'

/** 향수는 0~5개입니다. `OK` · `OK_RELAXED` 면 비어 있지 않습니다 */
export interface RecommendResult {
  status: RecommendStatus
  /** 사용자가 입력한 말 그대로 */
  query: string
  perfumes: RecommendedPerfume[]
}

/**
 * 개인화 맞춤 추천 (REC-12 · REC-13) — 진열대의 추천 카드 한 건. 자연어 추천과 달리
 * **묻지 않았는데 오므로** 이유가 없으면 광고로 읽힙니다. 입력한 표현이 없어
 * `phrase` 는 늘 null 입니다.
 */
export interface PersonalRecommendation {
  perfumeId: number
  name: string
  brand: string
  thumbnailUrl: string | null
  /** 접힌 카드와 펼친 카드 머리말에 쓰는 한 줄 */
  headline: string
  reasons: RecommendReason[]
}

/**
 * 추천 카드가 나타나기 시작하는 진열대 향수 수. ⚠️ 임시값이고, 추천 엔진이 붙으면
 * 그쪽 기준으로 다시 정합니다.
 */
export const RECOMMEND_MIN_SHELF_ITEMS = 3
