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

/** 사이드바 줄 수. 서버 기본값은 10, 최대 50 입니다 */
const TRENDING_LIMIT = 5

/**
 * CMT-01 자유 게시판 글 목록. 로그인 없이 볼 수 있습니다.
 *
 * 분류 · 정렬 · 페이지를 **전부 서버가 처리합니다** — 화면에서 다시 거르면 한 페이지
 * 안에서만 걸러져 "2페이지에 있던 잡담 글" 이 사라집니다.
 * `category` 가 없으면 전체이고, 페이지 크기는 기본 20 · 최대 100 입니다.
 */
export async function getPosts(params: {
  category?: PostCategory
  sort?: PostSort
  page?: number
  size?: number
}) {
  const { data } = await http.get<PostsResponse>('/posts', { params })
  return data
}

/**
 * CMT-02 게시글 상세. 비로그인도 볼 수 있습니다. 작성자가 탈퇴한 글은 `nickname` 이
 * 비어 옵니다 — 글은 남고 작성자만 지워집니다.
 */
export async function getPostDetail(postId: number) {
  const { data } = await http.get<PostDetail>(`/posts/${postId}`)
  return data
}

/** CMT-08 댓글 목록. 기본 20개, 최대 100개입니다. */
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

/**
 * CMT-01 후기 게시판. 향수를 가리지 않은 **전체 후기**입니다 — 향수 상세의 후기
 * 목록(`/perfumes/{id}/reviews`)과 달리 줄마다 향수가 함께 실립니다.
 * 분류 필터는 없습니다(A22a).
 */
export async function getReviewBoard(params: {
  sort?: ReviewSort
  page?: number
  size?: number
}) {
  const { data } = await http.get<ReviewBoardResponse>('/reviews', { params })
  return data
}

/**
 * 지금 많이 언급되는 향수 (A22a · A22b 우측). 로그인이 필요 없습니다.
 *
 * 최근 며칠을 셌는지는 **서버가 응답에 담아 줍니다**(`days`) — 화면이 "최근 한 주" 를
 * 적어 두면 서버가 기간을 바꾼 날 거짓이 됩니다. 향수 검색의 `ranking` 과 다른
 * 값입니다(저쪽은 담거나 열어 본 횟수, 이쪽은 글에 걸린 횟수).
 */
export async function getTrendingPerfumes(): Promise<TrendingPerfumesResponse> {
  const { data } = await http.get<TrendingPerfumesResponse>(
    '/posts/trending-perfumes',
    { params: { limit: TRENDING_LIMIT } },
  )
  return data
}

/*
 * ── 쓰기 ──────────────────────────────────────────────────────
 * 전부 로그인이 필요하고(401) 남의 글 · 댓글을 고치거나 지우면 403 입니다.
 * 화면이 [수정] · [삭제] 를 숨기는 것은 표시일 뿐이라 서버가 다시 확인합니다.
 */

/** 글 작성에 보내는 값 (CMT-03) */
interface PostCreateInput {
  category: PostCategory
  title: string
  content: string
  /**
   * 첨부할 컬렉션. **`perfumeIds` 와 함께 보낼 수 없습니다**(400) — 컬렉션을 붙이면
   * 그 컬렉션의 향수가 곧 글의 향수입니다.
   */
  collectionId?: number | null
  /** 글에 걸 향수. 보낸 순서대로 표시됩니다 */
  perfumeIds?: number[]
  imageUrls?: string[]
}

/**
 * 글 수정에 보내는 값 (CMT-06).
 *
 * **보낸 항목만 바뀝니다.** 다만 `perfumeIds` · `imageUrls` 는 보낸 목록으로
 * **통째로** 바뀌므로, 하나를 빼려면 남길 것 전부를 보내야 합니다(빈 배열이면 전부
 * 지워집니다). `collectionId: null` 은 첨부를 떼고, 안 보내면 그대로 남습니다.
 */
type PostUpdateInput = Partial<PostCreateInput>

/** `PUT · DELETE /posts/{postId}/like` 응답 */
interface PostLikeResult {
  postId: number
  liked: boolean
  likeCount: number
}

/**
 * 게시글 이미지 올리기. **한 번에 한 장**입니다 — 여러 장은 화면이 이 함수를 여러 번
 * 부릅니다. 그래야 한 장이 실패해도 나머지가 살고, 어느 장이 실패했는지 압니다.
 *
 * 돌려받은 주소를 글 작성 · 수정의 `imageUrls` 에 그대로 담아 보냅니다. 글이 만들어지기
 * 전에 미리보기를 보여줘야 해서 두 단계로 나뉩니다.
 *
 * 형식 · 용량은 **서버가** 봅니다 — 415(형식) · 413(용량) · 400(빈 파일) · 401(로그인).
 * 화면이 같은 규칙을 한 벌 더 들고 있으면 서버가 설정을 바꾼 날 둘이 갈라집니다.
 * `Content-Type` 은 적지 않습니다. 브라우저가 `FormData` 의 경계 문자열까지 붙여야 합니다.
 */
export async function uploadPostImage(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)

  const { data } = await http.post<{ imageUrl: string }>('/posts/images', body)
  return data.imageUrl
}

/** 글 작성 (CMT-03). 만들어진 글 번호를 돌려줍니다 — 화면이 그 글로 이동합니다 */
export async function createPost(input: PostCreateInput): Promise<number> {
  const { data } = await http.post<{ postId: number; createdAt: string }>(
    '/posts',
    input,
  )
  return data.postId
}

/**
 * 글 수정 (CMT-06). 남의 글은 403, 고칠 항목이 하나도 없으면 400 입니다.
 *
 * ⚠️ **`perfumeIds` · `imageUrls` 는 보낸 목록으로 통째로 바뀝니다** — 더하기 · 빼기가
 * 아니라 덮어쓰기라 화면이 들고 있는 목록 전체를 보내세요(`PostUpdateInput`).
 */
export async function updatePost(
  postId: number,
  input: PostUpdateInput,
): Promise<void> {
  await http.patch(`/posts/${postId}`, input)
}

/** 글 삭제 (CMT-07) */
export async function deletePost(postId: number): Promise<void> {
  await http.delete(`/posts/${postId}`)
}

/**
 * 좋아요 (CMT-05). **누르기와 취소가 다른 메서드입니다** — 토글 하나면 요청을 다시
 * 보낼 때 상태가 뒤집혀 한 번 눌렀는데 취소됩니다. 응답에 `liked` 와 `likeCount` 가
 * 함께 와서 화면이 숫자를 직접 더하지 않습니다.
 */
export async function likePost(postId: number): Promise<PostLikeResult> {
  const { data } = await http.put<PostLikeResult>(`/posts/${postId}/like`)
  return data
}

export async function unlikePost(postId: number): Promise<PostLikeResult> {
  const { data } = await http.delete<PostLikeResult>(`/posts/${postId}/like`)
  return data
}

/** 댓글 작성 (CMT-09). 500자까지입니다 */
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

/** 댓글 수정 (CMT-10). 글이 아니라 **댓글** 번호를 씁니다 */
export async function updateComment(
  commentId: number,
  content: string,
): Promise<void> {
  await http.patch(`/comments/${commentId}`, { content })
}

/** 댓글 삭제 (CMT-11) */
export async function deleteComment(commentId: number): Promise<void> {
  await http.delete(`/comments/${commentId}`)
}
