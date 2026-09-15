import { http } from '@/shared/api/http'

import type {
  CommentsResponse,
  PostCategory,
  PostDetail,
  PostSort,
  PostsResponse,
  ReviewBoardResponse,
  ReviewSort,
  TrendingPerfume,
} from './types'

// 경로에 '/api/v1' 을 붙이지 않습니다 — http 의 baseURL 에 이미 있습니다

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
 * ⚠️ **자리표시자입니다. 백엔드에 엔드포인트가 없습니다.**
 *
 * "최근 한 주 동안 글에 언급된 수" 를 세는 API 가 없습니다. 향수 검색의 `ranking`
 * (OWNED · WISH · VIEWED)은 담거나 열어 본 횟수라 **다른 값**이어서 대신 쓸 수
 * 없습니다. 엔드포인트가 생기면 이 함수 본문만 http.get 으로 바꾸세요.
 */
export async function getTrendingPerfumes(): Promise<TrendingPerfume[]> {
  return [
    { perfumeId: 1, name: '조 말론 우드 세이지', postCount: 24 },
    { perfumeId: 3, name: '르 라보 상탈 33', postCount: 19 },
    { perfumeId: 2, name: '딥디크 오르페옹', postCount: 11 },
  ]
}
