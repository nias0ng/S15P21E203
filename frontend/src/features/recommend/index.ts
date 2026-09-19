/**
 * 자연어 추천 도메인 공개 API (NLR-01 · 06 · 07). ⚠️ 개인화 추천(REC-12 · 13)은
 * 백엔드 · AI API 가 아직 없어 api.ts 가 예시 결과를 돌려주고, 그 카드는 향 지도가
 * 아니라 **진열대 화면(A13)** 에 있습니다.
 */
export { RecommendModal } from './components/RecommendModal'
export { RecommendPeekCard } from './components/RecommendPeekCard'
export { personalRecommendationQuery } from './queries'
export { RECOMMEND_MIN_SHELF_ITEMS } from './types'
