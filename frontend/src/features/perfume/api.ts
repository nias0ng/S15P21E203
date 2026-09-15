import { http, isApiError } from '@/shared/api/http'
import { env } from '@/shared/config/env'

import { placeholderDetail, placeholderSearch } from './placeholder'
import type {
  PerfumeDetail,
  PerfumeNotesResponse,
  PerfumeSearchParams,
  PerfumeSearchResponse,
  ReviewDetail,
  ReviewStatistics,
  ReviewSummary,
  ReviewsResponse,
  SeasonStatisticsResponse,
} from './types'

/**
 * ⚠️ 개발 중 백엔드가 안 떠 있을 때만 대체값으로 넘어갑니다.
 *
 * **요청이 백엔드에 닿지도 못했을 때만**(status 0 · 502~504) 끼어듭니다.
 * 400 · 401 · 404 처럼 백엔드가 대답한 오류는 그대로 올려보냅니다 — 그것까지
 * 삼키면 진짜 버그가 자리표시자에 가려집니다. 운영에서는 끼어들지 않습니다.
 *
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

// 경로에 '/api/v1' 을 붙이지 않습니다 — http 의 baseURL 에 이미 있습니다

/**
 * COM-05 향수 검색. 조건은 모두 선택이고 함께 오면 AND 입니다.
 *
 * ⚠️ gender · ranking 에 정의되지 않은 값을 보내면 400 입니다.
 */
export async function searchPerfumes(params: PerfumeSearchParams) {
  return withDevFallback(
    async () => {
      const { data } = await http.get<PerfumeSearchResponse>('/perfumes', {
        params,
      })
      return data
    },
    () => placeholderSearch(params),
  )
}

/**
 * DTL-01 향수 기본 정보 조회. 없는 향수는 404 `PERFUME_NOT_FOUND` 입니다.
 *
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
 * DTL-02 향조. 노트와 어코드를 함께 돌려줍니다.
 *
 * 향조가 없는 향수도 200 이고 두 목록이 빈 배열입니다. 없는 향수만 404 입니다.
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
 *
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
