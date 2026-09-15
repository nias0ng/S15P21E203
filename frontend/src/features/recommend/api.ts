import type { PersonalRecommendation, RecommendResult } from './types'

/**
 * NLR-01 자연어 기반 추천.
 *
 * ⚠️ 백엔드 · AI 추천 API 가 아직 없습니다. 화면을 눈으로 확인할 수 있도록
 * 와이어프레임의 예시 결과를 돌려줍니다. API 가 준비되면 이 함수 본문만
 * http.post 로 바꾸세요.
 *
 *   const { data } = await http.post<RecommendResult>('/recommendations/natural-language', { query })
 */
export async function getRecommendation(
  query: string,
): Promise<RecommendResult> {
  return {
    query,
    perfumes: [
      {
        perfumeId: 1,
        name: '조 말론 우드 세이지',
        brand: '조 말론 런던',
        thumbnailUrl: null,
        x: 32,
        y: 38,
        reasons: [
          { phrase: '차분한', evidence: '시더 · 베티버' },
          { phrase: '촉촉한', evidence: '씨 솔트' },
          { phrase: null, evidence: '가을 어울림 평가 71%' },
        ],
      },
      {
        perfumeId: 2,
        name: '딥디크 오르페옹',
        brand: '딥디크',
        thumbnailUrl: null,
        x: 41,
        y: 47,
        reasons: [
          { phrase: '차분한', evidence: '아이리스' },
          { phrase: '숲속', evidence: '주니퍼' },
        ],
      },
      {
        perfumeId: 3,
        name: '르 라보 상탈 33',
        brand: '르 라보',
        thumbnailUrl: null,
        x: 27,
        y: 52,
        reasons: [
          { phrase: '묵직한', evidence: '샌달우드' },
          { phrase: '비 온 뒤', evidence: '파피루스' },
        ],
      },
    ],
  }
}

/**
 * REC-12 · REC-13 개인화 맞춤 추천 — 진열대 화면의 추천 카드.
 *
 * ⚠️ 백엔드 · AI 추천 API 가 아직 없어 고정값을 돌려줍니다. API 가 준비되면
 * 이 함수 본문만 바꾸세요.
 *
 *   const { data } = await http.get<PersonalRecommendation>('/recommendations/personal')
 *   return data
 *
 * 추천할 것이 없으면 null 입니다. 담은 향수가 적거나 취향이 한쪽으로 쏠려 있지
 * 않으면 추천 엔진도 내놓을 것이 없습니다 — 그때 억지로 하나 고르면 카드의
 * "왜 당신에게" 가 거짓이 됩니다. 화면은 null 이면 카드를 아예 그리지 않습니다.
 *
 * ⚠️ **이미 진열대에 있는 향수는 추천에서 빠져야 합니다.** 거르는 일은 화면이 아니라
 * 추천 엔진의 몫입니다 — 엔진이 이미 진열대를 보고 있고(그게 추천의 근거입니다),
 * 화면에서 걸러 내면 "추천을 받았는데 다 걸러져 0개" 인 상태를 화면이 떠안게 됩니다.
 * 어느 칸까지 뺄지(보유 중 · 보유 희망 · 시향해 봄)는 연동 때 백엔드와 맞춥니다.
 * 아래 자리표시자도 그래서 진열대 자리표시자에 없는 향수로 골랐습니다.
 */
export async function getPersonalRecommendation(): Promise<PersonalRecommendation | null> {
  return {
    perfumeId: 3,
    name: '딥티크 탐 다오',
    brand: '딥티크',
    thumbnailUrl: null,
    headline: '나무 냄새를 좋아하시는군요',
    reasons: [
      { phrase: null, evidence: '담아 두신 향수 7개 중 4개가 우디 계열입니다' },
      {
        phrase: null,
        evidence: '별점 5를 주신 두 향수가 모두 샌달우드를 씁니다',
      },
      { phrase: null, evidence: '가을에 맡은 향을 특히 오래 담아 두셨습니다' },
    ],
  }
}
