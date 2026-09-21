/**
 * 커뮤니티 도메인 타입 (A22a · A22b · A23 · A24a · A24b)
 *
 * **두 게시판은 백엔드에서 서로 다른 자원입니다** — 자유는 `/posts`, 후기는
 * `/reviews` 이고 응답 모양도 다릅니다(후기에는 분류와 댓글이 없습니다). 예전에
 * `board: 'REVIEW' | 'FREE'` 하나로 묶었더니 어느 쪽에도 맞지 않는 타입이 됐습니다.
 * 같은 카드로 보이는 부분만 `BoardItem` 으로 맞춰 넘깁니다.
 */
import { toPostDetail, toReviewDetail } from '@/shared/config/routes'

/** 자유 게시판 분류 (CMT-16). 필수이고, 후기에는 분류가 없습니다 */
export type PostCategory = 'COLLECTION' | 'RECOMMEND' | 'CHAT'

export const POST_CATEGORIES = [
  { value: 'COLLECTION', label: '컬렉션 공유' },
  { value: 'RECOMMEND', label: '추천' },
  { value: 'CHAT', label: '잡담' },
] as const satisfies readonly { value: PostCategory; label: string }[]

/** 자유 게시판 정렬. 후기에는 댓글이 없어 댓글 순이 없습니다. */
export type PostSort = 'RECENT' | 'VIEWS' | 'LIKES' | 'COMMENTS'

/** 후기 게시판 정렬 */
export type ReviewSort = 'RECENT' | 'VIEWS' | 'LIKES'

export const REVIEW_SORTS = [
  { value: 'RECENT', label: '최근' },
  { value: 'VIEWS', label: '조회 순' },
  { value: 'LIKES', label: '좋아요 순' },
] as const satisfies readonly { value: ReviewSort; label: string }[]

export const FREE_SORTS = [
  ...REVIEW_SORTS,
  { value: 'COMMENTS', label: '댓글 많은 순' },
] as const satisfies readonly { value: PostSort; label: string }[]

/** 글에 걸린 향수. 브랜드가 없는 향수가 있어 brand 는 null 일 수 있습니다. */
export interface LinkedPerfume {
  perfumeId: number
  name: string
  brand: string | null
  /**
   * 대표 사진. 선택 항목입니다 — 글 상세의 연결 향수(`PostDetail.relatedPerfumes`)는
   * 서버가 사진을 주지 않아 비어 있고, 거기서는 쓰지도 않습니다.
   */
  thumbnailUrl?: string | null
}

/* ── 자유 게시판 (GET /posts) ──────────────────────────────── */

interface PostSummary {
  postId: number
  /** 분류 코드. 번호가 아니라 코드입니다 — 번호는 환경마다 다릅니다 */
  category: PostCategory
  title: string
  /** 탈퇴한 회원의 글은 글만 남고 작성자가 지워집니다 */
  nickname: string | null
  /** 자유 글은 향수를 안 걸어도 됩니다 */
  perfume: LinkedPerfume | null
  commentCount: number
  likeCount: number
  viewCount: number
  /** 내가 좋아요를 눌렀는지. 비로그인은 항상 false */
  liked: boolean
  /** ISO 8601 */
  createdAt: string
}

export interface PostsResponse {
  posts: PostSummary[]
  /** 0부터 시작합니다 */
  page: number
  size: number
  totalElements: number
}

/**
 * 게시글 상세. `PostSummary` 를 상속하지 않습니다 — 상세에는 `perfume` 한 개가
 * 아니라 `relatedPerfumes` 여러 개가 와서, 묶으면 타입이 거짓말을 합니다.
 */
export interface PostDetail {
  postId: number
  category: PostCategory
  nickname: string | null
  title: string
  content: string
  imageUrls: string[]
  relatedPerfumes: LinkedPerfume[]
  /** 컬렉션 공유 글에만 붙습니다. 글을 쓸 때의 이름이 박제되어 남습니다 */
  collectionId: number | null
  collectionTitle: string | null
  commentCount: number
  likeCount: number
  viewCount: number
  liked: boolean
  /** 내 글이면 수정 · 삭제가 보입니다 */
  mine: boolean
  createdAt: string
  updatedAt: string
}

