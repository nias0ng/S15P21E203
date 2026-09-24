import { queryOptions } from '@tanstack/react-query'

import {
  getPerfumeDetail,
  getPerfumeNotes,
  getPerfumeReviewAggregates,
  getPerfumeReviews,
  getRelatedPerfumes,
  getReviewDetail,
  searchPerfumes,
} from './api'
import type { PerfumeSearchParams } from './types'

/** 상세의 구역을 전부 `detail(perfumeId)` 아래에 두어 한 줄로 무효화합니다 */
export const perfumeKeys = {
  all: ['perfumes'] as const,
  lists: () => [...perfumeKeys.all, 'list'] as const,
  list: (params: PerfumeSearchParams) =>
    [...perfumeKeys.lists(), params] as const,
  details: () => [...perfumeKeys.all, 'detail'] as const,
  detail: (perfumeId: number) => [...perfumeKeys.details(), perfumeId] as const,
  notes: (perfumeId: number) =>
    [...perfumeKeys.detail(perfumeId), 'notes'] as const,
  reviewAggregates: (perfumeId: number) =>
    [...perfumeKeys.detail(perfumeId), 'review-aggregates'] as const,
  reviews: (perfumeId: number, params: { page?: number; size?: number }) =>
    [...perfumeKeys.detail(perfumeId), 'reviews', params] as const,
  related: (perfumeId: number) =>
    [...perfumeKeys.detail(perfumeId), 'related'] as const,
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

/** 요약 · 키워드 · 후기 수 · 계절을 한 요청으로 받습니다 */
export const perfumeReviewAggregatesQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.reviewAggregates(perfumeId),
    queryFn: () => getPerfumeReviewAggregates(perfumeId),
  })

export const perfumeReviewsQuery = (
  perfumeId: number,
  params: { page?: number; size?: number } = {},
) =>
  queryOptions({
    queryKey: perfumeKeys.reviews(perfumeId, params),
    queryFn: () => getPerfumeReviews(perfumeId, params),
  })

/** 부를 때마다 조회수가 올라, 창을 다시 잡았다고 재요청하면 안 됩니다 */
export const reviewDetailQuery = (reviewId: number) =>
  queryOptions({
    queryKey: reviewKeys.detail(reviewId),
    queryFn: () => getReviewDetail(reviewId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

/** 적재할 때 정해 둔 관계라 자주 바뀌지 않습니다 */
export const relatedPerfumesQuery = (perfumeId: number) =>
  queryOptions({
    queryKey: perfumeKeys.related(perfumeId),
    queryFn: () => getRelatedPerfumes(perfumeId),
  })
