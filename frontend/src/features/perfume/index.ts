/**
 * perfume 도메인 공개 API (COM-05, DTL-01·02·03·10·14·16·23·24)
 *
 * 이 폴더 밖에서는 `@/features/perfume` 만 import 합니다.
 * 내부 파일(`./api`, `./queries`)을 직접 짚지 않습니다. 그래야 내부를 쪼개거나
 * 옮겨도 화면 코드가 안 깨집니다.
 *
 * 화면: A33 향수 목록 / A09 검색 결과 / A10 상세 / A12 후기 상세
 */
export { PerfumeFilters } from './components/PerfumeFilters'
export { usePerfumeViewLog } from './hooks/usePerfumeViewLog'
export { PerfumeGrid } from './components/PerfumeGrid'
export { PerfumeNotes } from './components/PerfumeNotes'
export { PerfumeOverview } from './components/PerfumeOverview'
export { PerfumeReviewList } from './components/PerfumeReviewList'
export { PerfumeReviewSummary } from './components/PerfumeReviewSummary'
export { PerfumeSearchResult } from './components/PerfumeSearchResult'
export { PerfumeSeasonRatings } from './components/PerfumeSeasonRatings'
export { PerfumeReviewDetail } from './components/PerfumeReviewDetail'
export {
  perfumeDetailQuery,
  perfumeKeys,
  perfumeListQuery,
  perfumeNotesQuery,
  perfumeReviewStatisticsQuery,
  perfumeReviewSummaryQuery,
  perfumeReviewsQuery,
  perfumeSeasonStatisticsQuery,
  reviewDetailQuery,
  reviewKeys,
} from './queries'
export {
  createReview,
  deleteReview,
  likeReview,
  replaceReviewSeasons,
  unlikeReview,
  updateReview,
} from './api'
export {
  GENDER_FILTERS,
  REVIEW_CONTENT_MAX_LENGTH,
  REVIEW_CONTENT_MIN_LENGTH,
  REVIEW_SEASON_MIN_COUNT,
  REVIEW_TITLE_MAX_LENGTH,
  SEASONS,
  RANKING_FILTERS,
  type ReviewCreateInput,
  type ReviewLikeResponse,
  type ReviewUpdateInput,
  type GenderFilter,
  type PerfumeAccord,
  type PerfumeDetail,
  type PerfumeNote,
  type PerfumeNotesResponse,
  type PerfumeSearchParams,
  type PerfumeSearchResponse,
  type PerfumeSummary,
  type Review,
  type ReviewDetail,
  type ReviewSeason,
  type ReviewStatistics,
  type ReviewSummary,
  type ReviewsResponse,
  type Season,
  type SeasonStatistic,
  type SeasonStatisticsResponse,
  type RankingFilter,
} from './types'