export interface Comment {
  commentId: number
  nickname: string | null
  content: string
  createdAt: string
  updatedAt: string
  /** 본인 댓글에만 수정 · 삭제가 보입니다 (와이어프레임 A23 주석) */
  mine: boolean
}

export interface CommentsResponse {
  comments: Comment[]
  page: number
  size: number
  totalElements: number
}

/* ── 후기 게시판 (GET /reviews) ────────────────────────────── */

/**
 * 후기 게시판의 한 줄. 자유 글과 달리 **분류와 댓글 수가 없고**(A22a) 대신 어느
 * 향수 이야기인지가 반드시 실립니다.
 */
interface ReviewBoardItem {
  reviewId: number
  title: string
  content: string
  nickname: string | null
  perfume: LinkedPerfume
  likeCount: number
  viewCount: number
  liked: boolean
  createdAt: string
}

export interface ReviewBoardResponse {
  reviews: ReviewBoardItem[]
  page: number
  size: number
  totalElements: number
}

/* ── 두 게시판이 같은 카드로 보이는 부분 ───────────────────── */

/**
 * 목록 컴포넌트가 읽는 한 줄. 두 게시판의 응답을 여기로 맞춰 넘기고, 다른
 * 부분만(분류 · 댓글 수) `null` 로 비웁니다.
 */
export interface BoardItem {
  id: number
  /** 상세로 가는 경로. 후기는 `/reviews/:id`, 자유 글은 `/community/posts/:id` */
  to: string
  title: string
  nickname: string | null
  createdAt: string
  perfume: LinkedPerfume | null
  /** 자유 글에만 있습니다 */
  category: PostCategory | null
  /**
   * 카드에 몇 줄 보여줄 본문. **후기에만 있습니다** — 자유 게시판 목록 응답
   * (`PostSummaryResponse`)에 본문이 없습니다. 붙으면 여기만 채우면 됩니다.
   */
  content: string | null
  likeCount: number
  liked: boolean
  viewCount: number
  /** 후기에는 댓글이 없어 null 입니다 */
  commentCount: number | null
}

export function postToBoardItem(post: PostSummary): BoardItem {
  return {
    id: post.postId,
    to: toPostDetail(post.postId),
    title: post.title,
    nickname: post.nickname,
    createdAt: post.createdAt,
    perfume: post.perfume,
    category: post.category,
    // 자유 게시판 목록 응답에 본문이 없습니다
    content: null,
    likeCount: post.likeCount,
    liked: post.liked,
    viewCount: post.viewCount,
    commentCount: post.commentCount,
  }
}

/**
 * 후기 게시판의 한 줄을 카드 한 장으로 옮깁니다. 누르면 후기 상세(A12)로 갑니다 —
 * 향수 상세에서 눌렀을 때와 **같은 화면**입니다.
 */
export function reviewToBoardItem(review: ReviewBoardItem): BoardItem {
  return {
    id: review.reviewId,
    to: toReviewDetail(review.reviewId),
    title: review.title,
    nickname: review.nickname,
    createdAt: review.createdAt,
    perfume: review.perfume,
    category: null,
    content: review.content,
    likeCount: review.likeCount,
    liked: review.liked,
    viewCount: review.viewCount,
    commentCount: null,
  }
}

/* ── 아직 백엔드가 없는 것 ─────────────────────────────────── */

/**
 * 게시판 우측 "지금 많이 언급되는 향수"
 *
 * ⚠️ 엔드포인트가 없습니다. 향수 검색의 `ranking` 은 담거나 열어 본 횟수라 대신 쓸
 * 수 없어, api.ts 가 자리표시자를 돌려줍니다.
 */
export interface TrendingPerfume {
  perfumeId: number
  name: string
  /** 브랜드가 비어 있는 향수가 있습니다 */
  brand: string | null
  thumbnailUrl: string | null
  /** 이 향수를 건 글의 수. 기간은 응답의 `days` 가 알려줍니다 */
  mentionCount: number
}

/** `GET /posts/trending-perfumes` 응답 */
export interface TrendingPerfumesResponse {
  /** 집계한 기간(일). 화면이 "최근 한 주" 를 적어 두지 않고 이 값을 씁니다 */
  days: number
  perfumes: TrendingPerfume[]
}
