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

// 경로에 '/api/v1' 을 붙이지 않습니다 — http 의 baseURL 에 이미 있습니다

/**
 * 사이드바에 보이는 줄 수. 서버 기본값은 10, 최대 50 입니다.
 *
 * 다섯으로 줄인 이유: 게시판 옆의 좁은 칸이라 열 줄이면 목록보다 길어집니다.
 */
const TRENDING_LIMIT = 5

/**
 * CMT-01 자유 게시판 글 목록. 로그인 없이 볼 수 있습니다.
 *
 * 분류 · 정렬 · 페이지를 **전부 서버가 처리합니다.** 화면에서 다시 거르면 같은 일을
 * 두 번 하는 데다, 한 페이지 안에서만 걸러져 "2페이지에 있던 잡담 글" 이 사라집니다.
 *
 * `category` 를 주지 않으면 전체입니다. 페이지 크기는 기본 20, 최대 100 입니다.
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
 * CMT-02 게시글 상세. 비로그인도 볼 수 있습니다.
 *
 * 작성자가 탈퇴한 글은 `nickname` 이 비어 옵니다 — 글은 남고 작성자만 지워집니다.
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
 * CMT-01 후기 게시판. 향수를 가리지 않은 **전체 후기**입니다.
 *
 * 향수 상세의 후기 목록(`/perfumes/{id}/reviews`)과 다릅니다 — 거기는 향수 하나의
 * 후기만 보고, 여기는 여러 향수가 섞여 나와 줄마다 향수가 함께 실립니다.
 *
 * 분류 필터가 없습니다. 후기는 전부 같은 종류입니다(A22a).
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
 * 최근 며칠을 셌는지는 **서버가 응답에 담아 줍니다**(`days`). 화면이 "최근 한 주" 를
 * 적어 두면 서버가 기간을 바꾼 날 문구만 거짓이 됩니다.
 *
 * 향수 검색의 `ranking`(OWNED · WISH · VIEWED)과 다른 값입니다 — 저쪽은 담거나 열어
 * 본 횟수이고 이쪽은 글에 걸린 횟수입니다.
 */
export async function getTrendingPerfumes(
  limit = TRENDING_LIMIT,
): Promise<TrendingPerfumesResponse> {
  const { data } = await http.get<TrendingPerfumesResponse>(
    '/posts/trending-perfumes',
    { params: { limit } },
  )
  return data
}

/*
 * ── 쓰기 ──────────────────────────────────────────────────────
 *
 * 전부 로그인이 필요합니다(401). 남의 글 · 남의 댓글을 고치거나 지우면 403 입니다.
 * 화면에서 [수정] · [삭제] 를 본인에게만 보여주지만, 그건 표시일 뿐이라 서버가
 * 다시 확인합니다.
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
 * **보낸 항목만 바뀝니다.** 빼면 그대로 두라는 뜻이라, 제목만 고칠 때 나머지를 함께
 * 보낼 필요가 없습니다. 반대로 `perfumeIds` · `imageUrls` 는 보낸 목록으로 **통째로**
 * 바뀌므로, 하나를 빼려면 남길 것 전부를 보내야 합니다(빈 배열이면 전부 지워집니다).
 *
 * `collectionId: null` 은 첨부를 뗍니다. 보내지 않으면 글을 쓸 때 박제한 컬렉션이
 * 그대로 남습니다 — 제목만 고쳤는데 향수가 바뀌면 안 되기 때문입니다.
 */
type PostUpdateInput = Partial<PostCreateInput>

/** `PUT · DELETE /posts/{postId}/like` 응답 */
interface PostLikeResult {
  postId: number
  liked: boolean
  likeCount: number
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
 * ⚠️ **`perfumeIds` · `imageUrls` 를 보내면 그 목록으로 통째로 바뀝니다.** 더하거나
 * 빼는 요청이 아니라 덮어쓰기라, 하나만 빼려고 그것만 빼고 보내면 나머지가 전부
 * 지워집니다. 화면이 들고 있는 목록 전체를 보내세요(자세한 규칙은 `PostUpdateInput`).
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
 * 좋아요 (CMT-05).
 *
 * **누르기와 취소가 다른 메서드입니다.** 토글 하나로 두면 네트워크가 끊겨 요청을
 * 다시 보낼 때 상태가 뒤집혀, 한 번 눌렀는데 취소되는 일이 생깁니다. 나눠 두면
 * 몇 번을 보내도 결과가 하나로 정해집니다.
 *
 * 응답에 `liked` 와 `likeCount` 가 함께 오므로 화면이 숫자를 직접 더하지 않습니다.
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
