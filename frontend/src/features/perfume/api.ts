import { http } from '@/shared/api/http'
import { withDevFallback } from '@/shared/api/withDevFallback'
import type { PerfumeViewSource } from '@/shared/config/perfumeViewSource'
import { toScentFamilyKey } from '@/shared/config/scentFamilies'

import { placeholderDetail, placeholderSearch } from './placeholder'
import type {
  PerfumeDetail,
  PerfumeNotesResponse,
  PerfumeSearchParams,
  PerfumeSearchResponse,
  RelatedPerfume,
  RelatedPerfumesResponse,
  ReviewAggregates,
  ReviewCreateInput,
  ReviewCreateResponse,
  ReviewDetail,
  ReviewLikeResponse,
  ReviewSeasonsResponse,
  ReviewUpdateInput,
  ReviewsResponse,
  Season,
} from './types'

// 경로에 '/api/v1' 을 붙이지 않습니다 — http 의 baseURL 에 이미 있습니다

/** 상세가 키워드 칩을 여덟 개까지만 그립니다 */
const REVIEW_KEYWORD_LIMIT = 8

/** 조건은 함께 오면 AND 입니다. gender · ranking 에 없는 값을 보내면 400 입니다 */
export async function searchPerfumes(params: PerfumeSearchParams) {
  return withDevFallback(
    'perfume',
    async () => {
      const { data } = await http.get<PerfumeSearchResponse>('/perfumes', {
        params,
      })
      return {
        ...data,
        perfumes: data.perfumes.map((perfume) => ({
          ...perfume,
          scentFamily: toScentFamilyKey(perfume.scentFamily),
        })),
      }
    },
    () => placeholderSearch(params),
  )
}

/** DTL-01 향수 기본 정보. 없는 향수는 404 `PERFUME_NOT_FOUND` 입니다 */
export async function getPerfumeDetail(perfumeId: number) {
  return withDevFallback(
    'perfume',
    async () => {
      const { data } = await http.get<PerfumeDetail>(`/perfumes/${perfumeId}`)
      return data
    },
    () => placeholderDetail(perfumeId),
  )
}

export async function getPerfumeNotes(perfumeId: number) {
  return withDevFallback(
    'perfume',
    async () => {
      const { data } = await http.get<PerfumeNotesResponse>(
        `/perfumes/${perfumeId}/notes`,
      )
      return data
    },
    () => ({ notes: [], accords: [] }),
  )
}

/**
 * DTL 상세의 후기 집계 네 조각(요약 · 키워드 · 후기 수 · 계절)을 한 번에 받습니다.
 *
 * 나누어 부르면 화면 한 장이 요청 네 건 · 트랜잭션 네 건이 되어, 50명 동시 접속에서
 * 화면 p95 가 324ms 였습니다. 합친 뒤 123ms 입니다.
 *
 * NOTE: 키워드를 적재하는 코드가 아직 없어 `reviewKeywords.keywords` 는 모든 향수가
 * 빈 배열입니다.
 *
 * @param keywordSize 키워드를 받을 최대 개수. 나머지 세 조각에는 영향이 없습니다
 */
export async function getPerfumeReviewAggregates(
  perfumeId: number,
  keywordSize = REVIEW_KEYWORD_LIMIT,
) {
  return withDevFallback(
    'perfume',
    async () => {
      const { data } = await http.get<ReviewAggregates>(
        `/perfumes/${perfumeId}/review-aggregates`,
        { params: { size: keywordSize } },
      )
      return data
    },
    () => ({
      reviewSummary: {
        summary: null,
        sourceReviewCount: null,
        updatedAt: null,
      },
      reviewKeywords: { keywords: [] },
      reviewStatistics: { reviewCount: 0 },
      seasonStatistics: { seasons: [] },
    }),
  )
}

/** DTL-03 후기 목록. 최신 작성 순 · 비로그인도 볼 수 있고 size 는 기본 10 · 최대 100 입니다 */
export async function getPerfumeReviews(
  perfumeId: number,
  params: { page?: number; size?: number } = {},
) {
  return withDevFallback(
    'perfume',
    async () => {
      const { data } = await http.get<ReviewsResponse>(
        `/perfumes/${perfumeId}/reviews`,
        { params },
      )
      return data
    },
    () => ({
      reviews: [],
      page: params.page ?? 0,
      size: params.size ?? 10,
      totalElements: 0,
    }),
  )
}

/** **여는 것이 곧 조회라 조회수가 하나 오릅니다** — 화면에서 staleTime 을 길게 두지 않습니다 */
export async function getReviewDetail(reviewId: number) {
  const { data } = await http.get<ReviewDetail>(`/reviews/${reviewId}`)
  return data
}

