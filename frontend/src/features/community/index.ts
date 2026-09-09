/**
 * 커뮤니티 도메인 공개 API (CMT-01 · 02 · 03 · 06 · 07 · 08 · 09 · 10 · 11 · 13)
 *
 * 이 폴더 밖에서는 `@/features/community` 만 import 합니다.
 * 화면: A22a 후기 게시판 / A22b 자유 게시판 / A23 게시글 상세 + 댓글
 *      A24a 후기 작성 / A24b 자유 글 작성 / A25 수정 요청 모달 / C02 향수 선택
 *
 * ⚠️ 백엔드 커뮤니티 API 가 아직 없습니다. api.ts 가 자리표시자를 돌려줍니다.
 */
export { BoardTabs } from './components/BoardTabs'
export { CommentSection } from './components/CommentSection'
export { ModerationRejectedModal } from './components/ModerationRejectedModal'
export { LinkedPerfumeModal } from './components/LinkedPerfumeModal'
export { PostList } from './components/PostList'
export { TrendingPerfumes } from './components/TrendingPerfumes'
export {
  commentsQuery,
  communityKeys,
  postDetailQuery,
  postListQuery,
  trendingPerfumesQuery,
} from './queries'
export {
  FREE_SORTS,
  POST_CATEGORIES,
  POST_CATEGORY_FILTERS,
  REVIEW_SORTS,
  type BoardType,
  type Comment,
  type LinkedPerfume,
  type ModerationRejection,
  type PostCategory,
  type PostDetail,
  type PostSort,
  type PostSummary,
  type TrendingPerfume,
} from './types'
