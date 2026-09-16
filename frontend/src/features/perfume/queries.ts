import { queryOptions } from '@tanstack/react-query'

import {
  getPerfumeDetail,
  getPerfumeNotes,
  getPerfumeReviews,
  getPerfumeReviewStatistics,
  getPerfumeReviewSummary,
  getPerfumeSeasonStatistics,
  getReviewDetail,
  searchPerfumes,
} from './api'
import type { PerfumeSearchParams } from './types'

/**
 * 쿼리 키를 한 곳에 모아둡니다.
 * 무효화(invalidate) 할 때 perfumeKeys.all 처럼 상위 키만 지정하면 하위가 함께 갱신됩니다.
 *
 * 향수 상세의 다섯 구역은 각자 다른 엔드포인트라 키도 각자 있습니다. 전부
 * `detail(perfumeId)` 아래에 두어, 후기를 쓰고 나서 그 향수의 후기 · 통계 · 요약을
 * `invalidateQueries({ queryKey: perfumeKeys.detail(id) })` 한 줄로 갱신할 수 있습니다.
 */
export const perfumeKeys = {
  all: ['perfumes'] as const,
  lists: () => [...perfumeKeys.all, 'list'] as const,
  list: (params: PerfumeSearchParams) =>
    [...perfumeKeys.lists(), params] as const,
  details: () => [...perfumeKeys.all, 'detail'] as const,
  detail: (perfumeId: number) => [...perfumeKeys.details(), perfumeId] as const,
  notes: (perfumeId: number) =>
    [...perfumeKeys.detail(perfumeId), 'notes'] as const,
  seasonStatistics: (perfumeId: number) =>
    [...perfumeKeys.detail(perfumeId), 'season-statistics'] as const,
  reviewSummary: (perfumeId: number) =>
    [...perfumeKeys.detail(perfumeId), 'review-summary'] as const,
  reviewStatistics: (perfumeId: number) =>
    [...perfumeKeys.detail(perfumeId), 'review-statistics'] as const,
  reviews: (perfumeId: number, params: { page?: number; size?: number }) =>
    [...perfumeKeys.detail(perfumeId), 'reviews', params] as const,
}

/** 후기는 향수에 매달려 있지 않고 번호로 바로 열립니다(A12) */
export const reviewKeys = {
  all: ['reviews'] as const,
  detail: (reviewId: number) => [...reviewKeys.all, reviewId] as const,
}

export const perfumeListQuery = (params: PerfumeSearchParams) =>
  queryOptions({
    queryKey: perfumeKeys.list(params),
    queryFn: () => searchPerfumes(params),
  })

export const perfumeDetailQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.detail(perfumeId),
    queryFn: () => getPerfumeDetail(perfumeId),
  })

export const perfumeNotesQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.notes(perfumeId),
    queryFn: () => getPerfumeNotes(perfumeId),
  })

export const perfumeSeasonStatisticsQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.seasonStatistics(perfumeId),
    queryFn: () => getPerfumeSeasonStatistics(perfumeId),
  })

export const perfumeReviewSummaryQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.reviewSummary(perfumeId),
    queryFn: () => getPerfumeReviewSummary(perfumeId),
  })

export const perfumeReviewStatisticsQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.reviewStatistics(perfumeId),
    queryFn: () => getPerfumeReviewStatistics(perfumeId),
  })

export const perfumeReviewsQuery = (
  perfumeId: number,
  params: { page?: number; size?: number } = {},
) =>
  queryOptions({
    queryKey: perfumeKeys.reviews(perfumeId, params),
    queryFn: () => getPerfumeReviews(perfumeId, params),
  })

/**
 * 후기 상세. **여는 것이 곧 조회라 부를 때마다 조회수가 오릅니다.**
 * 창을 다시 잡거나 다시 연결됐다고 조회수가 오르면 안 되므로 자동 재요청을 끕니다.
 */
export const reviewDetailQuery = (reviewId: number) =>
  queryOptions({
    queryKey: reviewKeys.detail(reviewId),
    queryFn: () => getReviewDetail(reviewId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
