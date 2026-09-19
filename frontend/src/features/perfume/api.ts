import { http, isApiError } from '@/shared/api/http'
import { env } from '@/shared/config/env'
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
  ReviewCreateInput,
  ReviewCreateResponse,
  ReviewDetail,
  ReviewKeyword,
  ReviewKeywordsResponse,
  ReviewLikeResponse,
  ReviewSeasonsResponse,
  ReviewStatistics,
  ReviewSummary,
  ReviewUpdateInput,
  ReviewsResponse,
  Season,
  SeasonStatisticsResponse,
} from './types'

/**
 * ⚠️ 개발 중 백엔드가 안 떠 있을 때만(status 0 · 502~504) 대체값으로 넘어갑니다.
 * 400 · 401 · 404 는 그대로 올려보냅니다 — 삼키면 진짜 버그가 가려집니다.
 * 지울 때는 이 함수와 `placeholder.ts` 를 함께 지우세요.
 */
async function withDevFallback<T>(
  request: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    const unreachable =
      isApiError(error) &&
      (error.status === 0 || (error.status >= 502 && error.status <= 504))

    if (!env.isDev || !unreachable) throw error

    console.warn(
      '[perfume] 백엔드에 닿지 못해 개발용 대체 데이터를 씁니다. 실제 값이 아닙니다.',
    )
    return fallback()
  }
}

/**
 * COM-05 향수 검색. 조건은 모두 선택이고 함께 오면 AND 입니다.
 * **`scentFamily` 는 받는 자리에서 거릅니다** — 열린 문자열이라 타입만 좁히면
 * 거짓말입니다. ⚠️ gender · ranking 에 없는 값을 보내면 400 입니다.
 */
