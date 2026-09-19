/**
 * 자연어 추천 도메인 타입 (와이어프레임 A06 — NLR-01 · NLR-06 · NLR-07)
 */

/**
 * 추천 이유 한 줄 (NLR-07).
 *
 * 와이어프레임 예시: "'차분한' → 시더 · 베티버", "가을 어울림 평가 71%".
 * 입력한 표현과 그것이 어떤 근거로 이어졌는지를 한 줄로 보여줍니다.
 */
interface RecommendReason {
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
 * 결과의 종류. **화면이 넷을 구분해야 합니다.**
 *
 * 향수가 0개인 경우가 **두 종류**이고 사용자에게 할 말이 서로 다릅니다 — 하나로 묶으면
 * 향 조건을 못 뽑은 사람에게 "그런 향수가 없습니다" 라고 말하게 됩니다. 그 사람에게
 * 없는 것은 향수가 아니라 **우리가 알아들은 조건**입니다.
 *
 * ⚠️ **0개일 때 인기 향수를 대신 보여주면 안 됩니다.** 추천처럼 보이지만 근거가 없어
 * NLR-07(추천 이유 제공)을 어깁니다.
 * ⚠️ `NO_CONDITION` 은 **드문 경우가 아닙니다** — 백엔드 기준 실사용자 설문 155건에서
 * 48.4% 입니다. 예외가 아니라 정상 경로로 다룹니다.
 *
 * - `OK` 조건을 전부 만족하는 향수를 찾음 → 그대로 보여줍니다
 * - `OK_RELAXED` 조건을 넓혔거나 향 조건이 하나뿐이라 순위를 못 정함 → "조건이 넓습니다" 를 함께
 * - `NO_CONDITION` 향 조건을 하나도 못 뽑음 → 다시 쓰도록 유도
 * - `NO_RESULT` 조건은 찾았으나 보여줄 향수가 없음 → 다시 쓰도록 유도
 */
type RecommendStatus = 'OK' | 'OK_RELAXED' | 'NO_CONDITION' | 'NO_RESULT'

/** 향수는 0~5개입니다. `OK` · `OK_RELAXED` 면 비어 있지 않습니다 */
export interface RecommendResult {
  status: RecommendStatus
  /** 사용자가 입력한 말 그대로 */
  query: string
  perfumes: RecommendedPerfume[]
}

/**
 * 개인화 맞춤 추천 (REC-12 · REC-13) — 진열대 화면의 추천 카드가 쓰는 한 건.
 *
 * 자연어 추천과 달리 **묻지 않았는데 옵니다.** 그래서 이유 없이 향수만 들이밀면
 * 광고로 읽힙니다. 이유는 RecommendReason 을 그대로 쓰되 입력한 표현이 없으므로
 * phrase 는 늘 null 입니다.
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
 * 추천 카드가 나타나기 시작하는 진열대 향수 수.
 *
 * ⚠️ 임시값입니다. 추천 엔진이 붙으면 "몇 개부터 쓸 만한 추천이 나오는가" 를
 * 그쪽 기준으로 다시 정합니다. 지금 이 값의 뜻은 "한두 개 담은 사람에게
 * 개인화를 말하면 거짓말이 된다" 뿐입니다.
 */
export const RECOMMEND_MIN_SHELF_ITEMS = 3