// 후기 쓰기에 `withDevFallback` 을 쓰지 않습니다 — 저장되지 않은 것을 저장된 것처럼 보여주게 됩니다

/** 대상 향수는 **경로로** 정해져 나중에 못 바꿉니다. 이미 썼으면 409 `REVIEW_ALREADY_EXISTS` 입니다 */
export async function createReview(
  perfumeId: number,
  input: ReviewCreateInput,
): Promise<ReviewCreateResponse> {
  const { data } = await http.post<ReviewCreateResponse>(
    `/perfumes/${perfumeId}/reviews`,
    input,
  )
  return data
}

/** 보내지 않은 항목은 유지되지만 **둘 다 비우면 400** 이라 담을 게 없으면 부르지 않습니다 */
export async function updateReview(
  reviewId: number,
  input: ReviewUpdateInput,
): Promise<void> {
  await http.patch(`/reviews/${reviewId}`, input)
}

/** 계절을 통째로 바꿉니다(더하기·빼기가 아니라 교체). 빈 배열은 400 이라 지우기만 할 수는 없습니다 */
export async function replaceReviewSeasons(
  reviewId: number,
  seasonCodes: Season[],
): Promise<ReviewSeasonsResponse> {
  const { data } = await http.put<ReviewSeasonsResponse>(
    `/reviews/${reviewId}/seasons`,
    { seasonCodes },
  )
  return data
}

/** 후기 삭제. 본인 것이 아니면 404 입니다 */
export async function deleteReview(reviewId: number): Promise<void> {
  await http.delete(`/reviews/${reviewId}`)
}

/** **여러 번 눌러도 같은 결과입니다** — 따닥 누름을 화면에서 막지 않아도 됩니다 */
export async function likeReview(
  reviewId: number,
): Promise<ReviewLikeResponse> {
  const { data } = await http.put<ReviewLikeResponse>(
    `/reviews/${reviewId}/like`,
  )
  return data
}

/** 좋아요 취소. 누르지 않은 후기에 취소해도 오류가 아닙니다 */
export async function unlikeReview(
  reviewId: number,
): Promise<ReviewLikeResponse> {
  const { data } = await http.delete<ReviewLikeResponse>(
    `/reviews/${reviewId}/like`,
  )
  return data
}

// VIEW-01 조회 기록은 로그인이 필요하고(401), 실패해도 화면은 그대로 돕니다.

interface PerfumeViewStartResponse {
  perfumeViewId: number
  viewedAt: string
}

interface PerfumeViewExitResponse {
  perfumeViewId: number
  exitedAt: string
  /** 화면이 아니라 **서버가** 잰 체류 시간(초) — 잠든 탭이 몇 시간짜리를 만듭니다 */
  durationSeconds: number
}

/** `fromPerfumeId` 는 다른 향수 상세에서 건너온 경우에만 싣습니다 — 없는 향수를 실으면 404 입니다 */
export async function startPerfumeView(input: {
  perfumeId: number
  fromLocationType: PerfumeViewSource
  fromPerfumeId?: number
}): Promise<PerfumeViewStartResponse> {
  const { data } = await http.post<PerfumeViewStartResponse>('/perfume-views', {
    perfumeId: input.perfumeId,
    fromLocationType: input.fromLocationType,
    ...(input.fromPerfumeId === undefined
      ? {}
      : { fromPerfumeId: input.fromPerfumeId }),
  })
  return data
}

/** 상세 화면에서 나갔다고 남깁니다. 남의 기록이거나 없는 번호면 404 입니다 */
export async function exitPerfumeView(
  perfumeViewId: number,
): Promise<PerfumeViewExitResponse> {
  const { data } = await http.patch<PerfumeViewExitResponse>(
    `/perfume-views/${perfumeViewId}/exit`,
  )
  return data
}

/** 가장 넓은 화면에서 딱 한 줄. 서버는 더 줄 수 있습니다(기본 20) */
export const RELATED_PERFUME_LIMIT = 5

/**
 * 향수 상세의 '비슷한 향수'. `size` 는 쪽 크기가 아니라 **최대 개수**입니다.
 *
 * `/similar` 를 씁니다 — 향 지도 향수는 `/neighbors` 와 같은 목록이고, 지도 밖 향수는 13만 개
 * 전체에서 미리 계산한 목록입니다(`ai/build_similars.py`). `/neighbors` 는 지도 밖 향수에 빈
 * 배열이라 상세에 쓰면 12.9만 개의 상세에서 이 구역이 사라집니다.
 */
export async function getRelatedPerfumes(
  perfumeId: number,
  size = RELATED_PERFUME_LIMIT,
): Promise<RelatedPerfume[]> {
  const { data } = await http.get<RelatedPerfumesResponse>(
    `/perfumes/${perfumeId}/similar`,
    { params: { size } },
  )
  return data.perfumes
}
