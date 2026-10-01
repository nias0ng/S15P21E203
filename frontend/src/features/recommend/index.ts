/** 추천 도메인 공개 API. 개인화 추천 편지는 향 지도가 아니라 진열대 화면(A13)에 섭니다. */

/*
 * 개인화 추천 편지(RecommendLetter)의 봉투 · 편지 모양. 모든 규칙이 `.rec-letter` 아래로 한정됩니다.
 * 진열대 도메인이 제 스타일시트를 입구(index.ts)에서 싣는 것과 같은 까닭으로 여기서 부릅니다 — 컴포넌트
 * 파일에 두면 그 파일을 옮기는 사람이 스타일을 조용히 떨어뜨립니다.
 */
import './recommend-letter.css'

export { NlrFeedbackModal } from './components/NlrFeedbackModal'
export { RecommendModal } from './components/RecommendModal'
export { readOpenRecommendation } from './openRecommendation'
export { RecommendLetter, type LetterFacts } from './components/RecommendLetter'
export { accordLabel } from './accordNames'
export { personalRecommendationQuery } from './queries'
