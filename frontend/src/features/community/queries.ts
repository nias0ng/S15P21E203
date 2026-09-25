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

export const trendingPerfumesQuery = () =>
  queryOptions({
    queryKey: communityKeys.trending(),
    queryFn: getTrendingPerfumes,
  })
