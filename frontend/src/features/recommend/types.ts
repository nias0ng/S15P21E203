/**
 * 자연어 추천 도메인 타입 (와이어프레임 A06 — NLR-01 · NLR-06 · NLR-07)
 */

/**
 * 추천 이유 한 줄 (NLR-07).
 *
 * 와이어프레임 예시: "'차분한' → 시더 · 베티버", "가을 어울림 평가 71%".
 * 입력한 표현과 그것이 어떤 근거로 이어졌는지를 한 줄로 보여줍니다.
 */
export interface RecommendReason {
  /** 사용자가 입력한 표현. 근거가 입력어와 무관하면 비워둡니다. */
  phrase: string | null
  /** 그 표현이 가리키는 노트 · 평가 */
  evidence: string
}

export interface RecommendedPerfume {
  perfumeId: number
  name: string
  brand: string
  thumbnailUrl: string | null
  reasons: RecommendReason[]
  /** 미니맵에서 어디쯤인지 (0~100 비율) */
  x: number
  y: number
}

/** 결과는 3~5개 가변입니다 (와이어프레임 주석) */
export interface RecommendResult {
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
