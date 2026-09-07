/**
 * 커뮤니티 도메인 타입 (와이어프레임 A22a · A22b · A23 · A24a · A24b · A25)
 * CMT-01 · 02 · 03 · 06 · 07 · 08 · 09 · 10 · 11 · 13
 */

/** 게시판 두 개. 하위 탭이 아니라 별도 경로입니다. */
export type BoardType = 'REVIEW' | 'FREE'

/**
 * 자유 게시판 분류 (CMT-16).
 * 와이어프레임 주석: "분류는 컬렉션 공유 · 추천 · 잡담 셋 중 하나 — 필수 ·
 * 자유 게시판 글에만 있다". 후기 게시판 글은 전부 같은 종류라 분류가 없습니다.
 */
export type PostCategory = 'COLLECTION' | 'RECOMMEND' | 'CHAT'

export const POST_CATEGORIES = [
  { value: 'COLLECTION', label: '컬렉션 공유' },
  { value: 'RECOMMEND', label: '추천' },
  { value: 'CHAT', label: '잡담' },
] as const satisfies readonly { value: PostCategory; label: string }[]

/** 자유 게시판 목록의 분류 필터 — 전체가 기본입니다. */
export const POST_CATEGORY_FILTERS = [
  { value: 'ALL', label: '전체' },
  ...POST_CATEGORIES,
] as const

/**
 * 정렬. 후기 게시판은 세 가지, 자유 게시판은 댓글 많은 순까지 네 가지입니다
 * (와이어프레임 주석).
 */
export type PostSort = 'RECENT' | 'VIEWS' | 'LIKES' | 'COMMENTS'

export const REVIEW_SORTS = [
  { value: 'RECENT', label: '최근' },
  { value: 'VIEWS', label: '조회 순' },
  { value: 'LIKES', label: '좋아요 순' },
] as const satisfies readonly { value: PostSort; label: string }[]

export const FREE_SORTS = [
  ...REVIEW_SORTS,
  { value: 'COMMENTS', label: '댓글 많은 순' },
] as const

/** 글에 걸린 향수. 후기는 반드시 하나, 자유 글은 없어도 됩니다. */
export interface LinkedPerfume {
  perfumeId: number
  name: string
  brand: string
}

export interface PostSummary {
  postId: number
  board: BoardType
  title: string
  nickname: string
  /** ISO 8601 */
  createdAt: string
  /** 후기는 항상 있고, 자유 글은 없을 수 있습니다 */
  perfume: LinkedPerfume | null
  /** 자유 글에만 있습니다 */
  category: PostCategory | null
  likeCount: number
  commentCount: number
  viewCount: number
  /** 내가 좋아요를 눌렀는지 */
  liked: boolean
}

export interface PostDetail extends PostSummary {
  content: string
  imageUrls: string[]
  /** 컬렉션 공유 글에 첨부된 컬렉션 */
  collectionTitle: string | null
  /** 자유 글의 관련 향수는 여러 개일 수 있습니다 */
  relatedPerfumes: LinkedPerfume[]
  mine: boolean
}

export interface Comment {
  commentId: number
  nickname: string
  content: string
  createdAt: string
  /** 본인 댓글에만 수정 · 삭제가 보입니다 (와이어프레임 A23 주석) */
  mine: boolean
}

/** 게시판 우측 "지금 많이 언급되는 향수" */
export interface TrendingPerfume {
  perfumeId: number
  name: string
  postCount: number
}

/**
 * CMT-13 검수 보류 결과 (A25 수정 요청 모달).
 * 와이어프레임 주석: 작성한 제목과 본문은 유지된다 — 다시 쓰게 만들지 않는다.
 */
export interface ModerationRejection {
  /** 보류 사유들 */
  reasons: string[]
  /** 어떻게 고치면 되는지 */
  requestedChange: string
}
