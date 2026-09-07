/**
 * 자연어 추천 도메인 공개 API (NLR-01 · NLR-06 · NLR-07)
 *
 * 이 폴더 밖에서는 `@/features/recommend` 만 import 합니다.
 * 화면: A06 자연어 추천 결과
 *
 * ⚠️ 백엔드 · AI 추천 API 가 아직 없습니다. api.ts 가 와이어프레임의 예시 결과를
 * 돌려줍니다.
 *
 * 개인화 추천(REC-12 · REC-13)은 별도 화면 없이 향 지도(A01)의 취향 영역으로
 * 표시하므로 이 도메인에 없습니다.
 */
export { RecommendResultList } from './components/RecommendResultList'
export { recommendationQuery, recommendKeys } from './queries'
export type {
  RecommendReason,
  RecommendResult,
  RecommendedPerfume,
} from './types'
