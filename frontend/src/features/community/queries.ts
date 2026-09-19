import { queryOptions } from '@tanstack/react-query'

import {
  getComments,
  getPostDetail,
  getPosts,
  getReviewBoard,
  getTrendingPerfumes,
} from './api'
import type { PostCategory, PostSort, ReviewSort } from './types'

type PostListParams = {
  category?: PostCategory
  sort?: PostSort
  page?: number
  size?: number
}

type ReviewBoardParams = {
  sort?: ReviewSort
  page?: number
  size?: number
}

/**
 * 두 게시판이 키를 나눠 씁니다. 자원이 다르고(`/posts` · `/reviews`) 응답 모양도
 * 달라서, 한 키에 담으면 후기 게시판을 갱신했을 때 자유 게시판까지 다시 불립니다.
 */
export const communityKeys = {
  all: ['community'] as const,
  posts: (params: PostListParams) =>
    [...communityKeys.all, 'posts', params] as const,
  postDetail: (postId: number) =>
    [...communityKeys.all, 'post', postId] as const,
  comments: (postId: number, params: { page?: number; size?: number }) =>
    [...communityKeys.all, 'comments', postId, params] as const,
  reviewBoard: (params: ReviewBoardParams) =>
    [...communityKeys.all, 'review-board', params] as const,
  trending: () => [...communityKeys.all, 'trending'] as const,
}

export const postListQuery = (params: PostListParams) =>
  queryOptions({
    queryKey: communityKeys.posts(params),
    queryFn: () => getPosts(params),
  })

/**
 * 게시글 상세. **여는 것이 곧 조회라 부를 때마다 조회수가 오릅니다.**
 * 창을 다시 잡거나 다시 연결됐다고 조회수가 오르면 안 되므로 자동 재요청을 끕니다.
 */
export const postDetailQuery = (postId: number) =>
  queryOptions({
    queryKey: communityKeys.postDetail(postId),
    queryFn: () => getPostDetail(postId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

export const commentsQuery = (
  postId: number,
  params: { page?: number; size?: number } = {},
) =>
  queryOptions({
    queryKey: communityKeys.comments(postId, params),
    queryFn: () => getComments(postId, params),
  })

export const reviewBoardQuery = (params: ReviewBoardParams) =>
  queryOptions({
    queryKey: communityKeys.reviewBoard(params),
    queryFn: () => getReviewBoard(params),
  })

/**
 * 지금 많이 언급되는 향수. `queryFn` 에 함수를 그대로 넘기지 않습니다 — TanStack 이
 * 첫 인자로 넘기는 컨텍스트가 `limit` 자리에 들어갑니다.
 */
export const trendingPerfumesQuery = () =>
  queryOptions({
    queryKey: communityKeys.trending(),
    queryFn: () => getTrendingPerfumes(),
  })
