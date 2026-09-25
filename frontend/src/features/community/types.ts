import { toPostDetail, toReviewDetail } from '@/shared/config/routes'

export type PostCategory = 'COLLECTION' | 'RECOMMEND' | 'CHAT'

export const POST_CATEGORIES = [
  { value: 'COLLECTION', label: '컬렉션 공유' },
  { value: 'RECOMMEND', label: '추천' },
  { value: 'CHAT', label: '잡담' },
] as const satisfies readonly { value: PostCategory; label: string }[]

export type PostSort = 'RECENT' | 'VIEWS' | 'LIKES' | 'COMMENTS'

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

const SORT_TITLES = {
  RECENT: '최근',
  VIEWS: '많이 본',
  LIKES: '좋아요 많은',
  COMMENTS: '댓글 많은',
} as const satisfies Record<PostSort, string>

export function boardTitle(
  sort: PostSort,
  noun: string,
  categoryLabel?: string,
) {
  return [SORT_TITLES[sort], categoryLabel, noun].filter(Boolean).join(' ')
}

export interface LinkedPerfume {
  perfumeId: number
  name: string
  brand: string | null
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
  name: string
  brand: string | null
  thumbnailUrl: string | null
  mentionCount: number
}

export interface TrendingPerfumesResponse {
  days: number
  perfumes: TrendingPerfume[]
}
