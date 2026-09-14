/**
 * 자연어 추천 도메인 공개 API (NLR-01 · NLR-06 · NLR-07)
 *
 * 이 폴더 밖에서는 `@/features/recommend` 만 import 합니다.
 * 화면: A06 자연어 추천 결과
 *
 * ⚠️ 백엔드 · AI 추천 API 가 아직 없습니다. api.ts 가 와이어프레임의 예시 결과를
 * 돌려줍니다.
 *
 * 개인화 추천(REC-12 · REC-13)은 진열대 화면(A13)의 추천 카드로 들어갑니다.
 * 향 지도(A01)의 취향 영역으로 표시하려던 것을 옮겼습니다 — 지도는 향을 둘러보는
 * 자리라 "당신에게 이것" 이 끼어들 곳이 아니고, 진열대는 이미 내 취향이 쌓인
 * 자리라 추천의 근거가 그 화면 안에 함께 보입니다.
 */
export { RecommendPeekCard } from './components/RecommendPeekCard'
export { RecommendResultList } from './components/RecommendResultList'
export {
  personalRecommendationQuery,
  recommendationQuery,
  recommendKeys,
} from './queries'
export {
  RECOMMEND_MIN_SHELF_ITEMS,
  type PersonalRecommendation,
  type RecommendReason,
  type RecommendResult,
  type RecommendedPerfume,
} from './types'
