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
