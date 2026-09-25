import { http } from '@/shared/api/http'

import type {
  CommentsResponse,
  PostCategory,
  PostDetail,
  PostSort,
  PostsResponse,
  ReviewBoardResponse,
  ReviewSort,
  TrendingPerfumesResponse,
} from './types'

const TRENDING_LIMIT = 5

export async function getPosts(params: {
  category?: PostCategory
  sort?: PostSort
  page?: number
  size?: number
}) {
  const { data } = await http.get<PostsResponse>('/posts', { params })
  return data
}

export async function getPostDetail(postId: number) {
  const { data } = await http.get<PostDetail>(`/posts/${postId}`)
  return data
}

export async function getComments(
  postId: number,
  params: { page?: number; size?: number } = {},
) {
  const { data } = await http.get<CommentsResponse>(
    `/posts/${postId}/comments`,
    { params },
  )
  return data
}

export async function getReviewBoard(params: {
  sort?: ReviewSort
  page?: number
  size?: number
}) {
  const { data } = await http.get<ReviewBoardResponse>('/reviews', { params })
  return data
}

export async function getTrendingPerfumes(): Promise<TrendingPerfumesResponse> {
  const { data } = await http.get<TrendingPerfumesResponse>(
    '/posts/trending-perfumes',
    { params: { limit: TRENDING_LIMIT } },
  )
  return data
}

interface PostCreateInput {
  category: PostCategory
  title: string
  content: string
  collectionId?: number | null
  perfumeIds?: number[]
  imageUrls?: string[]
}

type PostUpdateInput = Partial<PostCreateInput>

interface PostLikeResult {
  postId: number
  liked: boolean
  likeCount: number
}

export async function uploadPostImage(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)

  const { data } = await http.post<{ imageUrl: string }>('/posts/images', body)
  return data.imageUrl
}

export async function createPost(input: PostCreateInput): Promise<number> {
  const { data } = await http.post<{ postId: number; createdAt: string }>(
    '/posts',
    input,
  )
  return data.postId
}

export async function updatePost(
  postId: number,
  input: PostUpdateInput,
): Promise<void> {
  await http.patch(`/posts/${postId}`, input)
}

export async function deletePost(postId: number): Promise<void> {
  await http.delete(`/posts/${postId}`)
}

export async function likePost(postId: number): Promise<PostLikeResult> {
  const { data } = await http.put<PostLikeResult>(`/posts/${postId}/like`)
  return data
}

export async function unlikePost(postId: number): Promise<PostLikeResult> {
  const { data } = await http.delete<PostLikeResult>(`/posts/${postId}/like`)
  return data
}

export async function createComment(
  postId: number,
  content: string,
): Promise<number> {
  const { data } = await http.post<{ commentId: number; createdAt: string }>(
    `/posts/${postId}/comments`,
    { content },
  )
  return data.commentId
}

export async function updateComment(
  commentId: number,
  content: string,
): Promise<void> {
  await http.patch(`/comments/${commentId}`, { content })
}

export async function deleteComment(commentId: number): Promise<void> {
  await http.delete(`/comments/${commentId}`)
}
