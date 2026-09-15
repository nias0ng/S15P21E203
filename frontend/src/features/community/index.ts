/**
 * 커뮤니티 도메인 공개 API (CMT-01 · 02 · 03 · 06 · 07 · 08 · 09 · 10 · 11 · 13)
 *
 * 이 폴더 밖에서는 `@/features/community` 만 import 합니다.
 * 화면: A22a 후기 게시판 / A22b 자유 게시판 / A23 게시글 상세 + 댓글
 *      A24a 후기 작성 / A24b 자유 글 작성 / A25 수정 요청 모달 / C02 향수 선택
 *
 * 조회는 전부 실제 API 입니다. **쓰기(작성 · 수정 · 삭제 · 좋아요 · 댓글)는 로그인이
 * 필요해 인증이 붙을 때 이어집니다.** "지금 많이 언급되는 향수" 와 작성 검수(CMT-13)는
 * 엔드포인트 자체가 없습니다.
 */
export { BoardHeader } from './components/BoardHeader'
export { ImageAttachField, WriteForm } from './components/WriteForm'
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
  reviewBoardQuery,
  trendingPerfumesQuery,
} from './queries'
export {
  FREE_SORTS,
  POST_CATEGORIES,
  POST_CATEGORY_FILTERS,
  postToBoardItem,
  REVIEW_SORTS,
  reviewToBoardItem,
  type BoardItem,
  type Comment,
  type CommentsResponse,
  type LinkedPerfume,
  type ModerationRejection,
  type PostCategory,
  type PostDetail,
  type PostSort,
  type PostSummary,
  type PostsResponse,
  type ReviewBoardItem,
  type ReviewBoardResponse,
  type ReviewSort,
  type TrendingPerfume,
} from './types'
