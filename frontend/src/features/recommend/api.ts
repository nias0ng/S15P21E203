import type { RecommendResult } from './types'

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
