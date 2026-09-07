import { queryOptions } from '@tanstack/react-query'

import {
  getComments,
  getPostDetail,
  getPosts,
  getTrendingPerfumes,
} from './api'
import type { BoardType } from './types'

export const communityKeys = {
  all: ['community'] as const,
  posts: (board: BoardType) => [...communityKeys.all, 'posts', board] as const,
  postDetail: (postId: number) =>
    [...communityKeys.all, 'post', postId] as const,
  comments: (postId: number) =>
    [...communityKeys.all, 'comments', postId] as const,
  trending: () => [...communityKeys.all, 'trending'] as const,
}

export const postListQuery = (board: BoardType) =>
  queryOptions({
    queryKey: communityKeys.posts(board),
    queryFn: () => getPosts(board),
  })

export const postDetailQuery = (postId: number) =>
  queryOptions({
    queryKey: communityKeys.postDetail(postId),
    queryFn: () => getPostDetail(postId),
  })

export const commentsQuery = (postId: number) =>
  queryOptions({
    queryKey: communityKeys.comments(postId),
    queryFn: getComments,
  })

export const trendingPerfumesQuery = () =>
  queryOptions({
    queryKey: communityKeys.trending(),
    queryFn: getTrendingPerfumes,
  })
