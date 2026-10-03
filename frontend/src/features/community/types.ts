import { toPostDetail, toReviewDetail } from '@/shared/config/routes'
import { i18n } from '@/shared/i18n'

export type PostCategory = 'COLLECTION' | 'RECOMMEND' | 'CHAT'

// 이름표는 여기 두지 않습니다. 모듈을 읽을 때 한 번 정해지면 화면 언어가 바뀌어도 안 바뀝니다 —
// 부르는 쪽이 community 묶음의 `categories.*` · `sorts.*` 를 t() 로 풉니다.
export const POST_CATEGORIES = [
  { value: 'COLLECTION' },
  { value: 'RECOMMEND' },
  { value: 'CHAT' },
] as const satisfies readonly { value: PostCategory }[]

export type PostSort = 'RECENT' | 'VIEWS' | 'LIKES' | 'COMMENTS'

export type ReviewSort = 'RECENT' | 'VIEWS' | 'LIKES'

export const REVIEW_SORTS = [
  { value: 'RECENT' },
  { value: 'VIEWS' },
  { value: 'LIKES' },
] as const satisfies readonly { value: ReviewSort }[]

export const FREE_SORTS = [
  ...REVIEW_SORTS,
  { value: 'COMMENTS' },
] as const satisfies readonly { value: PostSort }[]

/**
 * 게시판 제목. 정렬을 수식어로 앞에 붙이고, 분류가 있으면 그 사이에 끼웁니다.
 * 부를 때마다 지금 화면 언어로 풉니다.
 */
export function boardTitle(
  sort: PostSort,
  noun: string,
  categoryLabel?: string,
) {
  return [i18n.t(`community:board.sortTitles.${sort}`), categoryLabel, noun]
    .filter(Boolean)
    .join(' ')
}

/**
 * 글 · 후기에 걸린 향수. 서버가 준 것은 `name` · `brand` 가 원래(영어) 이름이고 한국어 이름이 따로
 * 옵니다(없으면 null) — 화면은 `localizedName` · `localizedBrand` 로 고릅니다. 글쓰기에서 고른 후보는
 * 한국어 이름을 `name` 에 담아 오고 한국어 칸이 비어 있습니다.
 */
export interface LinkedPerfume {
  perfumeId: number
  name: string
  nameKo?: string | null
  brand: string | null
  brandKo?: string | null
  thumbnailUrl?: string | null
}

interface PostSummary {
  postId: number
  category: PostCategory
  title: string
  nickname: string | null
  profileImageUrl: string | null
  perfume: LinkedPerfume | null
  commentCount: number
  likeCount: number
  viewCount: number
  liked: boolean
  createdAt: string
}

export interface PostsResponse {
  posts: PostSummary[]
  page: number
  size: number
  totalElements: number
}

export interface PostDetail {
  postId: number
  category: PostCategory
  nickname: string | null
  profileImageUrl: string | null
  title: string
  content: string
  imageUrls: string[]
  relatedPerfumes: LinkedPerfume[]
  collectionId: number | null
  collectionTitle: string | null
  commentCount: number
  likeCount: number
  viewCount: number
  liked: boolean
  mine: boolean
  createdAt: string
  updatedAt: string
}

export interface Comment {
  commentId: number
  nickname: string | null
  profileImageUrl: string | null
  content: string
  createdAt: string
  updatedAt: string
  mine: boolean
}

export interface CommentsResponse {
  comments: Comment[]
  page: number
  size: number
  totalElements: number
}

interface ReviewBoardItem {
  reviewId: number
  title: string
  content: string
  nickname: string | null
  profileImageUrl: string | null
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

export interface BoardItem {
  id: number
  to: string
  title: string
  nickname: string | null
  avatarUrl: string | null
  createdAt: string
  perfume: LinkedPerfume | null
  category: PostCategory | null
  content: string | null
  likeCount: number
  liked: boolean
  viewCount: number
  commentCount: number | null
}

export function postToBoardItem(post: PostSummary): BoardItem {
  return {
    id: post.postId,
    to: toPostDetail(post.postId),
    title: post.title,
    nickname: post.nickname,
    avatarUrl: post.profileImageUrl,
    createdAt: post.createdAt,
    perfume: post.perfume,
    category: post.category,
    content: null,
    likeCount: post.likeCount,
    liked: post.liked,
    viewCount: post.viewCount,
    commentCount: post.commentCount,
  }
}

export function reviewToBoardItem(review: ReviewBoardItem): BoardItem {
  return {
    id: review.reviewId,
    to: toReviewDetail(review.reviewId),
    title: review.title,
    nickname: review.nickname,
    avatarUrl: review.profileImageUrl,
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

interface TrendingPerfume {
  perfumeId: number
  /** 원래(영어) 이름 · 브랜드. 한국어 이름은 따로 옵니다(없으면 null) */
  name: string
  nameKo?: string | null
  brand: string | null
  brandKo?: string | null
  thumbnailUrl: string | null
  mentionCount: number
}

export interface TrendingPerfumesResponse {
  days: number
  perfumes: TrendingPerfume[]
}