export async function searchPerfumes(params: PerfumeSearchParams) {
  return withDevFallback(
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

/**
 * DTL-01 향수 기본 정보 조회. 없는 향수는 404 `PERFUME_NOT_FOUND` 이고,
 * 향조 · 계절 · 요약 · 후기는 아래 함수들이 각각 따로 부릅니다.
 */
export async function getPerfumeDetail(perfumeId: number) {
  return withDevFallback(
    async () => {
      const { data } = await http.get<PerfumeDetail>(`/perfumes/${perfumeId}`)
      return data
    },
    () => placeholderDetail(perfumeId),
  )
}

/**
 * DTL-02 향조. 노트와 어코드를 함께 돌려줍니다. 향조가 없는 향수도 200 이고 두
 * 목록이 빈 배열입니다 — 없는 향수만 404 입니다.
 */
export async function getPerfumeNotes(perfumeId: number) {
  return withDevFallback(
    async () => {
      const { data } = await http.get<PerfumeNotesResponse>(
        `/perfumes/${perfumeId}/notes`,
      )
      return data
    },
    () => ({ notes: [], accords: [] }),
  )
}

/** DTL-14 계절별 평가. 후기가 없는 향수도 네 계절이 0 으로 채워져 옵니다. */
export async function getPerfumeSeasonStatistics(perfumeId: number) {
  return withDevFallback(
    async () => {
      const { data } = await http.get<SeasonStatisticsResponse>(
        `/perfumes/${perfumeId}/season-statistics`,
      )
      return data
    },
    () => ({ seasons: [] }),
  )
}

/** DTL-23 AI 후기 요약. 요약이 없으면 세 값이 모두 null 인 200 입니다. */
export async function getPerfumeReviewSummary(perfumeId: number) {
  return withDevFallback(
    async () => {
      const { data } = await http.get<ReviewSummary>(
        `/perfumes/${perfumeId}/review-summary`,
      )
      return data
    },
    () => ({ summary: null, sourceReviewCount: null, updatedAt: null }),
  )
}

/** DTL-10 후기 통계. 후기 수만 있고 평균 평점은 없습니다. */
export async function getPerfumeReviewStatistics(perfumeId: number) {
  return withDevFallback(
    async () => {
      const { data } = await http.get<ReviewStatistics>(
        `/perfumes/${perfumeId}/review-statistics`,
      )
      return data
    },
    () => ({ reviewCount: 0 }),
  )
}

/**
 * DTL-03 후기 목록. 최신 작성 순이고 비로그인도 볼 수 있습니다.
 * 백엔드 기본 size 는 10 이고 최대 100 입니다.
 */
export async function getPerfumeReviews(
  perfumeId: number,
  params: { page?: number; size?: number } = {},
) {
  return withDevFallback(
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

/**
 * A12 후기 상세. 비로그인도 볼 수 있고, **여는 것이 곧 조회라 조회수가 하나 오릅니다.**
 * 그래서 화면에서 staleTime 을 길게 두지 않습니다 — 다시 부르면 또 오릅니다.
 */
export async function getReviewDetail(reviewId: number) {
  const { data } = await http.get<ReviewDetail>(`/reviews/${reviewId}`)
  return data
}

/*
 * ── 후기 쓰기 ───────────────────────────────────────────────
 * 전부 로그인이 필요합니다(401). `withDevFallback` 을 쓰지 않습니다 — 저장되지
 * 않은 것을 저장된 것처럼 보여주게 됩니다.
 */

/**
 * 후기 작성. 대상 향수는 **경로로** 정해지고 나중에 바꿀 수 없습니다. 한 사람이 같은
 * 향수에 두 개를 못 써서, 이미 썼으면 409 `REVIEW_ALREADY_EXISTS` 입니다.
 */
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

/**
 * 후기 수정. 제목 · 내용만 바뀌고 보내지 않은 항목은 유지되지만, **둘 다 비우면
 * 400** 입니다 — 담을 게 없으면 아예 부르지 않습니다.
 */
export async function updateReview(
  reviewId: number,
  input: ReviewUpdateInput,
): Promise<void> {
  await http.patch(`/reviews/${reviewId}`, input)
}

/**
 * 후기의 계절을 통째로 바꿉니다(더하기 · 빼기가 아니라 교체). 빈 배열은 400 이라
 * 계절을 지우기만 할 수는 없습니다.
 */
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

/**
 * 후기 좋아요. **여러 번 눌러도 같은 결과입니다** — 이미 누른 후기에 또 눌러도
 * 오류가 아니고 숫자도 오르지 않아, 따닥 누름을 화면에서 막지 않아도 됩니다.
 */
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

/*
 * ── 향수 상세 조회 기록 (VIEW-01) ──────────────────────────
 *
 * 들어올 때 `POST`, 나갈 때 `PATCH .../exit` 입니다. **체류 시간은 서버가 잽니다** —
 * 화면이 잰 값은 시계가 틀어진 기기나 잠든 탭이 몇 시간짜리 체류를 만듭니다.
 * 로그인이 필요하고(401), 실패해도 화면은 그대로 돕니다.
 */

/** `POST /perfume-views` 응답 */
export interface PerfumeViewStartResponse {
  perfumeViewId: number
  viewedAt: string
}

/** `PATCH /perfume-views/{id}/exit` 응답 */
export interface PerfumeViewExitResponse {
  perfumeViewId: number
  exitedAt: string
  /** 서버가 잰 체류 시간(초) */
  durationSeconds: number
}

/**
 * 상세 화면에 들어왔다고 남깁니다. `fromLocationType` 은 **들어온 길**이고
 * (`shared/config/perfumeViewSource`) `fromPerfumeId` 는 다른 향수 상세에서 건너온
 * 경우에만 싣습니다 — 없는 향수를 실으면 404 입니다.
 */
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
 * 비슷한 향수 (DTL — A10 아래쪽).
 *
 * `/similar` 과 `/neighbors` 가 **같은 데이터를 같은 모양으로** 줍니다(서버도 같은
 * 메서드) — 하나만 씁니다. `size` 는 쪽 크기가 아니라 **최대 개수**입니다(응답에
 * `page` 도 `totalElements` 도 없습니다). 향 지도 밖 향수는 빈 배열입니다.
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

/**
 * 후기에서 자주 나온 향 표현 (DTL).
 *
 * ⚠️ **지금은 모든 향수가 빈 배열입니다** — 키워드를 적재하는 코드가 아직 없습니다.
 * 화면은 값이 있을 때만 구역을 그려, 적재가 도는 날 손대지 않아도 나타납니다.
 * `size` 는 최대 개수이고, 몇 개를 받든 백분율은 같습니다(분모가 따로 세어집니다).
 */
export async function getPerfumeReviewKeywords(
  perfumeId: number,
  size = 8,
): Promise<ReviewKeyword[]> {
  const { data } = await http.get<ReviewKeywordsResponse>(
    `/perfumes/${perfumeId}/review-keywords`,
    { params: { size } },
  )
  return data.keywords
}
